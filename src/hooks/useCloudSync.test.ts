import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCloudSync } from './useCloudSync'

// Mock auth module
vi.mock('../services/auth', () => ({
  hasDriveScope: vi.fn(() => false),
  requestDriveScope: vi.fn(() => Promise.resolve(false)),
}))

// Mock syncManager module
vi.mock('../services/syncManager', () => ({
  getSyncSettings: vi.fn(() => ({
    enabled: false,
    lastSyncedAt: null,
    deviceId: 'test-device',
  })),
  getSyncStatus: vi.fn(() => 'disabled'),
  getLastSyncError: vi.fn(() => null),
  clearSyncError: vi.fn(),
  enableSync: vi.fn(() => Promise.resolve(true)),
  disableSync: vi.fn(),
  performSync: vi.fn(() => Promise.resolve({ status: 'success' })),
  isSyncEnabled: vi.fn(() => false),
  initSyncListeners: vi.fn(() => vi.fn()),
  deleteCloudData: vi.fn(() => Promise.resolve({ status: 'success' })),
}))

describe('useCloudSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('returns initial state correctly', () => {
    const { result } = renderHook(() => useCloudSync())

    expect(result.current.isEnabled).toBe(false)
    expect(result.current.status).toBe('disabled')
    expect(result.current.error).toBeNull()
    expect(result.current.lastSyncedAt).toBeNull()
    expect(result.current.hasDriveAccess).toBe(false)
  })

  it('calls initSyncListeners on mount and cleanup on unmount', async () => {
    const { initSyncListeners } = await import('../services/syncManager')
    const cleanup = vi.fn()
    vi.mocked(initSyncListeners).mockReturnValue(cleanup)

    const { unmount } = renderHook(() => useCloudSync())

    expect(initSyncListeners).toHaveBeenCalled()

    unmount()

    expect(cleanup).toHaveBeenCalled()
  })

  it('enable returns false when Drive scope is not granted', async () => {
    const { hasDriveScope, requestDriveScope } = await import('../services/auth')
    vi.mocked(hasDriveScope).mockReturnValue(false)
    vi.mocked(requestDriveScope).mockResolvedValue(false)

    const { result } = renderHook(() => useCloudSync())

    let success: boolean
    await act(async () => {
      success = await result.current.enable()
    })

    expect(success!).toBe(false)
    expect(requestDriveScope).toHaveBeenCalled()
  })

  it('enable succeeds when Drive scope is granted', async () => {
    const { hasDriveScope, requestDriveScope } = await import('../services/auth')
    const { enableSync } = await import('../services/syncManager')

    vi.mocked(hasDriveScope).mockReturnValue(false)
    vi.mocked(requestDriveScope).mockResolvedValue(true)
    vi.mocked(enableSync).mockResolvedValue(true)

    const { result } = renderHook(() => useCloudSync())

    let success: boolean
    await act(async () => {
      success = await result.current.enable()
    })

    expect(success!).toBe(true)
    expect(enableSync).toHaveBeenCalled()
  })

  it('enable succeeds when Drive scope is already granted', async () => {
    const { hasDriveScope } = await import('../services/auth')
    const { enableSync } = await import('../services/syncManager')

    vi.mocked(hasDriveScope).mockReturnValue(true)
    vi.mocked(enableSync).mockResolvedValue(true)

    const { result } = renderHook(() => useCloudSync())

    let success: boolean
    await act(async () => {
      success = await result.current.enable()
    })

    expect(success!).toBe(true)
  })

  it('disable calls disableSync', async () => {
    const { disableSync } = await import('../services/syncManager')

    const { result } = renderHook(() => useCloudSync())

    act(() => {
      result.current.disable()
    })

    expect(disableSync).toHaveBeenCalled()
  })

  it('syncNow returns false when not enabled', async () => {
    const { isSyncEnabled } = await import('../services/syncManager')
    vi.mocked(isSyncEnabled).mockReturnValue(false)

    const { result } = renderHook(() => useCloudSync())

    let success: boolean
    await act(async () => {
      success = await result.current.syncNow()
    })

    expect(success!).toBe(false)
  })

  it('syncNow is callable and returns false when not enabled', async () => {
    const { isSyncEnabled } = await import('../services/syncManager')
    vi.mocked(isSyncEnabled).mockReturnValue(false)

    const { result } = renderHook(() => useCloudSync())

    let success: boolean
    await act(async () => {
      success = await result.current.syncNow()
    })

    expect(success!).toBe(false)
  })

  it('clearError clears the sync error', async () => {
    const { clearSyncError } = await import('../services/syncManager')

    const { result } = renderHook(() => useCloudSync())

    act(() => {
      result.current.clearError()
    })

    expect(clearSyncError).toHaveBeenCalled()
  })

  it('refreshes state on storage event for sync settings', async () => {
    const { getSyncSettings, getSyncStatus, isSyncEnabled, getLastSyncError } = await import('../services/syncManager')
    const { hasDriveScope } = await import('../services/auth')

    vi.mocked(getSyncSettings).mockReturnValue({
      enabled: true,
      lastSyncedAt: 1234567890,
      deviceId: 'new-device',
    })
    vi.mocked(getSyncStatus).mockReturnValue('synced')
    vi.mocked(isSyncEnabled).mockReturnValue(true)
    vi.mocked(getLastSyncError).mockReturnValue(null)
    vi.mocked(hasDriveScope).mockReturnValue(true)

    renderHook(() => useCloudSync())

    // Simulate storage event
    await act(async () => {
      const event = new StorageEvent('storage', {
        key: 'yearbird:cloud-sync-settings',
      })
      window.dispatchEvent(event)
    })

    // The state should be refreshed
    await waitFor(() => {
      expect(getSyncStatus).toHaveBeenCalled()
    })
  })

  it('ignores storage events for other keys', async () => {
    const { getSyncStatus } = await import('../services/syncManager')

    renderHook(() => useCloudSync())

    const callCount = vi.mocked(getSyncStatus).mock.calls.length

    // Simulate storage event for different key
    await act(async () => {
      const event = new StorageEvent('storage', {
        key: 'yearbird:other-key',
      })
      window.dispatchEvent(event)
    })

    // getSyncStatus should not have been called again
    expect(vi.mocked(getSyncStatus).mock.calls.length).toBe(callCount)
  })

  it('refreshes state on online event', async () => {
    const { getSyncStatus } = await import('../services/syncManager')

    renderHook(() => useCloudSync())

    const callCount = vi.mocked(getSyncStatus).mock.calls.length

    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })

    expect(vi.mocked(getSyncStatus).mock.calls.length).toBeGreaterThan(callCount)
  })

  it('refreshes state on offline event', async () => {
    const { getSyncStatus } = await import('../services/syncManager')

    renderHook(() => useCloudSync())

    const callCount = vi.mocked(getSyncStatus).mock.calls.length

    await act(async () => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(vi.mocked(getSyncStatus).mock.calls.length).toBeGreaterThan(callCount)
  })

  it('cleans up event listeners on unmount', async () => {
    const { initSyncListeners } = await import('../services/syncManager')
    const cleanup = vi.fn()
    vi.mocked(initSyncListeners).mockReturnValue(cleanup)

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useCloudSync())

    // Should have added event listeners
    expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))
    expect(addEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function))

    unmount()

    // Should have removed event listeners
    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function))
    expect(cleanup).toHaveBeenCalled()

    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })

  it('enable calls requestDriveScope when no drive access', async () => {
    const { hasDriveScope, requestDriveScope } = await import('../services/auth')
    const { enableSync } = await import('../services/syncManager')

    // Initially no drive scope
    vi.mocked(hasDriveScope).mockReturnValue(false)
    // Request scope fails
    vi.mocked(requestDriveScope).mockResolvedValue(false)
    vi.mocked(enableSync).mockResolvedValue(true)

    const { result } = renderHook(() => useCloudSync())

    await act(async () => {
      const success = await result.current.enable()
      expect(success).toBe(false)
    })

    expect(requestDriveScope).toHaveBeenCalled()
  })

  it('deleteData calls deleteCloudData and returns true on success', async () => {
    const { deleteCloudData } = await import('../services/syncManager')
    vi.mocked(deleteCloudData).mockResolvedValue({ status: 'success' })

    const { result } = renderHook(() => useCloudSync())

    let success: boolean
    await act(async () => {
      success = await result.current.deleteData()
    })

    expect(success!).toBe(true)
    expect(deleteCloudData).toHaveBeenCalled()
  })

  it('deleteData returns false on error', async () => {
    const { deleteCloudData } = await import('../services/syncManager')
    vi.mocked(deleteCloudData).mockResolvedValue({ status: 'error', message: 'Failed' })

    const { result } = renderHook(() => useCloudSync())

    let success: boolean
    await act(async () => {
      success = await result.current.deleteData()
    })

    expect(success!).toBe(false)
  })
})
