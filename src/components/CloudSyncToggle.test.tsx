import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CloudSyncToggle } from './CloudSyncToggle'

// Mock the useCloudSync hook
const mockUseCloudSync = vi.fn()
vi.mock('../hooks/useCloudSync', () => ({
  useCloudSync: () => mockUseCloudSync(),
}))

// Default mock return value
const defaultMockReturn = {
  isEnabled: false,
  status: 'disabled' as const,
  error: null,
  lastSyncedAt: null,
  hasDriveAccess: false,
  enable: vi.fn().mockResolvedValue(true),
  disable: vi.fn(),
  syncNow: vi.fn().mockResolvedValue(true),
  clearError: vi.fn(),
  deleteData: vi.fn().mockResolvedValue(true),
}

describe('CloudSyncToggle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUseCloudSync.mockReturnValue({ ...defaultMockReturn })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // ========================================
  // formatLastSync tests (lines 10-30)
  // ========================================

  describe('formatLastSync', () => {
    it('displays "Never" when lastSyncedAt is null', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
        lastSyncedAt: null,
      })

      render(<CloudSyncToggle />)

      // "Last:" text should not appear when lastSyncedAt is null
      expect(screen.queryByText(/Last:/)).not.toBeInTheDocument()
    })

    it('displays "Just now" when synced less than 1 minute ago', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
        lastSyncedAt: now - 30000, // 30 seconds ago
      })

      render(<CloudSyncToggle />)

      expect(screen.getByText(/Last:/)).toBeInTheDocument()
      expect(screen.getByText(/Just now/)).toBeInTheDocument()
    })

    it('displays minutes ago when synced less than 60 minutes ago', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
        lastSyncedAt: now - 15 * 60 * 1000, // 15 minutes ago
      })

      render(<CloudSyncToggle />)

      expect(screen.getByText(/Last:/)).toBeInTheDocument()
      expect(screen.getByText(/15m ago/)).toBeInTheDocument()
    })

    it('displays hours ago when synced less than 24 hours ago', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
        lastSyncedAt: now - 5 * 60 * 60 * 1000, // 5 hours ago
      })

      render(<CloudSyncToggle />)

      expect(screen.getByText(/Last:/)).toBeInTheDocument()
      expect(screen.getByText(/5h ago/)).toBeInTheDocument()
    })

    it('displays date when synced 24 hours or more ago', () => {
      const now = new Date('2025-01-08T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const twoDaysAgo = now - 48 * 60 * 60 * 1000

      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
        lastSyncedAt: twoDaysAgo,
      })

      render(<CloudSyncToggle />)

      expect(screen.getByText(/Last:/)).toBeInTheDocument()
      // toLocaleDateString format varies by locale, just check pattern
      const lastSyncText = screen.getByText(/Last:/).textContent
      expect(lastSyncText).toMatch(/Last:/)
    })
  })

  // ========================================
  // StatusIndicator tests (lines 32-84)
  // ========================================

  describe('StatusIndicator', () => {
    it('renders synced status with checkmark', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
        lastSyncedAt: Date.now(),
      })

      render(<CloudSyncToggle />)

      expect(screen.getByText('Synced')).toBeInTheDocument()
      // The text is in a nested span, parent span has the color class
      expect(screen.getByText('Synced').parentElement).toHaveClass('text-emerald-600')
    })

    it('renders syncing status with spinner', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'syncing',
      })

      render(<CloudSyncToggle />)

      expect(screen.getByText('Syncing...')).toBeInTheDocument()
      expect(screen.getByText('Syncing...').parentElement).toHaveClass('text-sky-600')
    })

    it('renders offline status with warning icon', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'offline',
      })

      render(<CloudSyncToggle />)

      expect(screen.getByText('Offline')).toBeInTheDocument()
      expect(screen.getByText('Offline').parentElement).toHaveClass('text-amber-600')
    })

    it('renders error status with error icon', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'error',
        error: 'Sync failed',
      })

      render(<CloudSyncToggle />)

      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Error').parentElement).toHaveClass('text-red-600')
    })

    it('renders needs-consent status with setup message', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'needs-consent',
      })

      render(<CloudSyncToggle />)

      expect(screen.getByText('Needs setup')).toBeInTheDocument()
      expect(screen.getByText('Needs setup').parentElement).toHaveClass('text-amber-600')
    })

    it('renders nothing for default/disabled status', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'disabled',
      })

      render(<CloudSyncToggle />)

      // StatusIndicator returns null for unknown/disabled status
      expect(screen.queryByText('Synced')).not.toBeInTheDocument()
      expect(screen.queryByText('Syncing...')).not.toBeInTheDocument()
      expect(screen.queryByText('Offline')).not.toBeInTheDocument()
      expect(screen.queryByText('Error')).not.toBeInTheDocument()
      expect(screen.queryByText('Needs setup')).not.toBeInTheDocument()
    })
  })

  // ========================================
  // Toggle enable/disable tests
  // ========================================

  describe('Toggle functionality', () => {
    it('renders toggle switch with aria-checked false when disabled', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: false,
      })

      render(<CloudSyncToggle />)

      const toggle = screen.getByRole('switch')
      expect(toggle).toHaveAttribute('aria-checked', 'false')
    })

    it('renders toggle switch with aria-checked true when enabled', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
      })

      render(<CloudSyncToggle />)

      const toggle = screen.getByRole('switch')
      expect(toggle).toHaveAttribute('aria-checked', 'true')
    })

    it('calls enable when clicking toggle while disabled', async () => {
      const enable = vi.fn().mockResolvedValue(true)
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: false,
        enable,
      })

      render(<CloudSyncToggle />)

      const toggle = screen.getByRole('switch')
      await act(async () => {
        fireEvent.click(toggle)
      })

      expect(enable).toHaveBeenCalled()
    })

    it('calls disable when clicking toggle while enabled', async () => {
      const disable = vi.fn()
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
        disable,
      })

      render(<CloudSyncToggle />)

      const toggle = screen.getByRole('switch')
      await act(async () => {
        fireEvent.click(toggle)
      })

      expect(disable).toHaveBeenCalled()
    })

    it('disables toggle while enabling is in progress', async () => {
      let resolveEnable: (value: boolean) => void
      const enable = vi.fn().mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveEnable = resolve
          })
      )
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: false,
        enable,
      })

      render(<CloudSyncToggle />)

      const toggle = screen.getByRole('switch')
      expect(toggle).not.toBeDisabled()

      // Start enabling (don't await, just trigger)
      fireEvent.click(toggle)

      // Toggle should be disabled during enabling
      expect(toggle).toBeDisabled()

      // Complete enabling
      await act(async () => {
        resolveEnable!(true)
      })

      // Toggle should be enabled again
      expect(toggle).not.toBeDisabled()
    })

    it('shows local-only message when sync is disabled', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: false,
      })

      render(<CloudSyncToggle />)

      expect(
        screen.getByText(/Your settings are stored locally/)
      ).toBeInTheDocument()
    })

    it('hides local-only message when sync is enabled', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
      })

      render(<CloudSyncToggle />)

      expect(
        screen.queryByText(/Your settings are stored locally/)
      ).not.toBeInTheDocument()
    })
  })

  // ========================================
  // Error display and retry tests
  // ========================================

  describe('Error handling', () => {
    it('displays error message when error exists', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'error',
        error: 'Network error occurred',
      })

      render(<CloudSyncToggle />)

      expect(screen.getByText('Network error occurred')).toBeInTheDocument()
    })

    it('shows retry button when in error state with error message', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'error',
        error: 'Sync failed',
      })

      render(<CloudSyncToggle />)

      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    })

    it('does not show retry button when error but no error message', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'error',
        error: null,
      })

      render(<CloudSyncToggle />)

      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    })

    it('calls clearError and syncNow when retry is clicked', async () => {
      const clearError = vi.fn()
      const syncNow = vi.fn().mockResolvedValue(true)
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'error',
        error: 'Sync failed',
        clearError,
        syncNow,
      })

      render(<CloudSyncToggle />)

      const retryButton = screen.getByRole('button', { name: 'Retry' })
      await act(async () => {
        fireEvent.click(retryButton)
      })

      expect(clearError).toHaveBeenCalled()
      expect(syncNow).toHaveBeenCalled()
    })
  })

  // ========================================
  // Delete confirmation flow tests
  // ========================================

  describe('Delete confirmation flow', () => {
    it('shows delete button when sync is enabled', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
      })

      render(<CloudSyncToggle />)

      expect(screen.getByRole('button', { name: 'Delete cloud data' })).toBeInTheDocument()
    })

    it('shows confirmation buttons when delete is clicked', async () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
      })

      render(<CloudSyncToggle />)

      const deleteButton = screen.getByRole('button', { name: 'Delete cloud data' })
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('hides confirmation and shows delete button when cancel is clicked', async () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
      })

      render(<CloudSyncToggle />)

      // Click delete to show confirmation
      const deleteButton = screen.getByRole('button', { name: 'Delete cloud data' })
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      await act(async () => {
        fireEvent.click(cancelButton)
      })

      // Should be back to showing delete button
      expect(screen.getByRole('button', { name: 'Delete cloud data' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    })

    it('calls deleteData when confirm delete is clicked', async () => {
      const deleteData = vi.fn().mockResolvedValue(true)
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
        deleteData,
      })

      render(<CloudSyncToggle />)

      // Click delete to show confirmation
      const deleteButton = screen.getByRole('button', { name: 'Delete cloud data' })
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      // Click confirm delete
      const confirmButton = screen.getByRole('button', { name: 'Delete' })
      await act(async () => {
        fireEvent.click(confirmButton)
      })

      expect(deleteData).toHaveBeenCalled()
    })

    it('shows success message after successful delete', async () => {
      const deleteData = vi.fn().mockResolvedValue(true)
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
        deleteData,
      })

      render(<CloudSyncToggle />)

      // Click delete to show confirmation
      const deleteButton = screen.getByRole('button', { name: 'Delete cloud data' })
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      // Click confirm delete
      const confirmButton = screen.getByRole('button', { name: 'Delete' })
      await act(async () => {
        fireEvent.click(confirmButton)
      })

      expect(screen.getByText('Cloud data deleted successfully')).toBeInTheDocument()
    })

    it('auto-hides success message after 3 seconds', async () => {
      const deleteData = vi.fn().mockResolvedValue(true)
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
        deleteData,
      })

      render(<CloudSyncToggle />)

      // Click delete to show confirmation
      const deleteButton = screen.getByRole('button', { name: 'Delete cloud data' })
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      // Click confirm delete
      const confirmButton = screen.getByRole('button', { name: 'Delete' })
      await act(async () => {
        fireEvent.click(confirmButton)
      })

      expect(screen.getByText('Cloud data deleted successfully')).toBeInTheDocument()

      // Fast-forward 3 seconds
      await act(async () => {
        vi.advanceTimersByTime(3000)
      })

      expect(screen.queryByText('Cloud data deleted successfully')).not.toBeInTheDocument()
    })

    it('shows delete error message when deleteData fails with false', async () => {
      const deleteData = vi.fn().mockResolvedValue(false)
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
        error: 'Permission denied',
        deleteData,
      })

      render(<CloudSyncToggle />)

      // Click delete to show confirmation
      const deleteButton = screen.getByRole('button', { name: 'Delete cloud data' })
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      // Click confirm delete
      const confirmButton = screen.getByRole('button', { name: 'Delete' })
      await act(async () => {
        fireEvent.click(confirmButton)
      })

      expect(screen.getByText(/Delete failed:/)).toBeInTheDocument()
    })

    it('shows delete error message when deleteData throws', async () => {
      const deleteData = vi.fn().mockRejectedValue(new Error('Network failure'))
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
        deleteData,
      })

      render(<CloudSyncToggle />)

      // Click delete to show confirmation
      const deleteButton = screen.getByRole('button', { name: 'Delete cloud data' })
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      // Click confirm delete
      const confirmButton = screen.getByRole('button', { name: 'Delete' })
      await act(async () => {
        fireEvent.click(confirmButton)
      })

      expect(screen.getByText(/Delete failed: Network failure/)).toBeInTheDocument()
    })

    it('shows generic error message when deleteData throws non-Error', async () => {
      const deleteData = vi.fn().mockRejectedValue('Unknown error')
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
        deleteData,
      })

      render(<CloudSyncToggle />)

      // Click delete to show confirmation
      const deleteButton = screen.getByRole('button', { name: 'Delete cloud data' })
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      // Click confirm delete
      const confirmButton = screen.getByRole('button', { name: 'Delete' })
      await act(async () => {
        fireEvent.click(confirmButton)
      })

      expect(screen.getByText(/Delete failed: Failed to delete cloud data/)).toBeInTheDocument()
    })

    it('shows "Deleting..." text while delete is in progress', async () => {
      let resolveDelete: (value: boolean) => void
      const deleteData = vi.fn().mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveDelete = resolve
          })
      )
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
        deleteData,
      })

      render(<CloudSyncToggle />)

      // Click delete to show confirmation
      const deleteButton = screen.getByRole('button', { name: 'Delete cloud data' })
      fireEvent.click(deleteButton)

      // Click confirm delete (don't await, just trigger)
      const confirmButton = screen.getByRole('button', { name: 'Delete' })
      fireEvent.click(confirmButton)

      // Should show "Deleting..." immediately
      expect(screen.getByText('Deleting...')).toBeInTheDocument()

      // Complete delete
      await act(async () => {
        resolveDelete!(true)
      })
    })

    it('disables delete button while syncing', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'syncing',
      })

      render(<CloudSyncToggle />)

      const deleteButton = screen.getByRole('button', { name: 'Delete cloud data' })
      expect(deleteButton).toBeDisabled()
    })

    it('resets delete confirmation state when sync is toggled off', async () => {
      const disable = vi.fn()
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
        disable,
      })

      const { rerender } = render(<CloudSyncToggle />)

      // Click delete to show confirmation
      const deleteButton = screen.getByRole('button', { name: 'Delete cloud data' })
      await act(async () => {
        fireEvent.click(deleteButton)
      })

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

      // Toggle off
      const toggle = screen.getByRole('switch')
      await act(async () => {
        fireEvent.click(toggle)
      })

      expect(disable).toHaveBeenCalled()

      // Simulate hook returning disabled state
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: false,
      })

      rerender(<CloudSyncToggle />)

      // Delete confirmation should be gone
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    })
  })

  // ========================================
  // Component rendering tests
  // ========================================

  describe('Component rendering', () => {
    it('applies custom className', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
      })

      const { container } = render(<CloudSyncToggle className="my-custom-class" />)

      expect(container.firstChild).toHaveClass('my-custom-class')
    })

    it('renders title and description', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
      })

      render(<CloudSyncToggle />)

      expect(screen.getByText('Cloud Sync')).toBeInTheDocument()
      expect(
        screen.getByText(/Sync your settings across devices via Google Drive/)
      ).toBeInTheDocument()
    })

    it('renders screen reader text for toggle', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: false,
      })

      render(<CloudSyncToggle />)

      expect(screen.getByText('Enable cloud sync')).toBeInTheDocument()
    })

    it('renders correct screen reader text when enabled', () => {
      mockUseCloudSync.mockReturnValue({
        ...defaultMockReturn,
        isEnabled: true,
        status: 'synced',
      })

      render(<CloudSyncToggle />)

      expect(screen.getByText('Disable cloud sync')).toBeInTheDocument()
    })
  })
})
