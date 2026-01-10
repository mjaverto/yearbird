import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileNudge } from './MobileNudge'

const STORAGE_KEY = 'yearbird:mobile-nudge-dismissed'
const PHONE_MAX_WIDTH = 640

describe('MobileNudge', () => {
  let originalInnerWidth: number

  beforeEach(() => {
    originalInnerWidth = window.innerWidth
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    })
  })

  const setViewportWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    })
    window.dispatchEvent(new Event('resize'))
  }

  it('shows on phone-sized screens', () => {
    setViewportWidth(PHONE_MAX_WIDTH)
    render(<MobileNudge />)

    expect(screen.getByText(/365 days on a phone/i)).toBeInTheDocument()
  })

  it('does not show on tablet/desktop screens', () => {
    setViewportWidth(PHONE_MAX_WIDTH + 1)
    render(<MobileNudge />)

    expect(screen.queryByText(/365 days on a phone/i)).not.toBeInTheDocument()
  })

  it('can be dismissed', async () => {
    setViewportWidth(PHONE_MAX_WIDTH)
    render(<MobileNudge />)

    const dismissButton = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismissButton)

    // Wait for animation timeout (200ms + buffer)
    await vi.waitFor(
      () => {
        expect(screen.queryByText(/365 days on a phone/i)).not.toBeInTheDocument()
      },
      { timeout: 500 }
    )
  })

  it('persists dismissal in localStorage', async () => {
    setViewportWidth(PHONE_MAX_WIDTH)
    render(<MobileNudge />)

    const dismissButton = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismissButton)

    // Wait for localStorage to be set
    await vi.waitFor(
      () => {
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
      },
      { timeout: 500 }
    )
  })

  it('does not show if already dismissed', () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setViewportWidth(PHONE_MAX_WIDTH)
    render(<MobileNudge />)

    expect(screen.queryByText(/365 days on a phone/i)).not.toBeInTheDocument()
  })

  it('responds to window resize', () => {
    // Start on phone size
    setViewportWidth(PHONE_MAX_WIDTH)
    const { rerender } = render(<MobileNudge />)
    expect(screen.getByText(/365 days on a phone/i)).toBeInTheDocument()

    // Resize to desktop
    setViewportWidth(PHONE_MAX_WIDTH + 100)
    rerender(<MobileNudge />)

    expect(screen.queryByText(/365 days on a phone/i)).not.toBeInTheDocument()
  })

  it('has accessible dismiss button', () => {
    setViewportWidth(PHONE_MAX_WIDTH)
    render(<MobileNudge />)

    const dismissButton = screen.getByRole('button', { name: /dismiss/i })
    expect(dismissButton).toBeInTheDocument()
  })

  it('uses status role for screen readers', () => {
    setViewportWidth(PHONE_MAX_WIDTH)
    render(<MobileNudge />)

    const banner = screen.getByRole('status')
    expect(banner).toHaveAttribute('aria-live', 'polite')
  })
})
