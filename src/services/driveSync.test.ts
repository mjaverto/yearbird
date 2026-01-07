import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock auth module before importing driveSync
vi.mock('./auth', () => ({
  getStoredAuth: vi.fn(() => ({
    accessToken: 'test-token',
    expiresAt: Date.now() + 3600000,
  })),
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Now import driveSync functions
import {
  findConfigFile,
  readCloudConfig,
  writeCloudConfig,
  deleteCloudConfig,
  checkDriveAccess,
} from './driveSync'
import type { CloudConfig } from '../types/cloudConfig'

describe('driveSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('findConfigFile', () => {
    it('returns file when found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      const result = await findConfigFile()

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('file-123')
    })

    it('returns null when no file exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      })

      const result = await findConfigFile()

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
    })

    it('returns error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ error: { message: 'Access denied' } }),
      })

      const result = await findConfigFile()

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(403)
    })
  })

  describe('readCloudConfig', () => {
    it('returns null when no config file exists', async () => {
      // Mock findConfigFile returning no files
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
    })

    it('returns validated config when file exists', async () => {
      const validConfig: CloudConfig = {
        version: 1,
        updatedAt: Date.now(),
        deviceId: 'test-device',
        filters: [],
        disabledCalendars: [],
        disabledBuiltInCategories: [],
        customCategories: [],
      }

      // Mock findConfigFile
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      // Mock file download
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(validConfig),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(true)
      expect(result.data?.version).toBe(1)
      expect(result.data?.deviceId).toBe('test-device')
    })

    it('returns error for invalid config structure', async () => {
      // Mock findConfigFile
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-123', name: 'yearbird-config.json', mimeType: 'application/json' }],
        }),
      })

      // Mock file download with invalid data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ invalid: 'data', version: 999 }),
      })

      const result = await readCloudConfig()

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(400)
      expect(result.error?.message).toContain('Invalid')
    })
  })

  describe('writeCloudConfig', () => {
    const validConfig: CloudConfig = {
      version: 1,
      updatedAt: Date.now(),
      deviceId: 'test-device',
      filters: [],
      disabledCalendars: [],
      disabledBuiltInCategories: [],
      customCategories: [],
    }

    it('creates new file when none exists', async () => {
      // Mock findConfigFile - no existing file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      })

      // Mock file creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'new-file-id', name: 'yearbird-config.json' }),
      })

      const result = await writeCloudConfig(validConfig)

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('new-file-id')

      // Verify POST was called for creation
      expect(mockFetch).toHaveBeenCalledTimes(2)
      const createCall = mockFetch.mock.calls[1]
      expect(createCall[0]).toContain('uploadType=multipart')
      expect(createCall[1].method).toBe('POST')
    })

    it('updates existing file', async () => {
      // Mock findConfigFile - existing file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'existing-file-id', name: 'yearbird-config.json' }],
        }),
      })

      // Mock file update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'existing-file-id', name: 'yearbird-config.json' }),
      })

      const result = await writeCloudConfig(validConfig)

      expect(result.success).toBe(true)

      // Verify PATCH was called for update
      expect(mockFetch).toHaveBeenCalledTimes(2)
      const updateCall = mockFetch.mock.calls[1]
      expect(updateCall[0]).toContain('existing-file-id')
      expect(updateCall[1].method).toBe('PATCH')
    })
  })

  describe('deleteCloudConfig', () => {
    it('deletes existing file', async () => {
      // Mock findConfigFile
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'file-to-delete', name: 'yearbird-config.json' }],
        }),
      })

      // Mock delete
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      })

      const result = await deleteCloudConfig()

      expect(result.success).toBe(true)

      // Verify DELETE was called
      const deleteCall = mockFetch.mock.calls[1]
      expect(deleteCall[0]).toContain('file-to-delete')
      expect(deleteCall[1].method).toBe('DELETE')
    })

    it('succeeds when no file exists', async () => {
      // Mock findConfigFile - no file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      })

      const result = await deleteCloudConfig()

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only findConfigFile called
    })
  })

  describe('checkDriveAccess', () => {
    it('returns true when API is accessible', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      })

      const result = await checkDriveAccess()

      expect(result).toBe(true)
    })

    it('returns false on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: { message: 'Token expired' } }),
      })

      const result = await checkDriveAccess()

      expect(result).toBe(false)
    })

    it('returns false when offline', async () => {
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

      const result = await checkDriveAccess()

      expect(result).toBe(false)

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })
  })

  describe('retry logic', () => {
    it('retries on 5xx errors', async () => {
      // First call fails with 500
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: { message: 'Server error' } }),
      })

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      })

      const result = await findConfigFile()

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    }, 10000) // Increase timeout for retry delays

    it('does not retry on 4xx errors (except 429)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({ error: { message: 'Access denied' } }),
      })

      const result = await findConfigFile()

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe(403)
      expect(mockFetch).toHaveBeenCalledTimes(1) // No retry
    })
  })
})
