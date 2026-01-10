/**
 * Sync Manager - Orchestrates synchronization between in-memory state and Google Drive.
 *
 * Sync Strategy: "Drive as primary, in-memory as working state"
 * - On app load: Fetch from Drive, populate in-memory state
 * - On user action: Update in-memory state, write to Drive async
 * - Offline: In-memory state only, queue Drive writes for later
 * - Drive unavailable: Graceful degradation, user notified
 */

import type {
  CloudConfig,
  CloudConfigV1,
  CloudConfigV2,
  CloudCategory,
  CloudSyncSettings,
  SyncStatus,
} from '../types/cloudConfig'
import { log } from '../utils/logger'
import { DEFAULT_CATEGORIES } from '../config/categories'
import { hasDriveScope } from './auth'
import { readCloudConfig, writeCloudConfig, checkDriveAccess, deleteCloudConfig } from './driveSync'
import { getFilters, setFilters } from './filters'
import { getDisabledCalendars, setDisabledCalendars } from './calendarVisibility'
import { getCategories, setCategories } from './categories'
import {
  getShowTimedEvents,
  setShowTimedEvents,
  getMatchDescription,
  setMatchDescription,
} from './displaySettings'

const SYNC_SETTINGS_KEY = 'yearbird:cloud-sync-settings'
/**
 * Debounce duration for cloud sync writes.
 * 2 seconds balances responsiveness with API quota conservation.
 * Short enough for good UX, long enough to batch rapid changes.
 */
const SYNC_DEBOUNCE_MS = 2000

/**
 * Key to track if user has explicitly disabled sync.
 * Cloud Sync is ON by default when the user has drive scope.
 * This key is only set when user manually turns off sync.
 */
const SYNC_DISABLED_KEY = 'yearbird:cloud-sync-disabled'

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
  } catch (error) {
    log.debug('Storage access error reading sync settings:', error)
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
  } catch (error) {
    log.debug('Storage access error saving sync settings:', error)
  }
}

/**
 * Check if user has explicitly disabled cloud sync.
 */
export function isExplicitlyDisabled(): boolean {
  try {
    return localStorage.getItem(SYNC_DISABLED_KEY) === 'true'
  } catch (error) {
    log.debug('Storage access error checking sync disabled:', error)
    return false
  }
}

/**
 * Check if cloud sync is enabled and ready.
 * Sync is ON by default when the user has drive scope,
 * unless they have explicitly disabled it.
 */
export function isSyncEnabled(): boolean {
  // Sync is enabled by default when user has drive scope
  // Only disabled if user explicitly turned it off
  return hasDriveScope() && !isExplicitlyDisabled()
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  // Check if user explicitly disabled sync
  if (isExplicitlyDisabled()) {
    return 'disabled'
  }

  // Check if we have drive scope (needed for sync)
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
 * Check if a CloudConfig represents an "empty" state (no user settings).
 * Used to determine if we should prefer remote config over local defaults.
 */
export function isEmptyConfig(config: CloudConfig): boolean {
  if (config.version === 2) {
    // v2: Check if only default categories exist (no customization)
    const hasOnlyDefaults = config.categories.every((cat) => cat.isDefault === true)
    const hasAllDefaults = DEFAULT_CATEGORIES.every((def) =>
      config.categories.some((cat) => cat.id === def.id)
    )
    return (
      config.filters.length === 0 &&
      config.disabledCalendars.length === 0 &&
      hasOnlyDefaults &&
      hasAllDefaults &&
      config.categories.length === DEFAULT_CATEGORIES.length
    )
  } else {
    // v1: Legacy check
    return (
      config.filters.length === 0 &&
      config.disabledCalendars.length === 0 &&
      config.disabledBuiltInCategories.length === 0 &&
      config.customCategories.length === 0
    )
  }
}

/**
 * Build a CloudConfig v2 from current in-memory state
 */
export function buildCloudConfigFromLocal(): CloudConfigV2 {
  const settings = getSyncSettings()
  const categories = getCategories()

  // Convert Category[] to CloudCategory[]
  const cloudCategories: CloudCategory[] = categories.map((cat) => ({
    id: cat.id,
    label: cat.label,
    color: cat.color,
    keywords: cat.keywords,
    matchMode: cat.matchMode,
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt,
    isDefault: cat.isDefault,
  }))

  return {
    version: 2,
    updatedAt: Date.now(),
    deviceId: settings.deviceId,
    filters: getFilters(),
    disabledCalendars: getDisabledCalendars(),
    categories: cloudCategories,
    showTimedEvents: getShowTimedEvents(),
    matchDescription: getMatchDescription(),
  }
}

/**
 * Migrate a v1 config to v2 format.
 * Converts disabledBuiltInCategories + customCategories → unified categories array.
 */
export function migrateV1ToV2(config: CloudConfigV1): CloudConfigV2 {
  const now = Date.now()

  // Build unified categories from defaults (minus disabled) + custom
  const disabledSet = new Set(config.disabledBuiltInCategories)

  const categories: CloudCategory[] = []

  // Add non-disabled default categories
  for (const def of DEFAULT_CATEGORIES) {
    if (!disabledSet.has(def.id)) {
      categories.push({
        id: def.id,
        label: def.label,
        color: def.color,
        keywords: def.keywords,
        matchMode: def.matchMode,
        createdAt: now,
        updatedAt: now,
        isDefault: true,
      })
    }
  }

  // Add custom categories
  for (const custom of config.customCategories) {
    categories.push({
      id: custom.id,
      label: custom.label,
      color: custom.color,
      keywords: custom.keywords,
      matchMode: custom.matchMode,
      createdAt: custom.createdAt,
      updatedAt: custom.updatedAt,
      isDefault: false,
    })
  }

  return {
    version: 2,
    updatedAt: config.updatedAt,
    deviceId: config.deviceId,
    filters: config.filters,
    disabledCalendars: config.disabledCalendars,
    categories,
    showTimedEvents: config.showTimedEvents,
    matchDescription: config.matchDescription,
  }
}

/**
 * Ensure config is v2 format, migrating if necessary.
 */
function ensureV2(config: CloudConfig): CloudConfigV2 {
  if (config.version === 2) {
    return config
  }
  return migrateV1ToV2(config)
}

/**
 * Merge local and remote configs.
 *
 * Strategy: Last-write-wins based on updatedAt timestamp.
 * - Arrays (filters, disabledCalendars) use whole-array last-write-wins
 *   to properly handle deletions (union would resurrect deleted items)
 * - Categories merge by ID with per-item updatedAt for granular conflict resolution
 *
 * IMPORTANT: Category Deletion Behavior
 * Categories use per-item merge without tombstone tracking. This means:
 * - If you delete a category locally, it's removed from local storage
 * - But if remote still has it (from another device), it will be re-added on next sync
 * - To permanently delete across devices, all devices must delete the same category
 * - This is a trade-off: simpler implementation, but deletions don't propagate
 * - Future enhancement: add tombstone tracking with deletedAt timestamps
 *
 * Both configs are migrated to v2 before merging if needed.
 */
export function mergeConfigs(
  local: CloudConfig,
  remote: CloudConfig
): CloudConfigV2 {
  const settings = getSyncSettings()

  // Ensure both are v2 format
  const localV2 = ensureV2(local)
  const remoteV2 = ensureV2(remote)

  const remoteIsNewer = remoteV2.updatedAt >= localV2.updatedAt

  // Filters - last-write-wins (whole array)
  const filters = remoteIsNewer ? remoteV2.filters : localV2.filters

  // Disabled calendars - last-write-wins (whole array)
  const disabledCalendars = remoteIsNewer
    ? remoteV2.disabledCalendars
    : localV2.disabledCalendars

  // Categories - merge by ID with per-item updatedAt
  // This allows granular updates while still supporting deletions
  const categoryMap = new Map<string, CloudCategory>()

  // Start with remote categories
  for (const cat of remoteV2.categories) {
    categoryMap.set(cat.id, cat)
  }

  // Merge local categories (newer wins per category)
  for (const cat of localV2.categories) {
    const existing = categoryMap.get(cat.id)
    if (!existing || cat.updatedAt > existing.updatedAt) {
      categoryMap.set(cat.id, cat)
    }
  }

  // Display settings - last-write-wins
  const showTimedEvents = remoteIsNewer
    ? remote.showTimedEvents
    : local.showTimedEvents
  const matchDescription = remoteIsNewer
    ? remote.matchDescription
    : local.matchDescription

  return {
    version: 2,
    updatedAt: Date.now(),
    deviceId: settings.deviceId,
    filters,
    disabledCalendars,
    categories: Array.from(categoryMap.values()),
    showTimedEvents,
    matchDescription,
  }
}

/**
 * Apply cloud config to in-memory state.
 * Migrates v1 configs to v2 format before applying.
 * Populates all in-memory services with cloud data.
 */
export function applyCloudConfigToLocal(config: CloudConfig): void {
  // Ensure v2 format
  const v2Config = ensureV2(config)

  // Update filters in-memory
  setFilters(v2Config.filters)

  // Update disabled calendars in-memory
  setDisabledCalendars(v2Config.disabledCalendars)

  // Update categories in-memory
  setCategories(
    v2Config.categories.map((cat) => ({
      id: cat.id,
      label: cat.label,
      color: cat.color,
      keywords: cat.keywords,
      matchMode: cat.matchMode,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      isDefault: cat.isDefault ?? false,
    }))
  )

  // Update display settings in-memory
  if (v2Config.showTimedEvents !== undefined) {
    setShowTimedEvents(v2Config.showTimedEvents)
  }
  if (v2Config.matchDescription !== undefined) {
    setMatchDescription(v2Config.matchDescription)
  }

  // Update sync settings
  const settings = getSyncSettings()
  saveSyncSettings({
    ...settings,
    lastSyncedAt: Date.now(),
  })
}

export type SyncResult =
  | { status: 'success' }
  | { status: 'skipped'; reason: 'disabled' | 'already-syncing' | 'offline' }
  | { status: 'error'; message: string }

/**
 * Perform a full sync with Google Drive.
 * - Reads from Drive
 * - Merges with local if both exist
 * - Writes merged result back to Drive and in-memory state
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
      // If local is empty (new device), adopt remote settings entirely
      // This prevents a new device from wiping existing cloud settings
      if (isEmptyConfig(localConfig)) {
        configToWrite = {
          ...remoteResult.data,
          updatedAt: Date.now(),
          deviceId: getSyncSettings().deviceId,
        }
      } else {
        // Both have data - merge with last-write-wins
        configToWrite = mergeConfigs(localConfig, remoteResult.data)
      }
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

    // Apply merged config to in-memory state
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
 * Clears the "explicitly disabled" flag and performs initial sync.
 * Note: Sync is ON by default when user has drive scope.
 */
export async function enableSync(): Promise<boolean> {
  if (!hasDriveScope()) {
    return false
  }

  // Clear the explicitly disabled flag
  try {
    localStorage.removeItem(SYNC_DISABLED_KEY)
  } catch (error) {
    log.debug('Storage access error enabling sync:', error)
  }

  // Perform initial sync
  const result = await performSync()
  return result.status === 'success'
}

/**
 * Disable cloud sync.
 * Sets the "explicitly disabled" flag to opt-out of sync.
 * Keeps in-memory data but stops syncing to Drive.
 */
export function disableSync(): void {
  try {
    localStorage.setItem(SYNC_DISABLED_KEY, 'true')
  } catch (error) {
    log.debug('Storage access error disabling sync:', error)
  }

  const settings = getSyncSettings()
  saveSyncSettings({
    ...settings,
    lastSyncedAt: null,
  })

  lastSyncError = null
}

export type DeleteCloudDataResult =
  | { status: 'success' }
  | { status: 'error'; message: string }

/**
 * Delete all cloud data from Google Drive and reset in-memory state.
 * This removes the config file from appDataFolder.
 * Resets all settings to defaults.
 * Useful for:
 * - Starting completely fresh
 * - Users who want to delete their data from Google
 */
export async function deleteCloudData(): Promise<DeleteCloudDataResult> {
  // Check if we're online before attempting delete
  if (!navigator.onLine) {
    const message = 'Cannot delete cloud data while offline'
    lastSyncError = message
    return { status: 'error', message }
  }

  try {
    const result = await deleteCloudConfig()
    if (!result.success) {
      const message = result.error?.message || 'Failed to delete cloud data'
      lastSyncError = message
      return { status: 'error', message }
    }

    // Reset in-memory state to defaults
    resetInMemoryState()

    // Reset sync settings but keep device ID
    const settings = getSyncSettings()
    saveSyncSettings({
      ...settings,
      lastSyncedAt: null,
    })

    lastSyncError = null
    return { status: 'success' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete cloud data'
    lastSyncError = message
    return { status: 'error', message }
  }
}

/**
 * Reset all in-memory settings to defaults.
 */
export function resetInMemoryState(): void {
  // Clear filters
  setFilters([])

  // Clear disabled calendars
  setDisabledCalendars([])

  // Reset categories to defaults (done by importing fresh)
  const now = Date.now()
  setCategories(
    DEFAULT_CATEGORIES.map((cat) => ({
      ...cat,
      createdAt: now,
      updatedAt: now,
    }))
  )

  // Reset display settings
  setShowTimedEvents(false)
  setMatchDescription(false)
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
      log.warn('Cloud sync failed:', lastSyncError)
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
