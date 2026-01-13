import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  getSyncSettings,
  saveSyncSettings,
  isSyncEnabled,
  getSyncStatus,
  applyCloudConfigToLocal,
  clearSyncError,
  disableSync,
  performSync,
  loadFromCloud,
  enableSync,
  buildCloudConfigFromLocal,
  scheduleSyncToCloud,
  initSyncListeners,
  handleOnline,
  getLastSyncError,
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
  setFilters: vi.fn(),
}))

vi.mock('./calendarVisibility', () => ({
  getDisabledCalendars: vi.fn(() => []),
  setDisabledCalendars: vi.fn(),
}))

// Mock unified categories service
vi.mock('./categories', () => ({
  getCategories: vi.fn(() => []),
  setCategories: vi.fn(),
}))

// Mock display settings service
vi.mock('./displaySettings', () => ({
  getTimedEventMinHours: vi.fn(() => 3),
  setTimedEventMinHours: vi.fn(),
  getMatchDescription: vi.fn(() => false),
  setMatchDescription: vi.fn(),
  getWeekViewEnabled: vi.fn(() => false),
  setWeekViewEnabled: vi.fn(),
  getMonthScrollEnabled: vi.fn(() => false),
  setMonthScrollEnabled: vi.fn(),
  getMonthScrollDensity: vi.fn(() => 60),
  setMonthScrollDensity: vi.fn(),
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

  describe('applyCloudConfigToLocal', () => {
    it('calls setters with config data', async () => {
      const { setFilters } = await import('./filters')
      const { setDisabledCalendars } = await import('./calendarVisibility')
      const { setCategories } = await import('./categories')

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

      expect(setFilters).toHaveBeenCalledWith(config.filters)
      expect(setDisabledCalendars).toHaveBeenCalledWith(config.disabledCalendars)
      expect(setCategories).toHaveBeenCalled()
    })

    it('calls setters with empty arrays', async () => {
      const { setFilters } = await import('./filters')
      const { setDisabledCalendars } = await import('./calendarVisibility')
      const { setCategories } = await import('./categories')

      const config: CloudConfigV2 = {
        version: 2,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        categories: [],
      }

      applyCloudConfigToLocal(config)

      expect(setFilters).toHaveBeenCalledWith([])
      expect(setDisabledCalendars).toHaveBeenCalledWith([])
      expect(setCategories).toHaveBeenCalled()
    })

    it('applies timedEventMinHours via setter', async () => {
      const { setTimedEventMinHours } = await import('./displaySettings')

      const config: CloudConfigV2 = {
        version: 2,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        categories: [],
        timedEventMinHours: 4,
      }

      applyCloudConfigToLocal(config)

      expect(setTimedEventMinHours).toHaveBeenCalledWith(4)
    })

    it('migrates legacy showTimedEvents true to timedEventMinHours 0', async () => {
      const { setTimedEventMinHours } = await import('./displaySettings')

      const config: CloudConfigV1 = {
        version: 1,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        disabledBuiltInCategories: [],
        customCategories: [],
        showTimedEvents: true,
      }

      applyCloudConfigToLocal(config)

      // showTimedEvents: true means show all -> timedEventMinHours: 0
      expect(setTimedEventMinHours).toHaveBeenCalledWith(0)
    })

    it('migrates legacy showTimedEvents false to timedEventMinHours 3', async () => {
      const { setTimedEventMinHours } = await import('./displaySettings')

      const config: CloudConfigV1 = {
        version: 1,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        disabledBuiltInCategories: [],
        customCategories: [],
        showTimedEvents: false,
      }

      applyCloudConfigToLocal(config)

      // showTimedEvents: false means use default threshold -> timedEventMinHours: 3
      expect(setTimedEventMinHours).toHaveBeenCalledWith(3)
    })

    it('applies weekViewEnabled via setter', async () => {
      const { setWeekViewEnabled } = await import('./displaySettings')

      const config: CloudConfigV2 = {
        version: 2,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        categories: [],
        weekViewEnabled: true,
      }

      applyCloudConfigToLocal(config)

      expect(setWeekViewEnabled).toHaveBeenCalledWith(true)
    })

    it('applies matchDescription via setter', async () => {
      const { setMatchDescription } = await import('./displaySettings')

      const config: CloudConfigV2 = {
        version: 2,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        categories: [],
        matchDescription: true,
      }

      applyCloudConfigToLocal(config)

      expect(setMatchDescription).toHaveBeenCalledWith(true)
    })

    it('does not call display settings setters when undefined in config', async () => {
      const { setTimedEventMinHours, setMatchDescription, setWeekViewEnabled } = await import('./displaySettings')

      vi.mocked(setTimedEventMinHours).mockClear()
      vi.mocked(setMatchDescription).mockClear()
      vi.mocked(setWeekViewEnabled).mockClear()

      const config: CloudConfigV2 = {
        version: 2,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        categories: [],
        // timedEventMinHours, matchDescription, weekViewEnabled are undefined
      }

      applyCloudConfigToLocal(config)

      expect(setTimedEventMinHours).not.toHaveBeenCalled()
      expect(setMatchDescription).not.toHaveBeenCalled()
      expect(setWeekViewEnabled).not.toHaveBeenCalled()
    })
  })

  describe('clearSyncError', () => {
    it('clears the sync error state', () => {
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

    it('includes display settings in built config', async () => {
      const { getTimedEventMinHours, getMatchDescription, getWeekViewEnabled } = await import('./displaySettings')
      vi.mocked(getTimedEventMinHours).mockReturnValue(4)
      vi.mocked(getMatchDescription).mockReturnValue(true)
      vi.mocked(getWeekViewEnabled).mockReturnValue(true)

      saveSyncSettings({
        enabled: true,
        lastSyncedAt: null,
        deviceId: 'test-device',
      })

      const config = buildCloudConfigFromLocal()

      expect(config.timedEventMinHours).toBe(4)
      expect(config.matchDescription).toBe(true)
      expect(config.weekViewEnabled).toBe(true)
    })
  })

  describe('loadFromCloud', () => {
    it('returns skipped when sync is disabled', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(false)

      const result = await loadFromCloud()

      expect(result.status).toBe('skipped')
      if (result.status === 'skipped') {
        expect(result.reason).toBe('disabled')
      }
    })

    it('returns skipped when offline', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(true)

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

      const result = await loadFromCloud()

      expect(result.status).toBe('skipped')
      if (result.status === 'skipped') {
        expect(result.reason).toBe('offline')
      }

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })

    it('returns error when Drive access check fails', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(false)

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      const result = await loadFromCloud()

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toContain('Cannot access Google Drive')
      }
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

      const result = await loadFromCloud()

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('Server error')
      }
    })

    it('returns success and applies remote config when cloud has data', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig } = await import('./driveSync')
      const { setWeekViewEnabled } = await import('./displaySettings')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)

      const remoteConfig: CloudConfigV2 = {
        version: 2,
        updatedAt: Date.now(),
        deviceId: 'remote-device',
        filters: [],
        disabledCalendars: [],
        categories: [],
        weekViewEnabled: true,
      }

      vi.mocked(readCloudConfig).mockResolvedValue({ success: true, data: remoteConfig })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      const result = await loadFromCloud()

      expect(result.status).toBe('success')
      expect(setWeekViewEnabled).toHaveBeenCalledWith(true)
    })

    it('returns success without applying when cloud is empty', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig } = await import('./driveSync')
      const { setFilters } = await import('./filters')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)
      vi.mocked(readCloudConfig).mockResolvedValue({ success: true, data: null })

      vi.mocked(setFilters).mockClear()

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      const result = await loadFromCloud()

      expect(result.status).toBe('success')
      // setFilters should NOT be called when cloud is empty
      expect(setFilters).not.toHaveBeenCalled()
    })

    it('does NOT write to cloud (read-only operation)', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig, writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)
      vi.mocked(readCloudConfig).mockResolvedValue({ success: true, data: null })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      await loadFromCloud()

      // loadFromCloud should NOT write to cloud
      expect(writeCloudConfig).not.toHaveBeenCalled()
    })

    it('returns already-syncing when sync is in progress', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)

      // Create a promise that we control to keep the first sync running
      let resolveRead: ((value: { success: true; data: null }) => void) | null = null
      vi.mocked(readCloudConfig).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRead = resolve
          })
      )

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      // Start first sync (will be blocked on readCloudConfig)
      const firstSync = loadFromCloud()

      // Wait a tick for the first sync to start
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Try to start second sync while first is in progress
      const secondResult = await loadFromCloud()

      expect(secondResult.status).toBe('skipped')
      if (secondResult.status === 'skipped') {
        expect(secondResult.reason).toBe('already-syncing')
      }

      // Clean up
      resolveRead!({ success: true, data: null })
      await firstSync
    })
  })

  describe('performSync (deprecated alias)', () => {
    it('delegates to loadFromCloud', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(false)

      const result = await performSync()

      expect(result.status).toBe('skipped')
      if (result.status === 'skipped') {
        expect(result.reason).toBe('disabled')
      }
    })
  })

  describe('enableSync', () => {
    it('returns false when no drive scope', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(false)

      const result = await enableSync()

      expect(result).toBe(false)
    })

    it('clears explicitly disabled flag and loads from cloud', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)
      vi.mocked(readCloudConfig).mockResolvedValue({ success: true, data: null })

      // Simulate user had explicitly disabled sync
      localStorage.setItem('yearbird:cloud-sync-disabled', 'true')

      const result = await enableSync()

      expect(result).toBe(true)
      expect(localStorage.getItem('yearbird:cloud-sync-disabled')).toBeNull()
    })
  })

  describe('getSyncStatus additional branches', () => {
    it('returns synced when enabled and online with no error', async () => {
      const { hasDriveScope } = await import('./auth')
      const { checkDriveAccess, readCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)
      vi.mocked(checkDriveAccess).mockResolvedValue(true)
      vi.mocked(readCloudConfig).mockResolvedValue({ success: true, data: null })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      // Perform a successful load to clear any errors
      await loadFromCloud()

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
      vi.mocked(checkDriveAccess).mockResolvedValue(false)

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      // Perform a sync that will fail and set lastSyncError
      await loadFromCloud()

      const status = getSyncStatus()
      expect(status).toBe('error')
      expect(getLastSyncError()).toBe('Cannot access Google Drive')
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
    it('does nothing when no pending changes', async () => {
      const { hasDriveScope } = await import('./auth')
      const { writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      handleOnline()

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should NOT have written because no pending changes
      expect(writeCloudConfig).not.toHaveBeenCalled()
    })

    it('does nothing when sync is disabled', async () => {
      const { hasDriveScope } = await import('./auth')

      vi.mocked(hasDriveScope).mockReturnValue(false)

      // Should not throw
      handleOnline()
    })
  })

  describe('applyCloudConfigToLocal with categories', () => {
    it('calls setCategories with categories', async () => {
      const { setCategories } = await import('./categories')

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

      expect(setCategories).toHaveBeenCalled()
      const calledWith = vi.mocked(setCategories).mock.calls[0][0]
      expect(calledWith).toHaveLength(1)
      expect(calledWith[0].label).toBe('Test Category')
    })

    it('migrates v1 to v2 when applying', async () => {
      const { setCategories } = await import('./categories')

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

      expect(setCategories).toHaveBeenCalled()
      const calledWith = vi.mocked(setCategories).mock.calls[0][0]
      expect(calledWith.find((c: { id: string }) => c.id === 'custom-1')).toBeDefined()
      expect(calledWith.find((c: { id: string }) => c.id === 'work')).toBeUndefined()
      expect(calledWith.find((c: { id: string }) => c.id === 'birthdays')).toBeDefined()
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

      scheduleSyncToCloud()

      await vi.advanceTimersByTimeAsync(2500)

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

      scheduleSyncToCloud()
      await vi.advanceTimersByTimeAsync(1000)
      scheduleSyncToCloud()
      await vi.advanceTimersByTimeAsync(1000)
      scheduleSyncToCloud()

      await vi.advanceTimersByTimeAsync(3000)

      // Only called once (debounced)
      expect(writeCloudConfig).toHaveBeenCalledTimes(1)
    })

    it('does not execute write when offline, but sets pending flag', async () => {
      const { hasDriveScope } = await import('./auth')
      const { writeCloudConfig } = await import('./driveSync')

      vi.mocked(hasDriveScope).mockReturnValue(true)

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

      scheduleSyncToCloud()

      await vi.advanceTimersByTimeAsync(3000)

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

      scheduleSyncToCloud()

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

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

      scheduleSyncToCloud()

      await vi.advanceTimersByTimeAsync(3000)

      expect(getSyncSettings().lastSyncedAt).not.toBeNull()
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

      let resolveFirstWrite: (() => void) | null = null
      const firstWritePromise = new Promise<void>((resolve) => {
        resolveFirstWrite = resolve
      })

      let writeCallCount = 0
      vi.mocked(writeCloudConfig).mockImplementation(() => {
        writeCallCount++
        if (writeCallCount === 1) {
          return firstWritePromise.then(() => ({
            success: true,
            data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
          }))
        }
        return Promise.resolve({
          success: true,
          data: { id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' },
        })
      })

      saveSyncSettings({ enabled: true, lastSyncedAt: null, deviceId: 'test' })

      scheduleSyncToCloud()

      await vi.advanceTimersByTimeAsync(2500)

      scheduleSyncToCloud()

      resolveFirstWrite!()
      await vi.advanceTimersByTimeAsync(0)

      await vi.advanceTimersByTimeAsync(2500)

      expect(writeCallCount).toBe(2)
    })
  })

  describe('initSyncListeners SSR', () => {
    it('returns noop cleanup when window is undefined', async () => {
      const originalWindow = globalThis.window

      // @ts-expect-error - intentionally deleting window for SSR test
      delete globalThis.window

      vi.resetModules()
      const { initSyncListeners: initSyncListenersSSR } = await import('./syncManager')

      const cleanup = initSyncListenersSSR()

      expect(typeof cleanup).toBe('function')
      cleanup()

      globalThis.window = originalWindow
      vi.resetModules()
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

      const settings = getSyncSettings()
      expect(settings.lastSyncedAt).toBeNull()
      expect(settings.deviceId).toBe('test')
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

    it('returns error when offline', async () => {
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

      const result = await deleteCloudData()

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBe('Cannot delete cloud data while offline')
      }

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })
  })
})
