/**
 * Sync Manager - Orchestrates synchronization between in-memory state and Google Drive.
 *
 * SIMPLIFIED Sync Strategy: "Cloud is source of truth"
 * - On app load: Read from cloud → apply to local (no merge)
 * - On user change: Write local to cloud (debounced, no read/merge)
 * - Offline load: Use local defaults
 * - Offline change: Flag for later, write when back online
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
  getTimedEventMinHours,
  setTimedEventMinHours,
  getMatchDescription,
  setMatchDescription,
  getWeekViewEnabled,
  setWeekViewEnabled,
  getMonthScrollEnabled,
  setMonthScrollEnabled,
  getMonthScrollDensity,
  setMonthScrollDensity,
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
let hasPendingChanges = false
let lastSyncError: string | null = null

/**
 * Generate a unique device ID for debugging/logging
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
  return hasDriveScope() && !isExplicitlyDisabled()
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  if (isExplicitlyDisabled()) {
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
 * Build a CloudConfig v2 from current in-memory state
 */
export function buildCloudConfigFromLocal(): CloudConfigV2 {
  const settings = getSyncSettings()
  const categories = getCategories()

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
    timedEventMinHours: getTimedEventMinHours(),
    matchDescription: getMatchDescription(),
    weekViewEnabled: getWeekViewEnabled(),
    monthScrollEnabled: getMonthScrollEnabled(),
    monthScrollDensity: getMonthScrollDensity(),
  }
}

/**
 * Migrate a v1 config to v2 format.
 * Converts disabledBuiltInCategories + customCategories → unified categories array.
 */
export function migrateV1ToV2(config: CloudConfigV1): CloudConfigV2 {
  const now = Date.now()

  const disabledSet = new Set(config.disabledBuiltInCategories)
  const categories: CloudCategory[] = []

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

  // Migrate showTimedEvents boolean to timedEventMinHours
  const timedEventMinHours =
    config.showTimedEvents === true ? 0 : config.showTimedEvents === false ? 3 : undefined

  return {
    version: 2,
    updatedAt: config.updatedAt,
    deviceId: config.deviceId,
    filters: config.filters,
    disabledCalendars: config.disabledCalendars,
    categories,
    timedEventMinHours,
    matchDescription: config.matchDescription,
    weekViewEnabled: config.weekViewEnabled,
    monthScrollEnabled: config.monthScrollEnabled,
    monthScrollDensity: config.monthScrollDensity,
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
 * Apply cloud config to in-memory state.
 * Migrates v1 configs to v2 format before applying.
 */
export function applyCloudConfigToLocal(config: CloudConfig): void {
  const v2Config = ensureV2(config)

  setFilters(v2Config.filters)
  setDisabledCalendars(v2Config.disabledCalendars)

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

  // Handle migration: prefer timedEventMinHours, fall back to showTimedEvents
  if (v2Config.timedEventMinHours !== undefined) {
    setTimedEventMinHours(v2Config.timedEventMinHours)
  } else if (v2Config.showTimedEvents !== undefined) {
    setTimedEventMinHours(v2Config.showTimedEvents ? 0 : 3)
  }
  if (v2Config.matchDescription !== undefined) {
    setMatchDescription(v2Config.matchDescription)
  }
  if (v2Config.weekViewEnabled !== undefined) {
    setWeekViewEnabled(v2Config.weekViewEnabled)
  }
  if (v2Config.monthScrollEnabled !== undefined) {
    setMonthScrollEnabled(v2Config.monthScrollEnabled)
  }
  if (v2Config.monthScrollDensity !== undefined) {
    setMonthScrollDensity(v2Config.monthScrollDensity)
  }

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
 * Load settings from cloud and apply to local state.
 * This is a READ-ONLY operation - it does NOT write back to cloud.
 * Use this on app startup to restore user's settings.
 */
export async function loadFromCloud(): Promise<SyncResult> {
  if (!isSyncEnabled()) {
    return { status: 'skipped', reason: 'disabled' }
  }

  if (isSyncing) {
    return { status: 'skipped', reason: 'already-syncing' }
  }

  if (!navigator.onLine) {
    return { status: 'skipped', reason: 'offline' }
  }

  isSyncing = true
  lastSyncError = null

  try {
    const canAccess = await checkDriveAccess()
    if (!canAccess) {
      lastSyncError = 'Cannot access Google Drive'
      return { status: 'error', message: lastSyncError }
    }

    const remoteResult = await readCloudConfig()
    if (!remoteResult.success) {
      lastSyncError = remoteResult.error?.message || 'Failed to read from Drive'
      return { status: 'error', message: lastSyncError }
    }

    if (remoteResult.data) {
      // Cloud has data - apply it to local state
      applyCloudConfigToLocal(remoteResult.data)
    }
    // If cloud is empty, keep local defaults (will be saved on first user change)

    return { status: 'success' }
  } catch (error) {
    lastSyncError = error instanceof Error ? error.message : 'Failed to load from cloud'
    return { status: 'error', message: lastSyncError }
  } finally {
    isSyncing = false
  }
}

/**
 * @deprecated Use loadFromCloud() for initial load, scheduleSyncToCloud() for saves.
 * Kept for backward compatibility during transition.
 */
export async function performSync(): Promise<SyncResult> {
  return loadFromCloud()
}

/**
 * Enable cloud sync.
 * Clears the "explicitly disabled" flag and loads from cloud.
 */
export async function enableSync(): Promise<boolean> {
  if (!hasDriveScope()) {
    return false
  }

  try {
    localStorage.removeItem(SYNC_DISABLED_KEY)
  } catch (error) {
    log.debug('Storage access error enabling sync:', error)
  }

  const result = await loadFromCloud()
  return result.status === 'success'
}

/**
 * Disable cloud sync.
 * Sets the "explicitly disabled" flag to opt-out of sync.
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
 */
export async function deleteCloudData(): Promise<DeleteCloudDataResult> {
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

    resetInMemoryState()

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
  setFilters([])
  setDisabledCalendars([])

  const now = Date.now()
  setCategories(
    DEFAULT_CATEGORIES.map((cat) => ({
      ...cat,
      createdAt: now,
      updatedAt: now,
    }))
  )

  setTimedEventMinHours(3)
  setMatchDescription(false)
  setWeekViewEnabled(false)
  setMonthScrollEnabled(false)
  setMonthScrollDensity(60)
}

/**
 * Schedule a debounced write to cloud.
 * Call this after any local data change.
 *
 * Uses isWriting/needsAnotherWrite flags to handle rapid changes:
 * - If a write is in progress, flag for another write after
 * - Prevents race conditions where changes during a write are lost
 */
export function scheduleSyncToCloud(): void {
  if (!isSyncEnabled()) {
    return
  }

  if (syncDebounceTimer !== null) {
    window.clearTimeout(syncDebounceTimer)
  }

  if (!navigator.onLine) {
    hasPendingChanges = true
    return
  }

  if (isWriting) {
    needsAnotherWrite = true
    return
  }

  syncDebounceTimer = window.setTimeout(async () => {
    syncDebounceTimer = null

    if (!navigator.onLine) {
      hasPendingChanges = true
      return
    }

    await performDebouncedWrite()
  }, SYNC_DEBOUNCE_MS)
}

/**
 * Perform the actual debounced write to Drive.
 * Write-only - does NOT read or merge.
 */
async function performDebouncedWrite(): Promise<void> {
  if (isWriting) {
    needsAnotherWrite = true
    return
  }

  isWriting = true
  needsAnotherWrite = false
  hasPendingChanges = false

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

    if (needsAnotherWrite) {
      needsAnotherWrite = false
      scheduleSyncToCloud()
    }
  }
}

/**
 * Handle coming back online - write any pending changes.
 */
export function handleOnline(): void {
  if (isSyncEnabled() && hasPendingChanges) {
    hasPendingChanges = false
    scheduleSyncToCloud()
  }
}

/**
 * Initialize sync manager event listeners.
 * Returns a cleanup function to remove listeners.
 */
export function initSyncListeners(): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  window.addEventListener('online', handleOnline)

  return () => {
    window.removeEventListener('online', handleOnline)
    if (syncDebounceTimer !== null) {
      window.clearTimeout(syncDebounceTimer)
      syncDebounceTimer = null
    }
  }
}
