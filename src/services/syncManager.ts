/**
 * Sync Manager - Orchestrates synchronization between localStorage and Google Drive.
 *
 * Sync Strategy: "Drive as primary, localStorage as cache"
 * - On app load: Fetch from Drive, update localStorage cache
 * - On user action: Write to both (localStorage immediately, Drive async)
 * - Offline: Fall back to localStorage, queue Drive writes for later
 * - Drive unavailable: Graceful degradation, user notified
 */

import type { CustomCategoryId } from '../types/calendar'
import type {
  CloudConfig,
  CloudCustomCategory,
  CloudSyncSettings,
  SyncStatus,
} from '../types/cloudConfig'
import { hasDriveScope } from './auth'
import { readCloudConfig, writeCloudConfig, checkDriveAccess } from './driveSync'
import { getFilters } from './filters'
import { getDisabledCalendars } from './calendarVisibility'
import { getDisabledBuiltInCategories } from './builtInCategories'
import { getCustomCategories } from './customCategories'

const SYNC_SETTINGS_KEY = 'yearbird:cloud-sync-settings'
/**
 * Debounce duration for cloud sync writes.
 * 2 seconds balances responsiveness with API quota conservation.
 * Short enough for good UX, long enough to batch rapid changes.
 */
const SYNC_DEBOUNCE_MS = 2000

let syncDebounceTimer: number | null = null
let isSyncing = false
let isWriting = false
let needsAnotherWrite = false
let lastSyncError: string | null = null

/**
 * Generate a unique device ID for conflict resolution
 */
function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Get cloud sync settings from localStorage
 */
export function getSyncSettings(): CloudSyncSettings {
  try {
    const raw = localStorage.getItem(SYNC_SETTINGS_KEY)
    if (!raw) {
      return {
        enabled: false,
        lastSyncedAt: null,
        deviceId: generateDeviceId(),
      }
    }
    const parsed = JSON.parse(raw) as Partial<CloudSyncSettings>
    return {
      enabled: parsed.enabled ?? false,
      lastSyncedAt: parsed.lastSyncedAt ?? null,
      deviceId: parsed.deviceId || generateDeviceId(),
    }
  } catch {
    return {
      enabled: false,
      lastSyncedAt: null,
      deviceId: generateDeviceId(),
    }
  }
}

/**
 * Save cloud sync settings to localStorage
 */
export function saveSyncSettings(settings: CloudSyncSettings): void {
  try {
    localStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if cloud sync is enabled and ready
 */
export function isSyncEnabled(): boolean {
  const settings = getSyncSettings()
  return settings.enabled && hasDriveScope()
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  const settings = getSyncSettings()

  if (!settings.enabled) {
    return 'disabled'
  }

  if (!hasDriveScope()) {
    return 'needs-consent'
  }

  if (isSyncing) {
    return 'syncing'
  }

  if (!navigator.onLine) {
    return 'offline'
  }

  if (lastSyncError) {
    return 'error'
  }

  return 'synced'
}

/**
 * Get the last sync error message
 */
export function getLastSyncError(): string | null {
  return lastSyncError
}

/**
 * Clear the last sync error
 */
export function clearSyncError(): void {
  lastSyncError = null
}

/**
 * Build a CloudConfig from current localStorage state
 */
export function buildCloudConfigFromLocal(): CloudConfig {
  const settings = getSyncSettings()

  return {
    version: 1,
    updatedAt: Date.now(),
    deviceId: settings.deviceId,
    filters: getFilters(),
    disabledCalendars: getDisabledCalendars(),
    disabledBuiltInCategories: getDisabledBuiltInCategories(),
    customCategories: getCustomCategories() as CloudCustomCategory[],
  }
}

/**
 * Merge local and remote configs.
 *
 * Strategy: Last-write-wins based on updatedAt timestamp.
 * - Arrays (filters, disabledCalendars, disabledBuiltInCategories) use whole-array last-write-wins
 *   to properly handle deletions (union would resurrect deleted items)
 * - Custom categories merge by ID with per-item updatedAt for granular conflict resolution
 */
export function mergeConfigs(
  local: CloudConfig,
  remote: CloudConfig
): CloudConfig {
  const settings = getSyncSettings()
  const remoteIsNewer = remote.updatedAt >= local.updatedAt

  // Filters - last-write-wins (whole array)
  // Using union would resurrect deleted filters, so we take the newer array
  const filters = remoteIsNewer ? remote.filters : local.filters

  // Disabled calendars - last-write-wins (whole array)
  // Union would prevent re-enabling calendars across devices
  const disabledCalendars = remoteIsNewer
    ? remote.disabledCalendars
    : local.disabledCalendars

  // Disabled built-in categories - last-write-wins (whole array)
  const disabledBuiltInCategories = remoteIsNewer
    ? remote.disabledBuiltInCategories
    : local.disabledBuiltInCategories

  // Custom categories - merge by ID with per-item updatedAt
  // This allows granular updates while still supporting deletions via updatedAt
  const categoryMap = new Map<CustomCategoryId, CloudCustomCategory>()
  for (const cat of remote.customCategories) {
    categoryMap.set(cat.id, cat)
  }
  for (const cat of local.customCategories) {
    const existing = categoryMap.get(cat.id)
    if (!existing || cat.updatedAt > existing.updatedAt) {
      categoryMap.set(cat.id, cat)
    }
  }

  return {
    version: 1,
    updatedAt: Date.now(),
    deviceId: settings.deviceId,
    filters,
    disabledCalendars,
    disabledBuiltInCategories,
    customCategories: Array.from(categoryMap.values()),
  }
}

/**
 * Apply cloud config to localStorage.
 * This writes the config data to the respective localStorage keys.
 */
export function applyCloudConfigToLocal(config: CloudConfig): void {
  try {
    // Write filters
    if (config.filters.length > 0) {
      localStorage.setItem('yearbird:filters', JSON.stringify(config.filters))
    } else {
      localStorage.removeItem('yearbird:filters')
    }

    // Write disabled calendars
    if (config.disabledCalendars.length > 0) {
      localStorage.setItem('yearbird:disabled-calendars', JSON.stringify(config.disabledCalendars))
    } else {
      localStorage.removeItem('yearbird:disabled-calendars')
    }

    // Write disabled built-in categories
    if (config.disabledBuiltInCategories.length > 0) {
      localStorage.setItem('yearbird:disabled-built-in-categories', JSON.stringify(config.disabledBuiltInCategories))
    } else {
      localStorage.removeItem('yearbird:disabled-built-in-categories')
    }

    // Write custom categories
    if (config.customCategories.length > 0) {
      localStorage.setItem('yearbird:custom-categories', JSON.stringify({
        version: 1,
        categories: config.customCategories,
      }))
    } else {
      localStorage.removeItem('yearbird:custom-categories')
    }

    // Update sync settings
    const settings = getSyncSettings()
    saveSyncSettings({
      ...settings,
      lastSyncedAt: Date.now(),
    })
  } catch {
    // Ignore storage errors
  }
}

export type SyncResult =
  | { status: 'success' }
  | { status: 'skipped'; reason: 'disabled' | 'already-syncing' | 'offline' }
  | { status: 'error'; message: string }

/**
 * Perform a full sync with Google Drive.
 * - Reads from Drive
 * - Merges with local if both exist
 * - Writes merged result back to both Drive and localStorage
 *
 * Returns detailed result indicating success, skip reason, or error.
 */
export async function performSync(): Promise<SyncResult> {
  if (!isSyncEnabled()) {
    return { status: 'skipped', reason: 'disabled' }
  }

  if (isSyncing) {
    return { status: 'skipped', reason: 'already-syncing' }
  }

  isSyncing = true
  lastSyncError = null

  try {
    // Check if we can access Drive
    const canAccess = await checkDriveAccess()
    if (!canAccess) {
      if (!navigator.onLine) {
        // Offline - not an error, just skip sync
        return { status: 'skipped', reason: 'offline' }
      }
      lastSyncError = 'Cannot access Google Drive'
      return { status: 'error', message: lastSyncError }
    }

    // Read from Drive
    const remoteResult = await readCloudConfig()
    if (!remoteResult.success) {
      lastSyncError = remoteResult.error?.message || 'Failed to read from Drive'
      return { status: 'error', message: lastSyncError }
    }

    const localConfig = buildCloudConfigFromLocal()
    let configToWrite: CloudConfig

    if (remoteResult.data) {
      // Merge local and remote
      configToWrite = mergeConfigs(localConfig, remoteResult.data)
    } else {
      // No remote config - use local as initial upload
      configToWrite = localConfig
    }

    // Write merged config to Drive
    const writeResult = await writeCloudConfig(configToWrite)
    if (!writeResult.success) {
      lastSyncError = writeResult.error?.message || 'Failed to write to Drive'
      return { status: 'error', message: lastSyncError }
    }

    // Apply merged config to localStorage
    applyCloudConfigToLocal(configToWrite)

    return { status: 'success' }
  } catch (error) {
    lastSyncError = error instanceof Error ? error.message : 'Sync failed'
    return { status: 'error', message: lastSyncError }
  } finally {
    isSyncing = false
  }
}

/**
 * Enable cloud sync.
 * This should be called after the user grants Drive scope.
 */
export async function enableSync(): Promise<boolean> {
  if (!hasDriveScope()) {
    return false
  }

  const settings = getSyncSettings()
  saveSyncSettings({
    ...settings,
    enabled: true,
  })

  // Perform initial sync
  const result = await performSync()
  return result.status === 'success'
}

/**
 * Disable cloud sync.
 * Keeps local data but stops syncing to Drive.
 */
export function disableSync(): void {
  const settings = getSyncSettings()
  saveSyncSettings({
    ...settings,
    enabled: false,
    lastSyncedAt: null,
  })

  lastSyncError = null
}

/**
 * Schedule a debounced sync.
 * Call this after any local data change to sync to Drive.
 *
 * Uses isWriting/needsAnotherWrite flags to handle rapid changes:
 * - If a write is in progress and new changes come in, we flag for another write
 * - After the current write completes, we check if another write is needed
 * - This prevents race conditions where changes during a write are lost
 */
export function scheduleSyncToCloud(): void {
  if (!isSyncEnabled()) {
    return
  }

  if (syncDebounceTimer !== null) {
    window.clearTimeout(syncDebounceTimer)
  }

  // If we're currently writing, flag that we need another write after
  if (isWriting) {
    needsAnotherWrite = true
    return
  }

  syncDebounceTimer = window.setTimeout(async () => {
    syncDebounceTimer = null

    if (!navigator.onLine) {
      // Queue for later when online
      return
    }

    await performDebouncedWrite()
  }, SYNC_DEBOUNCE_MS)
}

/**
 * Perform the actual debounced write to Drive.
 * Handles the isWriting flag and checks for queued writes.
 */
async function performDebouncedWrite(): Promise<void> {
  if (isWriting) {
    needsAnotherWrite = true
    return
  }

  isWriting = true
  needsAnotherWrite = false

  try {
    const localConfig = buildCloudConfigFromLocal()
    const writeResult = await writeCloudConfig(localConfig)

    if (!writeResult.success) {
      lastSyncError = writeResult.error?.message || 'Failed to sync'
      console.warn('Cloud sync failed:', lastSyncError)
    } else {
      lastSyncError = null
      const settings = getSyncSettings()
      saveSyncSettings({
        ...settings,
        lastSyncedAt: Date.now(),
      })
    }
  } finally {
    isWriting = false

    // If changes occurred during the write, schedule another write
    if (needsAnotherWrite) {
      needsAnotherWrite = false
      scheduleSyncToCloud()
    }
  }
}

/**
 * Handle coming back online - sync queued changes.
 */
export function handleOnline(): void {
  if (isSyncEnabled()) {
    performSync()
  }
}

/**
 * Initialize sync manager event listeners.
 * Call this once on app startup.
 * Returns a cleanup function to remove listeners.
 */
export function initSyncListeners(): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  window.addEventListener('online', handleOnline)

  return () => {
    window.removeEventListener('online', handleOnline)
    // Clear any pending debounce timer
    if (syncDebounceTimer !== null) {
      window.clearTimeout(syncDebounceTimer)
      syncDebounceTimer = null
    }
  }
}
