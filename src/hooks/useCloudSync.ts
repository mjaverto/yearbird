import { useState, useEffect, useCallback } from 'react'
import type { SyncStatus } from '../types/cloudConfig'
import { hasDriveScope, requestDriveScope } from '../services/auth'
import {
  getSyncSettings,
  getSyncStatus,
  getLastSyncError,
  clearSyncError,
  enableSync,
  disableSync,
  performSync,
  isSyncEnabled,
} from '../services/syncManager'

interface UseCloudSyncResult {
  /** Whether cloud sync is enabled */
  isEnabled: boolean
  /** Current sync status */
  status: SyncStatus
  /** Last sync error message, if any */
  error: string | null
  /** Timestamp of last successful sync */
  lastSyncedAt: number | null
  /** Whether Drive scope has been granted */
  hasDriveAccess: boolean
  /** Enable cloud sync (will request Drive scope if needed) */
  enable: () => Promise<boolean>
  /** Disable cloud sync */
  disable: () => void
  /** Force a sync now */
  syncNow: () => Promise<boolean>
  /** Clear the last error */
  clearError: () => void
}

/**
 * Hook for managing cloud sync state in React components.
 */
export function useCloudSync(): UseCloudSyncResult {
  const [isEnabled, setIsEnabled] = useState(() => isSyncEnabled())
  const [status, setStatus] = useState<SyncStatus>(() => getSyncStatus())
  const [error, setError] = useState<string | null>(() => getLastSyncError())
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(
    () => getSyncSettings().lastSyncedAt
  )
  const [hasDriveAccess, setHasDriveAccess] = useState(() => hasDriveScope())

  // Update state when settings change
  const refreshState = useCallback(() => {
    setIsEnabled(isSyncEnabled())
    setStatus(getSyncStatus())
    setError(getLastSyncError())
    setLastSyncedAt(getSyncSettings().lastSyncedAt)
    setHasDriveAccess(hasDriveScope())
  }, [])

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => refreshState()
    const handleOffline = () => refreshState()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [refreshState])

  // Listen for storage events (cross-tab sync)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'yearbird:cloud-sync-settings') {
        refreshState()
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [refreshState])

  const enable = useCallback(async (): Promise<boolean> => {
    // First check if we already have Drive scope
    if (!hasDriveScope()) {
      // Request Drive scope from user
      setStatus('syncing')
      const granted = await requestDriveScope()
      if (!granted) {
        setStatus('needs-consent')
        return false
      }
      setHasDriveAccess(true)
    }

    // Enable sync and perform initial sync
    setStatus('syncing')
    const success = await enableSync()
    refreshState()
    return success
  }, [refreshState])

  const disable = useCallback(() => {
    disableSync()
    refreshState()
  }, [refreshState])

  const syncNow = useCallback(async (): Promise<boolean> => {
    if (!isEnabled) {
      return false
    }
    setStatus('syncing')
    const success = await performSync()
    refreshState()
    return success
  }, [isEnabled, refreshState])

  const clearError = useCallback(() => {
    clearSyncError()
    setError(null)
  }, [])

  return {
    isEnabled,
    status,
    error,
    lastSyncedAt,
    hasDriveAccess,
    enable,
    disable,
    syncNow,
    clearError,
  }
}
