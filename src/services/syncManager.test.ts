import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  getSyncSettings,
  saveSyncSettings,
  isSyncEnabled,
  getSyncStatus,
  buildCloudConfigFromLocal,
  mergeConfigs,
  applyCloudConfigToLocal,
  clearSyncError,
  disableSync,
} from './syncManager'
import type { CloudConfig, CloudSyncSettings } from '../types/cloudConfig'

// Mock auth module
vi.mock('./auth', () => ({
  hasDriveScope: vi.fn(() => true),
}))

// Mock driveSync module
vi.mock('./driveSync', () => ({
  readCloudConfig: vi.fn(),
  writeCloudConfig: vi.fn(),
  checkDriveAccess: vi.fn(),
}))

// Mock data service modules
vi.mock('./filters', () => ({
  getFilters: vi.fn(() => []),
}))

vi.mock('./calendarVisibility', () => ({
  getDisabledCalendars: vi.fn(() => []),
}))

vi.mock('./builtInCategories', () => ({
  getDisabledBuiltInCategories: vi.fn(() => []),
}))

vi.mock('./customCategories', () => ({
  getCustomCategories: vi.fn(() => []),
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
    it('returns false when sync is disabled', () => {
      expect(isSyncEnabled()).toBe(false)
    })

    it('returns true when sync is enabled and has drive scope', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(true)

      saveSyncSettings({
        enabled: true,
        lastSyncedAt: null,
        deviceId: 'test',
      })

      expect(isSyncEnabled()).toBe(true)
    })

    it('returns false when enabled but no drive scope', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(false)

      saveSyncSettings({
        enabled: true,
        lastSyncedAt: null,
        deviceId: 'test',
      })

      expect(isSyncEnabled()).toBe(false)
    })
  })

  describe('getSyncStatus', () => {
    it('returns disabled when sync is disabled', () => {
      expect(getSyncStatus()).toBe('disabled')
    })

    it('returns needs-consent when enabled but no drive scope', async () => {
      const { hasDriveScope } = await import('./auth')
      vi.mocked(hasDriveScope).mockReturnValue(false)

      saveSyncSettings({
        enabled: true,
        lastSyncedAt: null,
        deviceId: 'test',
      })

      expect(getSyncStatus()).toBe('needs-consent')
    })
  })

  describe('mergeConfigs', () => {
    const baseConfig: CloudConfig = {
      version: 1,
      updatedAt: 1000,
      deviceId: 'device-1',
      filters: [],
      disabledCalendars: [],
      disabledBuiltInCategories: [],
      customCategories: [],
    }

    it('uses remote arrays when remote is newer', () => {
      const local: CloudConfig = {
        ...baseConfig,
        updatedAt: 1000,
        filters: [{ id: '1', pattern: 'local-filter', createdAt: 1000 }],
        disabledCalendars: ['cal-local'],
      }

      const remote: CloudConfig = {
        ...baseConfig,
        updatedAt: 2000,
        filters: [{ id: '2', pattern: 'remote-filter', createdAt: 2000 }],
        disabledCalendars: ['cal-remote'],
      }

      const merged = mergeConfigs(local, remote)

      expect(merged.filters).toEqual(remote.filters)
      expect(merged.disabledCalendars).toEqual(remote.disabledCalendars)
    })

    it('uses local arrays when local is newer', () => {
      const local: CloudConfig = {
        ...baseConfig,
        updatedAt: 2000,
        filters: [{ id: '1', pattern: 'local-filter', createdAt: 1000 }],
        disabledCalendars: ['cal-local'],
      }

      const remote: CloudConfig = {
        ...baseConfig,
        updatedAt: 1000,
        filters: [{ id: '2', pattern: 'remote-filter', createdAt: 500 }],
        disabledCalendars: ['cal-remote'],
      }

      const merged = mergeConfigs(local, remote)

      expect(merged.filters).toEqual(local.filters)
      expect(merged.disabledCalendars).toEqual(local.disabledCalendars)
    })

    it('merges custom categories by ID with updatedAt precedence', () => {
      const local: CloudConfig = {
        ...baseConfig,
        updatedAt: 1000,
        customCategories: [
          {
            id: 'cat-1' as `custom-${string}`,
            label: 'Local Category',
            color: '#ff0000',
            keywords: ['local'],
            matchMode: 'any',
            createdAt: 1000,
            updatedAt: 2000, // Newer
          },
        ],
      }

      const remote: CloudConfig = {
        ...baseConfig,
        updatedAt: 2000,
        customCategories: [
          {
            id: 'cat-1' as `custom-${string}`,
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

      expect(merged.customCategories).toHaveLength(1)
      expect(merged.customCategories[0].label).toBe('Local Category')
    })

    it('handles deletions correctly (no resurrection)', () => {
      // Local has deleted a filter (empty array)
      const local: CloudConfig = {
        ...baseConfig,
        updatedAt: 2000,
        filters: [],
      }

      // Remote still has the filter from before deletion
      const remote: CloudConfig = {
        ...baseConfig,
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
      const config: CloudConfig = {
        version: 1,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [{ id: '1', pattern: 'test', createdAt: 1000 }],
        disabledCalendars: ['cal-1'],
        disabledBuiltInCategories: ['work'],
        customCategories: [],
      }

      applyCloudConfigToLocal(config)

      const filters = JSON.parse(localStorage.getItem('yearbird:filters') || '[]')
      expect(filters).toEqual(config.filters)

      const disabledCalendars = JSON.parse(localStorage.getItem('yearbird:disabled-calendars') || '[]')
      expect(disabledCalendars).toEqual(config.disabledCalendars)

      const disabledCategories = JSON.parse(localStorage.getItem('yearbird:disabled-built-in-categories') || '[]')
      expect(disabledCategories).toEqual(config.disabledBuiltInCategories)
    })

    it('removes localStorage keys when arrays are empty', () => {
      // First set some data
      localStorage.setItem('yearbird:filters', JSON.stringify([{ id: '1', pattern: 'test', createdAt: 1000 }]))
      localStorage.setItem('yearbird:disabled-calendars', JSON.stringify(['cal-1']))

      // Apply empty config
      const config: CloudConfig = {
        version: 1,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        disabledBuiltInCategories: [],
        customCategories: [],
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
    it('sets enabled to false and clears lastSyncedAt', () => {
      saveSyncSettings({
        enabled: true,
        lastSyncedAt: 1234567890,
        deviceId: 'test-device',
      })

      disableSync()

      const settings = getSyncSettings()
      expect(settings.enabled).toBe(false)
      expect(settings.lastSyncedAt).toBeNull()
      expect(settings.deviceId).toBe('test-device')
    })
  })
})
