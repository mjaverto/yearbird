import { useState } from 'react'
import type { SyncStatus } from '../types/cloudConfig'
import { useCloudSync } from '../hooks/useCloudSync'
import { Button } from './ui/button'

interface CloudSyncToggleProps {
  className?: string
}

function formatLastSync(timestamp: number | null): string {
  if (!timestamp) {
    return 'Never'
  }
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) {
    return 'Just now'
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`
  }
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  return date.toLocaleDateString()
}

function StatusIndicator({ status }: { status: SyncStatus }) {
  switch (status) {
    case 'synced':
      return (
        <span className="flex items-center gap-1 text-emerald-600">
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path d="M10 3L4.5 8.5 2 6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xs">Synced</span>
        </span>
      )
    case 'syncing':
      return (
        <span className="flex items-center gap-1 text-sky-600">
          <svg className="h-3 w-3 animate-spin" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="5" />
          </svg>
          <span className="text-xs">Syncing...</span>
        </span>
      )
    case 'offline':
      return (
        <span className="flex items-center gap-1 text-amber-600">
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path d="M6 1v6M6 9v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-xs">Offline</span>
        </span>
      )
    case 'error':
      return (
        <span className="flex items-center gap-1 text-red-600">
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M6 4v3M6 8.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-xs">Error</span>
        </span>
      )
    case 'needs-consent':
      return (
        <span className="flex items-center gap-1 text-amber-600">
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path d="M6 1L11 11H1L6 1z" stroke="currentColor" strokeWidth="1" fill="none" />
            <path d="M6 5v2M6 8.5v.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
          <span className="text-xs">Needs setup</span>
        </span>
      )
    default:
      return null
  }
}

/**
 * Cloud sync toggle component for the settings panel.
 * Allows users to enable/disable sync with Google Drive appDataFolder.
 */
export function CloudSyncToggle({ className }: CloudSyncToggleProps) {
  const {
    isEnabled,
    status,
    error,
    lastSyncedAt,
    enable,
    disable,
    syncNow,
    clearError,
    deleteData,
  } = useCloudSync()

  const [isEnabling, setIsEnabling] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteSuccess, setDeleteSuccess] = useState(false)

  const handleToggle = async () => {
    if (isEnabled) {
      disable()
    } else {
      setIsEnabling(true)
      try {
        await enable()
      } finally {
        setIsEnabling(false)
      }
    }
  }

  const handleRetry = async () => {
    clearError()
    await syncNow()
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError(null)
    setDeleteSuccess(false)
    try {
      const success = await deleteData()
      if (success) {
        setShowDeleteConfirm(false)
        setDeleteSuccess(true)
        // Auto-hide success message after 3 seconds
        setTimeout(() => setDeleteSuccess(false), 3000)
      } else {
        setDeleteError(error || 'Failed to delete cloud data')
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete cloud data')
    } finally {
      setIsDeleting(false)
    }
  }

  // Reset delete confirmation when sync is toggled off
  const handleToggleWithReset = async () => {
    if (isEnabled) {
      setShowDeleteConfirm(false)
      setDeleteError(null)
      setDeleteSuccess(false)
    }
    await handleToggle()
  }

  return (
    <div className={`rounded-lg border border-zinc-200 bg-zinc-50 p-3 ${className || ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-zinc-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
            </svg>
            <h4 className="text-sm font-medium text-zinc-900">Cloud Sync</h4>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Sync your settings across devices via Google Drive.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          disabled={isEnabling}
          onClick={handleToggleWithReset}
          className={`
            relative inline-flex h-6 w-10 flex-shrink-0 cursor-pointer rounded-full
            border-2 border-transparent transition-colors duration-200 ease-in-out
            focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2
            disabled:opacity-50 disabled:cursor-wait
            ${isEnabled ? 'bg-sky-500' : 'bg-zinc-300'}
          `}
        >
          <span className="sr-only">
            {isEnabled ? 'Disable cloud sync' : 'Enable cloud sync'}
          </span>
          <span
            aria-hidden="true"
            className={`
              pointer-events-none inline-block h-5 w-5 transform rounded-full
              bg-white shadow ring-0 transition duration-200 ease-in-out
              ${isEnabled ? 'translate-x-4' : 'translate-x-0'}
            `}
          />
        </button>
      </div>

      {isEnabled && (
        <div className="mt-2 flex items-center justify-between border-t border-zinc-200 pt-2">
          <div className="flex items-center gap-2">
            <StatusIndicator status={status} />
            {status === 'synced' && lastSyncedAt && (
              <span className="text-xs text-zinc-400">
                Last: {formatLastSync(lastSyncedAt)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {status === 'error' && error && (
              <Button plain onClick={handleRetry} className="text-xs">
                Retry
              </Button>
            )}
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={status === 'syncing' || isDeleting}
                className="p-1 text-zinc-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                title="Delete cloud data"
                aria-label="Delete cloud data"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  plain
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
                <Button
                  plain
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="text-xs"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 rounded bg-red-50 p-2">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {deleteError && (
        <div className="mt-2 rounded bg-red-50 p-2" role="alert">
          <p className="text-xs text-red-600">Delete failed: {deleteError}</p>
        </div>
      )}

      {deleteSuccess && (
        <div className="mt-2 rounded bg-emerald-50 p-2" role="status" aria-live="polite">
          <p className="text-xs text-emerald-600">Cloud data deleted successfully</p>
        </div>
      )}

      {!isEnabled && (
        <p className="mt-2 text-xs text-zinc-400">
          Your settings are stored locally. Enable sync to access them on other devices.
        </p>
      )}
    </div>
  )
}
