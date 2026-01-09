import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  getSyncSettings,
  saveSyncSettings,
  isSyncEnabled,
  getSyncStatus,
  mergeConfigs,
  applyCloudConfigToLocal,
  clearSyncError,
  disableSync,
  performSync,
  enableSync,
  buildCloudConfigFromLocal,
  scheduleSyncToCloud,
  initSyncListeners,
  handleOnline,
  getLastSyncError,
  isEmptyConfig,
  deleteCloudData,
  migrateV1ToV2,
} from './syncManager'
import type { CloudConfigV1, CloudConfigV2, CloudSyncSettings } from '../types/cloudConfig'
import { DEFAULT_CATEGORIES } from '../config/categories'

// Mock auth module
vi.mock('./auth', () => ({
  hasDriveScope: vi.fn(() => true),
}))

// Mock driveSync module
vi.mock('./driveSync', () => ({
  readCloudConfig: vi.fn(),
  writeCloudConfig: vi.fn(),
  checkDriveAccess: vi.fn(),
  deleteCloudConfig: vi.fn(),
}))

// Mock data service modules
vi.mock('./filters', () => ({
  getFilters: vi.fn(() => []),
}))

vi.mock('./calendarVisibility', () => ({
  getDisabledCalendars: vi.fn(() => []),
}))

// Mock unified categories service
vi.mock('./categories', () => ({
  getCategories: vi.fn(() => []),
}))

describe('syncManager', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('getSyncSettings', () => {
    it('returns default settings when nothing stored', () => {
      const settings = getSyncSettings()
      expect(settings.enabled).toBe(false)
      expect(settings.lastSyncedAt).toBeNull()
      expect(settings.deviceId).toBeDefined()
      expect(settings.deviceId.length).toBeGreaterThan(0)
    })

    it('returns stored settings when present', () => {
      const stored: CloudSyncSettings = {
        enabled: true,
        lastSyncedAt: 1234567890,
        deviceId: 'test-device-123',
      }
      localStorage.setItem('yearbird:cloud-sync-settings', JSON.stringify(stored))

      const settings = getSyncSettings()
      expect(settings.enabled).toBe(true)
      expect(settings.lastSyncedAt).toBe(1234567890)
      expect(settings.deviceId).toBe('test-device-123')
    })

    it('generates new deviceId if missing from stored settings', () => {
      localStorage.setItem('yearbird:cloud-sync-settings', JSON.stringify({ enabled: true }))

      const settings = getSyncSettings()
      expect(settings.enabled).toBe(true)
      expect(settings.deviceId).toBeDefined()
      expect(settings.deviceId.length).toBeGreaterThan(0)
    })

    it('handles invalid JSON gracefully', () => {
      localStorage.setItem('yearbird:cloud-sync-settings', 'not valid json')

      const settings = getSyncSettings()
      expect(settings.enabled).toBe(false)
      expect(settings.lastSyncedAt).toBeNull()
    })
  })

  describe('saveSyncSettings', () => {
    it('saves settings to localStorage', () => {
      const settings: CloudSyncSettings = {
        enabled: true,
        lastSyncedAt: 1234567890,
        deviceId: 'test-device',
      }

      saveSyncSettings(settings)

      const stored = JSON.parse(localStorage.getItem('yearbird:cloud-sync-settings') || '{}')
      expect(stored.enabled).toBe(true)
      expect(stored.lastSyncedAt).toBe(1234567890)
      expect(stored.deviceId).toBe('test-device')
    })
  })

  describe('isSyncEnabled', () => {
    it('returns true when user has drive scope (enabled by default)', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(true)

      expect(isSyncEnabled()).toBe(true)
    })

    it('returns false when no drive scope', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(false)

      expect(isSyncEnabled()).toBe(false)
    })

    it('returns false when explicitly disabled', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(true)

      // User explicitly disabled sync
      localStorage.setItem('yearbird:cloud-sync-disabled', 'true')

      expect(isSyncEnabled()).toBe(false)
    })
  })

  describe('getSyncStatus', () => {
    it('returns needs-consent when no drive scope', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(false)

      expect(getSyncStatus()).toBe('needs-consent')
    })

    it('returns disabled when explicitly disabled', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(true)

      // User explicitly disabled sync
      localStorage.setItem('yearbird:cloud-sync-disabled', 'true')

      expect(getSyncStatus()).toBe('disabled')
    })
  })

  describe('mergeConfigs', () => {
    const baseConfigV2: CloudConfigV2 = {
      version: 2,
      updatedAt: 1000,
      deviceId: 'device-1',
      filters: [],
      disabledCalendars: [],
      categories: [],
    }

    it('uses remote arrays when remote is newer', () => {
      const local: CloudConfigV2 = {
        ...baseConfigV2,
        updatedAt: 1000,
        filters: [{ id: '1', pattern: 'local-filter', createdAt: 1000 }],
        disabledCalendars: ['cal-local'],
      }

      const remote: CloudConfigV2 = {
        ...baseConfigV2,
        updatedAt: 2000,
        filters: [{ id: '2', pattern: 'remote-filter', createdAt: 2000 }],
        disabledCalendars: ['cal-remote'],
      }

      const merged = mergeConfigs(local, remote)

      expect(merged.filters).toEqual(remote.filters)
      expect(merged.disabledCalendars).toEqual(remote.disabledCalendars)
    })

    it('uses local arrays when local is newer', () => {
      const local: CloudConfigV2 = {
        ...baseConfigV2,
        updatedAt: 2000,
        filters: [{ id: '1', pattern: 'local-filter', createdAt: 1000 }],
        disabledCalendars: ['cal-local'],
      }

      const remote: CloudConfigV2 = {
        ...baseConfigV2,
        updatedAt: 1000,
        filters: [{ id: '2', pattern: 'remote-filter', createdAt: 500 }],
        disabledCalendars: ['cal-remote'],
      }

      const merged = mergeConfigs(local, remote)

      expect(merged.filters).toEqual(local.filters)
      expect(merged.disabledCalendars).toEqual(local.disabledCalendars)
    })

    it('merges categories by ID with updatedAt precedence', () => {
      const local: CloudConfigV2 = {
        ...baseConfigV2,
        updatedAt: 1000,
        categories: [
          {
            id: 'cat-1',
            label: 'Local Category',
            color: '#ff0000',
            keywords: ['local'],
            matchMode: 'any',
            createdAt: 1000,
            updatedAt: 2000, // Newer
          },
        ],
      }

      const remote: CloudConfigV2 = {
        ...baseConfigV2,
        updatedAt: 2000,
        categories: [
          {
            id: 'cat-1',
            label: 'Remote Category',
            color: '#00ff00',
            keywords: ['remote'],
            matchMode: 'any',
            createdAt: 1000,
            updatedAt: 1500, // Older
          },
        ],
      }

      const merged = mergeConfigs(local, remote)

      expect(merged.categories).toHaveLength(1)
      expect(merged.categories[0].label).toBe('Local Category')
    })

    it('handles deletions correctly (no resurrection)', () => {
      // Local has deleted a filter (empty array)
      const local: CloudConfigV2 = {
        ...baseConfigV2,
        updatedAt: 2000,
        filters: [],
      }

      // Remote still has the filter from before deletion
      const remote: CloudConfigV2 = {
        ...baseConfigV2,
        updatedAt: 1000,
        filters: [{ id: '1', pattern: 'old-filter', createdAt: 500 }],
      }

      const merged = mergeConfigs(local, remote)

      // Local is newer, so deleted filters should stay deleted
      expect(merged.filters).toEqual([])
    })
  })

  describe('applyCloudConfigToLocal', () => {
    it('writes config data to respective localStorage keys', () => {
      const config: CloudConfigV2 = {
        version: 2,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [{ id: '1', pattern: 'test', createdAt: 1000 }],
        disabledCalendars: ['cal-1'],
        categories: [
          {
            id: 'work',
            label: 'Work',
            color: '#8B5CF6',
            keywords: ['meeting'],
            matchMode: 'any',
            createdAt: 1000,
            updatedAt: 1000,
            isDefault: true,
          },
        ],
      }

      applyCloudConfigToLocal(config)

      const filters = JSON.parse(localStorage.getItem('yearbird:filters') || '[]')
      expect(filters).toEqual(config.filters)

      const disabledCalendars = JSON.parse(localStorage.getItem('yearbird:disabled-calendars') || '[]')
      expect(disabledCalendars).toEqual(config.disabledCalendars)

      // Should write unified categories
      const categories = JSON.parse(localStorage.getItem('yearbird:categories') || '[]')
      expect(categories).toEqual(config.categories)

      // Legacy keys should be removed
      expect(localStorage.getItem('yearbird:disabled-built-in-categories')).toBeNull()
      expect(localStorage.getItem('yearbird:custom-categories')).toBeNull()
    })

    it('removes localStorage keys when arrays are empty', () => {
      // First set some data
      localStorage.setItem('yearbird:filters', JSON.stringify([{ id: '1', pattern: 'test', createdAt: 1000 }]))
      localStorage.setItem('yearbird:disabled-calendars', JSON.stringify(['cal-1']))

      // Apply empty config
      const config: CloudConfigV2 = {
        version: 2,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        categories: [],
      }

      applyCloudConfigToLocal(config)

      expect(localStorage.getItem('yearbird:filters')).toBeNull()
      expect(localStorage.getItem('yearbird:disabled-calendars')).toBeNull()
    })
  })

  describe('clearSyncError', () => {
    it('clears the sync error state', () => {
      // Error state is module-level, so just verify the function doesn't throw
      expect(() => clearSyncError()).not.toThrow()
    })
  })

  describe('disableSync', () => {
    it('sets explicitly disabled flag and clears lastSyncedAt', () => {
      saveSyncSettings({
        enabled: true,
        lastSyncedAt: 1234567890,
        deviceId: 'test-device',
      })

      disableSync()

      // Check the explicitly disabled flag
      expect(localStorage.getItem('yearbird:cloud-sync-disabled')).toBe('true')

      const settings = getSyncSettings()
      expect(settings.lastSyncedAt).toBeNull()
      expect(settings.deviceId).toBe('test-device')
    })
  })

  describe('getLastSyncError', () => {
    it('returns null initially', () => {
      expect(getLastSyncError()).toBeNull()
    })
  })

  describe('buildCloudConfigFromLocal', () => {
    it('builds v2 config from localStorage data services', async () => {
      const { getFilters } = await import('./filters')
      const { getDisabledCalendars } = await import('./calendarVisibility')
      const { getCategories } = await import('./categories')

      vi.mocked(getFilters).mockReturnValue([{ id: 'f1', pattern: 'test', createdAt: 1000 }])
      vi.mocked(getDisabledCalendars).mockReturnValue(['cal-1'])
      vi.mocked(getCategories).mockReturnValue([
        {
          id: 'work',
          label: 'Work',
          color: '#8B5CF6',
          keywords: ['meeting'],
          matchMode: 'any',
          createdAt: 1000,
          updatedAt: 1000,
          isDefault: true,
        },
      ])

      saveSyncSettings({
        enabled: true,
        lastSyncedAt: null,
        deviceId: 'my-device',
      })

      const config = buildCloudConfigFromLocal()

      expect(config.version).toBe(2)
      expect(config.deviceId).toBe('my-device')
      expect(config.filters).toEqual([{ id: 'f1', pattern: 'test', createdAt: 1000 }])
      expect(config.disabledCalendars).toEqual(['cal-1'])
      expect(config.categories).toHaveLength(1)
      expect(config.categories[0].id).toBe('work')
    })
  })

  describe('performSync', () => {
    it('returns skipped when sync is disabled', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(false)

      const result = await performSync()

      expect(result.status).toBe('skipped')
      if (result.status === 'skipped') {
        expect(result.reason).toBe('disabled')
      }
    })

    it('returns error when Drive access check fails while online', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(false)

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      // Mock navigator.onLine as true
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

      const result = await performSync()

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toContain('Cannot access Google Drive')
      }

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })

    it('returns skipped when offline and Drive access fails', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(false)

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

      const result = await performSync()

      expect(result.status).toBe('skipped')
      if (result.status === 'skipped') {
        expect(result.reason).toBe('offline')
      }

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })

    it('returns error when readCloudConfig fails', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)
      vi.mocked(readCloudConfig).mockResolvedValue({
        success: false,
        error: { code: 500, message: 'Server error' },
      })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      const result = await performSync()

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('Server error')
      }
    })

    it('returns error when writeCloudConfig fails', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig, writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)
      vi.mocked(readCloudConfig).mockResolvedValue({ success: true, data: null })
      vi.mocked(writeCloudConfig).mockResolvedValue({
        success: false,
        error: { code: 403, message: 'Forbidden' },
      })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      const result = await performSync()

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('Forbidden')
      }
    })

    it('returns success on successful sync with no remote data', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig, writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)
      vi.mocked(readCloudConfig).mockResolvedValue({ success: true, data: null })
      vi.mocked(writeCloudConfig).mockResolvedValue({
        success: true,
        data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
      })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      const result = await performSync()

      expect(result.status).toBe('success')
    })

    it('merges local and remote configs when remote exists', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig, writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)

      const remoteConfig: CloudConfigV2 = {
        version: 2,
        updatedAt: Date.now() - 1000,
        deviceId: 'remote-device',
        filters: [{ id: 'remote-filter', pattern: 'remote', createdAt: 1000 }],
        disabledCalendars: ['remote-cal'],
        categories: [],
      }

      vi.mocked(readCloudConfig).mockResolvedValue({ success: true, data: remoteConfig })
      vi.mocked(writeCloudConfig).mockResolvedValue({
        success: true,
        data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
      })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      const result = await performSync()

      expect(result.status).toBe('success')
      expect(writeCloudConfig).toHaveBeenCalled()
    })

    it('handles unexpected errors during sync', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockRejectedValue(new Error('Unexpected error'))

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      const result = await performSync()

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('Unexpected error')
      }
    })

    it('returns already-syncing when sync is in progress', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig, writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)
      vi.mocked(readCloudConfig).mockResolvedValue({ success: true, data: null })

      // Create a promise that we control to keep the first sync running
      let resolveWrite: ((value: { success: true; data: { id: string; name: string; mimeType: string } }) => void) | null =
        null
      vi.mocked(writeCloudConfig).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveWrite = resolve
          })
      )

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      // Start first sync (will be blocked on writeCloudConfig)
      const firstSync = performSync()

      // Wait a tick for the first sync to start
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Try to start second sync while first is in progress
      const secondResult = await performSync()

      // Second sync should return "already-syncing"
      expect(secondResult.status).toBe('skipped')
      if (secondResult.status === 'skipped') {
        expect(secondResult.reason).toBe('already-syncing')
      }

      // Clean up - resolve the first sync
      resolveWrite!({
        success: true,
        data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
      })
      await firstSync
    })
  })

  describe('enableSync', () => {
    it('returns false when no drive scope', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(false)

      const result = await enableSync()

      expect(result).toBe(false)
    })

    it('clears explicitly disabled flag and performs initial sync', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig, writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)
      vi.mocked(readCloudConfig).mockResolvedValue({ success: true, data: null })
      vi.mocked(writeCloudConfig).mockResolvedValue({
        success: true,
        data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
      })

      // Simulate user had explicitly disabled sync
      localStorage.setItem('yearbird:cloud-sync-disabled', 'true')

      const result = await enableSync()

      expect(result).toBe(true)

      // The explicitly disabled flag should be cleared
      expect(localStorage.getItem('yearbird:cloud-sync-disabled')).toBeNull()
    })
  })

  describe('getSyncStatus additional branches', () => {
    it('returns synced when enabled and online with no error', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig, writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)
      vi.mocked(readCloudConfig).mockResolvedValue({ success: true, data: null })
      vi.mocked(writeCloudConfig).mockResolvedValue({
        success: true,
        data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
      })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      // Perform a successful sync to clear any errors
      await performSync()

      const status = getSyncStatus()
      expect(status).toBe('synced')
    })

    it('returns offline when sync is enabled but navigator is offline', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(true)

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

      const status = getSyncStatus()
      expect(status).toBe('offline')

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })

    it('returns error when sync has an error', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      // Make checkDriveAccess fail to set lastSyncError
      vi.mocked(checkDriveAccess).mockResolvedValue(false)

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      // Perform a sync that will fail and set lastSyncError
      await performSync()

      const status = getSyncStatus()
      expect(status).toBe('error')
      expect(getLastSyncError()).toBe('Cannot access Google Drive')
    })

    it('returns syncing when sync is in progress', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig, writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)
      vi.mocked(readCloudConfig).mockResolvedValue({ success: true, data: null })

      // Create a promise that we control
      let resolveWrite: (() => void) | null = null
      vi.mocked(writeCloudConfig).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveWrite = () =>
              resolve({
                success: true,
                data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
              })
          })
      )

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      // Start sync (will be blocked on writeCloudConfig)
      const syncPromise = performSync()

      // Wait a tick for the sync to start
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Check status while sync is in progress
      const status = getSyncStatus()
      expect(status).toBe('syncing')

      // Clean up
      resolveWrite!()
      await syncPromise
    })
  })

  describe('scheduleSyncToCloud', () => {
    it('does nothing when sync is disabled', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(false)

      // Should not throw
      scheduleSyncToCloud()

      // Wait a bit to ensure no timer was set
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    it('schedules a debounced sync when enabled', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(true)

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      // Call scheduleSyncToCloud - it should schedule but not immediately sync
      scheduleSyncToCloud()

      // Clear timer to avoid side effects
      vi.clearAllTimers()
    })
  })

  describe('initSyncListeners', () => {
    it('returns a cleanup function', () => {
      const cleanup = initSyncListeners()
      expect(typeof cleanup).toBe('function')

      // Call cleanup
      cleanup()
    })

    it('adds and removes online event listener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      const cleanup = initSyncListeners()

      expect(addEventListenerSpy).toHaveBeenCalledWith('online', handleOnline)

      cleanup()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', handleOnline)

      addEventListenerSpy.mockRestore()
      removeEventListenerSpy.mockRestore()
    })
  })

  describe('handleOnline', () => {
    it('triggers sync when sync is enabled', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig, writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)
      vi.mocked(readCloudConfig).mockResolvedValue({ success: true, data: null })
      vi.mocked(writeCloudConfig).mockResolvedValue({
        success: true,
        data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
      })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      handleOnline()

      // Wait for async performSync
      await new Promise((resolve) => setTimeout(resolve, 100))

      // checkDriveAccess should have been called as part of performSync
      expect(checkDriveAccess).toHaveBeenCalled()
    })

    it('does nothing when sync is disabled', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(false)

      // Should not throw
      handleOnline()
    })
  })

  describe('applyCloudConfigToLocal with categories', () => {
    it('writes categories to localStorage', () => {
      const config: CloudConfigV2 = {
        version: 2,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        categories: [
          {
            id: 'custom-1',
            label: 'Test Category',
            color: '#ff0000',
            keywords: ['test'],
            matchMode: 'any',
            createdAt: 1000,
            updatedAt: 1000,
          },
        ],
      }

      applyCloudConfigToLocal(config)

      const stored = JSON.parse(localStorage.getItem('yearbird:categories') || '[]')
      expect(stored).toHaveLength(1)
      expect(stored[0].label).toBe('Test Category')
    })

    it('handles empty categories array', () => {
      localStorage.setItem('yearbird:categories', JSON.stringify([{ id: 'old' }]))

      const config: CloudConfigV2 = {
        version: 2,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        categories: [],
      }

      applyCloudConfigToLocal(config)

      // Even empty categories should write an empty array
      const stored = JSON.parse(localStorage.getItem('yearbird:categories') || '[]')
      expect(stored).toEqual([])
    })

    it('migrates v1 to v2 when applying', () => {
      const configV1: CloudConfigV1 = {
        version: 1,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        disabledBuiltInCategories: ['work'],
        customCategories: [
          {
            id: 'custom-1',
            label: 'Custom Cat',
            color: '#ff0000',
            keywords: ['custom'],
            matchMode: 'any',
            createdAt: 1000,
            updatedAt: 1000,
          },
        ],
      }

      applyCloudConfigToLocal(configV1)

      // Should write unified categories (defaults minus disabled + custom)
      const stored = JSON.parse(localStorage.getItem('yearbird:categories') || '[]')
      expect(stored.find((c: { id: string }) => c.id === 'custom-1')).toBeDefined()
      // Work was disabled, so it shouldn't be in categories
      expect(stored.find((c: { id: string }) => c.id === 'work')).toBeUndefined()
      // Other defaults should be present
      expect(stored.find((c: { id: string }) => c.id === 'birthdays')).toBeDefined()
    })
  })

  describe('scheduleSyncToCloud with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('schedules and executes debounced write', async () => {
      const { hasDriveScope } = await import('./auth')
      const { writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(writeCloudConfig).mockResolvedValue({
        success: true,
        data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
      })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      // Schedule sync
      scheduleSyncToCloud()

      // Fast-forward past debounce timer (2000ms)
      await vi.advanceTimersByTimeAsync(2500)

      // writeCloudConfig should have been called
      expect(writeCloudConfig).toHaveBeenCalled()
    })

    it('cancels previous timer when called multiple times', async () => {
      const { hasDriveScope } = await import('./auth')
      const { writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(writeCloudConfig).mockResolvedValue({
        success: true,
        data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
      })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      // Schedule sync multiple times
      scheduleSyncToCloud()
      await vi.advanceTimersByTimeAsync(1000)
      scheduleSyncToCloud()
      await vi.advanceTimersByTimeAsync(1000)
      scheduleSyncToCloud()

      // Fast-forward to complete the last timer
      await vi.advanceTimersByTimeAsync(3000)

      // writeCloudConfig should only be called once (debounced)
      expect(writeCloudConfig).toHaveBeenCalledTimes(1)
    })

    it('does not execute write when offline', async () => {
      const { hasDriveScope } = await import('./auth')
      const { writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

      // Schedule sync
      scheduleSyncToCloud()

      // Fast-forward past debounce timer
      await vi.advanceTimersByTimeAsync(3000)

      // writeCloudConfig should NOT have been called because we're offline
      expect(writeCloudConfig).not.toHaveBeenCalled()

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })

    it('handles write failure and sets error', async () => {
      const { hasDriveScope } = await import('./auth')
      const { writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(writeCloudConfig).mockResolvedValue({
        success: false,
        error: { code: 500, message: 'Write failed' },
      })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      // Schedule sync
      scheduleSyncToCloud()

      // Suppress console.warn for this test
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Fast-forward past debounce timer
      await vi.advanceTimersByTimeAsync(3000)

      expect(writeCloudConfig).toHaveBeenCalled()
      expect(getLastSyncError()).toBe('Write failed')

      warnSpy.mockRestore()
    })

    it('updates lastSyncedAt on successful write', async () => {
      const { hasDriveScope } = await import('./auth')
      const { writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(writeCloudConfig).mockResolvedValue({
        success: true,
        data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
      })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      expect(getSyncSettings().lastSyncedAt).toBeNull()

      // Schedule sync
      scheduleSyncToCloud()

      // Fast-forward past debounce timer
      await vi.advanceTimersByTimeAsync(3000)

      // lastSyncedAt should now be set
      expect(getSyncSettings().lastSyncedAt).not.toBeNull()
    })
  })

  describe('mergeConfigs additional cases', () => {
    const baseConfigV2: CloudConfigV2 = {
      version: 2,
      updatedAt: 1000,
      deviceId: 'device-1',
      filters: [],
      disabledCalendars: [],
      categories: [],
    }

    it('keeps remote category when remote is newer', () => {
      const local: CloudConfigV2 = {
        ...baseConfigV2,
        updatedAt: 1000,
        categories: [
          {
            id: 'cat-1',
            label: 'Local',
            color: '#ff0000',
            keywords: ['local'],
            matchMode: 'any',
            createdAt: 1000,
            updatedAt: 1000, // Older
          },
        ],
      }

      const remote: CloudConfigV2 = {
        ...baseConfigV2,
        updatedAt: 2000,
        categories: [
          {
            id: 'cat-1',
            label: 'Remote',
            color: '#00ff00',
            keywords: ['remote'],
            matchMode: 'any',
            createdAt: 1000,
            updatedAt: 2000, // Newer
          },
        ],
      }

      const merged = mergeConfigs(local, remote)

      expect(merged.categories[0].label).toBe('Remote')
    })

    it('combines categories from both sources', () => {
      const local: CloudConfigV2 = {
        ...baseConfigV2,
        updatedAt: 1000,
        categories: [
          {
            id: 'local-only',
            label: 'Local Only',
            color: '#ff0000',
            keywords: ['local'],
            matchMode: 'any',
            createdAt: 1000,
            updatedAt: 1000,
          },
        ],
      }

      const remote: CloudConfigV2 = {
        ...baseConfigV2,
        updatedAt: 2000,
        categories: [
          {
            id: 'remote-only',
            label: 'Remote Only',
            color: '#00ff00',
            keywords: ['remote'],
            matchMode: 'any',
            createdAt: 1000,
            updatedAt: 1000,
          },
        ],
      }

      const merged = mergeConfigs(local, remote)

      expect(merged.categories).toHaveLength(2)
      expect(merged.categories.map((c) => c.id)).toContain('local-only')
      expect(merged.categories.map((c) => c.id)).toContain('remote-only')
    })

    it('uses remote disabledCalendars when remote is newer', () => {
      const local: CloudConfigV2 = {
        ...baseConfigV2,
        updatedAt: 1000,
        disabledCalendars: ['cal-1'],
      }

      const remote: CloudConfigV2 = {
        ...baseConfigV2,
        updatedAt: 2000,
        disabledCalendars: ['cal-2', 'cal-3'],
      }

      const merged = mergeConfigs(local, remote)

      expect(merged.disabledCalendars).toEqual(['cal-2', 'cal-3'])
    })

    it('uses local disabledCalendars when local is newer', () => {
      const local: CloudConfigV2 = {
        ...baseConfigV2,
        updatedAt: 2000,
        disabledCalendars: ['cal-1'],
      }

      const remote: CloudConfigV2 = {
        ...baseConfigV2,
        updatedAt: 1000,
        disabledCalendars: ['cal-2', 'cal-3'],
      }

      const merged = mergeConfigs(local, remote)

      expect(merged.disabledCalendars).toEqual(['cal-1'])
    })
  })

  describe('migrateV1ToV2', () => {
    it('converts v1 config to v2 format', () => {
      const v1Config: CloudConfigV1 = {
        version: 1,
        updatedAt: 1000,
        deviceId: 'device-1',
        filters: [{ id: 'f1', pattern: 'test', createdAt: 500 }],
        disabledCalendars: ['cal-1'],
        disabledBuiltInCategories: ['work'],
        customCategories: [
          {
            id: 'custom-1',
            label: 'Custom',
            color: '#ff0000',
            keywords: ['custom'],
            matchMode: 'any',
            createdAt: 800,
            updatedAt: 900,
          },
        ],
      }

      const v2Config = migrateV1ToV2(v1Config)

      expect(v2Config.version).toBe(2)
      expect(v2Config.updatedAt).toBe(1000)
      expect(v2Config.deviceId).toBe('device-1')
      expect(v2Config.filters).toEqual(v1Config.filters)
      expect(v2Config.disabledCalendars).toEqual(['cal-1'])

      // Should have defaults minus disabled + custom
      expect(v2Config.categories.find((c) => c.id === 'work')).toBeUndefined()
      expect(v2Config.categories.find((c) => c.id === 'birthdays')).toBeDefined()
      expect(v2Config.categories.find((c) => c.id === 'custom-1')).toBeDefined()
    })
  })

  describe('scheduleSyncToCloud concurrent writes', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('sets needsAnotherWrite when called during an active write', async () => {
      const { hasDriveScope } = await import('./auth')
      const { writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)

      // Create a promise that we control for the first write
      let resolveFirstWrite: (() => void) | null = null
      const firstWritePromise = new Promise<void>((resolve) => {
        resolveFirstWrite = resolve
      })

      let writeCallCount = 0
      vi.mocked(writeCloudConfig).mockImplementation(() => {
        writeCallCount++
        if (writeCallCount === 1) {
          // First call - return promise we control
          return firstWritePromise.then(() => ({
            success: true,
            data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
          }))
        }
        // Subsequent calls - resolve immediately
        return Promise.resolve({
          success: true,
          data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
        })
      })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      // First scheduleSyncToCloud - sets timer
      scheduleSyncToCloud()

      // Advance timer to trigger the debounced write
      await vi.advanceTimersByTimeAsync(2500)

      // At this point, performDebouncedWrite is executing and isWriting = true
      // Call scheduleSyncToCloud again while write is in progress
      scheduleSyncToCloud()

      // Now resolve the first write
      resolveFirstWrite!()
      await vi.advanceTimersByTimeAsync(0) // Let the promise resolve

      // After the first write completes and needsAnotherWrite was true,
      // it should call scheduleSyncToCloud again, which sets a new timer
      await vi.advanceTimersByTimeAsync(2500)

      // Should have been called twice total (first write + second write triggered by needsAnotherWrite)
      expect(writeCallCount).toBe(2)
    })

    it('handles multiple calls during active write correctly', async () => {
      const { hasDriveScope } = await import('./auth')
      const { writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)

      // Create a promise that we control
      let resolveWrite: (() => void) | null = null
      let writeCallCount = 0

      vi.mocked(writeCloudConfig).mockImplementation(() => {
        writeCallCount++
        if (writeCallCount === 1) {
          return new Promise((resolve) => {
            resolveWrite = () =>
              resolve({
                success: true,
                data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
              })
          })
        }
        return Promise.resolve({
          success: true,
          data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
        })
      })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      // First scheduleSyncToCloud
      scheduleSyncToCloud()
      await vi.advanceTimersByTimeAsync(2500)

      // Call scheduleSyncToCloud multiple times while write is in progress
      scheduleSyncToCloud()
      scheduleSyncToCloud()
      scheduleSyncToCloud()

      // Resolve the first write
      resolveWrite!()
      await vi.advanceTimersByTimeAsync(0)

      // Even though called 3 times, needsAnotherWrite is just a boolean flag
      // So only one additional write should be triggered
      await vi.advanceTimersByTimeAsync(2500)

      // Should only be 2 writes: first + one triggered by needsAnotherWrite
      expect(writeCallCount).toBe(2)
    })
  })

  describe('initSyncListeners SSR', () => {
    it('returns noop cleanup when window is undefined', async () => {
      // Store the original window object
      const originalWindow = globalThis.window

      // Remove window to simulate SSR
      // @ts-expect-error - intentionally deleting window for SSR test
      delete globalThis.window

      // Re-import the module to get fresh exports
      vi.resetModules()
      const { initSyncListeners: initSyncListenersSSR } = await import('./syncManager')

      const cleanup = initSyncListenersSSR()

      // Should return a function
      expect(typeof cleanup).toBe('function')

      // Calling cleanup should not throw
      cleanup()

      // Restore window
      globalThis.window = originalWindow

      // Reset modules again to restore normal behavior
      vi.resetModules()
    })
  })

  describe('isEmptyConfig', () => {
    // Create a v2 config with all default categories
    const defaultCategories = DEFAULT_CATEGORIES.map((def) => ({
      id: def.id,
      label: def.label,
      color: def.color,
      keywords: def.keywords,
      matchMode: def.matchMode,
      createdAt: 1000,
      updatedAt: 1000,
      isDefault: true,
    }))

    const baseConfigV2: CloudConfigV2 = {
      version: 2,
      updatedAt: 1000,
      deviceId: 'device-1',
      filters: [],
      disabledCalendars: [],
      categories: defaultCategories,
    }

    it('returns true for config with only default categories', () => {
      expect(isEmptyConfig(baseConfigV2)).toBe(true)
    })

    it('returns false when config has filters', () => {
      const config: CloudConfigV2 = {
        ...baseConfigV2,
        filters: [{ id: '1', pattern: 'test', createdAt: 1000 }],
      }
      expect(isEmptyConfig(config)).toBe(false)
    })

    it('returns false when config has disabled calendars', () => {
      const config: CloudConfigV2 = {
        ...baseConfigV2,
        disabledCalendars: ['cal-1'],
      }
      expect(isEmptyConfig(config)).toBe(false)
    })

    it('returns false when config has custom categories', () => {
      const config: CloudConfigV2 = {
        ...baseConfigV2,
        categories: [
          ...defaultCategories,
          {
            id: 'custom-1',
            label: 'Custom',
            color: '#ff0000',
            keywords: ['custom'],
            matchMode: 'any',
            createdAt: 1000,
            updatedAt: 1000,
            isDefault: false,
          },
        ],
      }
      expect(isEmptyConfig(config)).toBe(false)
    })

    it('returns false when config is missing a default category', () => {
      const config: CloudConfigV2 = {
        ...baseConfigV2,
        categories: defaultCategories.filter((c) => c.id !== 'work'),
      }
      expect(isEmptyConfig(config)).toBe(false)
    })

    // Test v1 format still works
    it('handles v1 format - empty', () => {
      const v1Config: CloudConfigV1 = {
        version: 1,
        updatedAt: 1000,
        deviceId: 'device-1',
        filters: [],
        disabledCalendars: [],
        disabledBuiltInCategories: [],
        customCategories: [],
      }
      expect(isEmptyConfig(v1Config)).toBe(true)
    })

    it('handles v1 format - not empty', () => {
      const v1Config: CloudConfigV1 = {
        version: 1,
        updatedAt: 1000,
        deviceId: 'device-1',
        filters: [],
        disabledCalendars: [],
        disabledBuiltInCategories: ['work'],
        customCategories: [],
      }
      expect(isEmptyConfig(v1Config)).toBe(false)
    })
  })

  describe('performSync - new device behavior', () => {
    it('adopts remote config entirely when local is empty (new device scenario)', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig, writeCloudConfig } = await import('./driveSync')
      const { getFilters } = await import('./filters')
      const { getDisabledCalendars } = await import('./calendarVisibility')
      const { getCategories } = await import('./categories')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)

      // Local has default categories (empty/new device state)
      const localDefaults = DEFAULT_CATEGORIES.map((def) => ({
        id: def.id,
        label: def.label,
        color: def.color,
        keywords: def.keywords,
        matchMode: def.matchMode,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDefault: true,
      }))

      vi.mocked(getFilters).mockReturnValue([])
      vi.mocked(getDisabledCalendars).mockReturnValue([])
      vi.mocked(getCategories).mockReturnValue(localDefaults)

      // Remote has existing settings from another device (with a custom category)
      const remoteConfig: CloudConfigV2 = {
        version: 2,
        updatedAt: Date.now() - 86400000, // 1 day ago
        deviceId: 'macbook-device',
        filters: [{ id: 'filter-1', pattern: 'Rent Payment', createdAt: 1000 }],
        disabledCalendars: ['work-calendar'],
        categories: [
          {
            id: 'birthdays',
            label: 'Birthdays',
            color: '#F59E0B',
            keywords: ['birthday'],
            matchMode: 'any',
            createdAt: 1000,
            updatedAt: 1000,
            isDefault: true,
          },
          {
            id: 'custom-cat',
            label: 'My Custom',
            color: '#FF0000',
            keywords: ['custom'],
            matchMode: 'any',
            createdAt: 1000,
            updatedAt: 1000,
            isDefault: false,
          },
        ],
      }

      vi.mocked(readCloudConfig).mockResolvedValue({ success: true, data: remoteConfig })

      let writtenConfig: CloudConfigV2 | null = null
      vi.mocked(writeCloudConfig).mockImplementation(async (config) => {
        writtenConfig = config as CloudConfigV2
        return {
          success: true,
          data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
        }
      })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'tv-device' })

      const result = await performSync()

      expect(result.status).toBe('success')

      // The written config should have the remote settings
      expect(writtenConfig).not.toBeNull()
      expect(writtenConfig!.filters).toEqual(remoteConfig.filters)
      expect(writtenConfig!.disabledCalendars).toEqual(remoteConfig.disabledCalendars)
      // Categories merged - should include custom-cat from remote
      expect(writtenConfig!.categories.find((c) => c.id === 'custom-cat')).toBeDefined()
      // Should use the new device's ID
      expect(writtenConfig!.deviceId).toBe('tv-device')
    })

    it('merges configs when local has data (not a new device)', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig, writeCloudConfig } = await import('./driveSync')
      const { getFilters } = await import('./filters')
      const { getDisabledCalendars } = await import('./calendarVisibility')
      const { getCategories } = await import('./categories')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)

      // Local has a custom category (not just defaults - has data)
      const localCategories = [
        {
          id: 'birthdays',
          label: 'Birthdays',
          color: '#F59E0B',
          keywords: ['birthday'],
          matchMode: 'any' as const,
          createdAt: 2000,
          updatedAt: 2000,
          isDefault: true,
        },
        {
          id: 'local-custom',
          label: 'Local Custom',
          color: '#00FF00',
          keywords: ['local'],
          matchMode: 'any' as const,
          createdAt: 2000,
          updatedAt: 2000,
          isDefault: false,
        },
      ]

      vi.mocked(getFilters).mockReturnValue([{ id: 'local-filter', pattern: 'Local', createdAt: 2000 }])
      vi.mocked(getDisabledCalendars).mockReturnValue([])
      vi.mocked(getCategories).mockReturnValue(localCategories)

      // Remote has different settings
      const remoteConfig: CloudConfigV2 = {
        version: 2,
        updatedAt: Date.now() - 86400000, // 1 day ago (older)
        deviceId: 'macbook-device',
        filters: [{ id: 'remote-filter', pattern: 'Remote', createdAt: 1000 }],
        disabledCalendars: [],
        categories: [],
      }

      vi.mocked(readCloudConfig).mockResolvedValue({ success: true, data: remoteConfig })

      let writtenConfig: CloudConfigV2 | null = null
      vi.mocked(writeCloudConfig).mockImplementation(async (config) => {
        writtenConfig = config as CloudConfigV2
        return {
          success: true,
          data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
        }
      })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'tv-device' })

      const result = await performSync()

      expect(result.status).toBe('success')

      // Since local has data, it should go through merge logic
      // Local is newer (Date.now() > remote.updatedAt), so local filters should win
      expect(writtenConfig).not.toBeNull()
      expect(writtenConfig!.filters).toEqual([{ id: 'local-filter', pattern: 'Local', createdAt: 2000 }])
    })
  })

  describe('deleteCloudData', () => {
    it('returns success when delete succeeds', async () => {
      const { deleteCloudConfig } = await import('./driveSync')
      vi.mocked(deleteCloudConfig).mockResolvedValue({ success: true })

      saveSyncSettings({ enabled: true, lastSyncedAt: 1234567890, deviceId: 'test' })

      const result = await deleteCloudData()

      expect(result.status).toBe('success')
      expect(deleteCloudConfig).toHaveBeenCalled()

      // lastSyncedAt should be reset
      const settings = getSyncSettings()
      expect(settings.lastSyncedAt).toBeNull()
      expect(settings.deviceId).toBe('test') // deviceId should be preserved
    })

    it('returns error when delete fails', async () => {
      const { deleteCloudConfig } = await import('./driveSync')
      vi.mocked(deleteCloudConfig).mockResolvedValue({
        success: false,
        error: { code: 403, message: 'Forbidden' },
      })

      const result = await deleteCloudData()

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('Forbidden')
      }
      expect(getLastSyncError()).toBe('Forbidden')
    })

    it('returns error with default message when no error message provided', async () => {
      const { deleteCloudConfig } = await import('./driveSync')
      vi.mocked(deleteCloudConfig).mockResolvedValue({
        success: false,
        error: { code: 500 },
      })

      const result = await deleteCloudData()

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('Failed to delete cloud data')
      }
    })

    it('handles unexpected exceptions', async () => {
      const { deleteCloudConfig } = await import('./driveSync')
      vi.mocked(deleteCloudConfig).mockRejectedValue(new Error('Network error'))

      const result = await deleteCloudData()

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('Network error')
      }
    })

    it('clears lastSyncError on success', async () => {
      const { deleteCloudConfig, checkDriveAccess } = await import('./driveSync')
      const { hasDriveScope } = await import('./auth')

      // First create an error state
      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(false)
      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })
      await performSync() // This will set lastSyncError
      expect(getLastSyncError()).toBe('Cannot access Google Drive')

      // Now delete successfully
      vi.mocked(deleteCloudConfig).mockResolvedValue({ success: true })
      const result = await deleteCloudData()

      expect(result.status).toBe('success')
      expect(getLastSyncError()).toBeNull()
    })

    it('returns error when offline', async () => {
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

      const result = await deleteCloudData()

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('Cannot delete cloud data while offline')
      }
      expect(getLastSyncError()).toBe('Cannot delete cloud data while offline')

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })
  })
})
