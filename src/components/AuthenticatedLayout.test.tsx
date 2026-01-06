import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthenticatedLayout } from './AuthenticatedLayout'

describe('AuthenticatedLayout', () => {
  it('shows cache status, error, and disables refresh while loading', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'))

    render(
      <AuthenticatedLayout
        onSignOut={vi.fn()}
        onRefresh={vi.fn()}
        isRefreshing
        lastUpdated={new Date('2026-01-01T11:00:00.000Z')}
        isFromCache
        error="Fetch failed"
      >
        <div>Child</div>
      </AuthenticatedLayout>
    )

    expect(screen.getByRole('status')).toHaveTextContent('Fetch failed')
    fireEvent.click(screen.getByRole('button', { name: /open settings menu/i }))

    expect(screen.getByText(/cached: 1h ago/i)).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /refresh/i })).toBeDisabled()
    const helpLink = screen.getByRole('menuitem', { name: /help/i })
    expect(helpLink).toHaveAttribute('href', 'https://github.com/mjaverto/yearbird/wiki')
    expect(helpLink).toHaveAttribute('target', '_blank')

    vi.useRealTimers()
  })
})
