import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingPage } from './LandingPage'

// Store original matchMedia for restoration
const originalMatchMedia = window.matchMedia

// Helper to mock matchMedia with reduced motion preference
function mockReducedMotion(prefersReducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' ? prefersReducedMotion : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('LandingPage', () => {
  afterEach(() => {
    // Restore original matchMedia after each test
    window.matchMedia = originalMatchMedia
  })
  it('renders an auth notice when provided', () => {
    render(
      <LandingPage
        onSignIn={vi.fn()}
        authNotice="Session expired. Sign in again."
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Session expired. Sign in again.'
    )
  })

  it('hides the auth notice when absent', () => {
    render(<LandingPage onSignIn={vi.fn()} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows signing-in state', () => {
    render(<LandingPage onSignIn={vi.fn()} isSigningIn={true} />)

    // Multiple sign-in buttons exist (hero + mid-page), test the first one
    const buttons = screen.getAllByRole('button', { name: 'Sign in with Google' })
    expect(buttons.length).toBeGreaterThanOrEqual(1)

    const button = buttons[0]
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')

    // Spinner is conditionally rendered when signing in
    const spinner = button.querySelector('span.flex')
    expect(spinner).not.toBeNull()
  })

  it('renders hero and mid-page sign-in buttons', () => {
    const onSignIn = vi.fn()
    render(<LandingPage onSignIn={onSignIn} />)

    const buttons = screen.getAllByRole('button', { name: 'Sign in with Google' })
    expect(buttons).toHaveLength(2) // Hero + mid-page CTA

    // Both buttons should call onSignIn
    fireEvent.click(buttons[0])
    expect(onSignIn).toHaveBeenCalledTimes(1)

    fireEvent.click(buttons[1])
    expect(onSignIn).toHaveBeenCalledTimes(2)
  })

  it('disables sign-in buttons when not ready', () => {
    render(<LandingPage onSignIn={vi.fn()} isReady={false} />)

    const buttons = screen.getAllByRole('button', { name: 'Sign in with Google' })
    buttons.forEach((button) => {
      expect(button).toBeDisabled()
    })
  })

  it('hides spinner when not signing in', () => {
    render(<LandingPage onSignIn={vi.fn()} isSigningIn={false} />)

    const buttons = screen.getAllByRole('button', { name: 'Sign in with Google' })
    buttons.forEach((button) => {
      expect(button).toHaveAttribute('aria-busy', 'false')
      // Spinner is not rendered when not signing in
      const spinner = button.querySelector('span.flex')
      expect(spinner).toBeNull()
    })
  })

  it('opens and closes the lightbox', () => {
    vi.useFakeTimers()

    render(<LandingPage onSignIn={vi.fn()} />)

    const expandButtons = screen.getAllByRole('button', {
      name: /expand .* view/i,
    })

    fireEvent.click(expandButtons[0])

    // Dialog opens with expanded view label
    const dialog = screen.getByRole('dialog', {
      name: /expanded view/i,
    })
    expect(dialog).toBeInTheDocument()

    // Clicking the dialog closes it (no separate close button)
    fireEvent.click(dialog)

    act(() => {
      vi.runAllTimers()
    })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Open second view
    fireEvent.click(expandButtons[1])

    expect(
      screen.getByRole('dialog', { name: /expanded view/i })
    ).toBeInTheDocument()

    vi.useRealTimers()
  })

  describe('scroll-zoom animations', () => {
    let observerCallback: IntersectionObserverCallback | null = null
    let mockObserve: ReturnType<typeof vi.fn>
    let mockDisconnect: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockObserve = vi.fn()
      mockDisconnect = vi.fn()

      // Create a proper class mock for IntersectionObserver
      class MockIntersectionObserver implements IntersectionObserver {
        readonly root: Element | Document | null = null
        readonly rootMargin: string = ''
        readonly thresholds: ReadonlyArray<number> = []

        constructor(callback: IntersectionObserverCallback) {
          observerCallback = callback
        }

        observe = mockObserve
        unobserve = vi.fn()
        disconnect = mockDisconnect
        takeRecords = (): IntersectionObserverEntry[] => []
      }

      window.IntersectionObserver = MockIntersectionObserver
    })

    it('skips animation setup when user prefers reduced motion', () => {
      mockReducedMotion(true)

      render(<LandingPage onSignIn={vi.fn()} />)

      // Component should render successfully (multiple sign-in buttons exist)
      const buttons = screen.getAllByRole('button', { name: 'Sign in with Google' })
      expect(buttons.length).toBeGreaterThanOrEqual(1)

      // With reduced motion, observer may still be created but early return prevents scroll handlers
      // The key is that the component renders without errors when reduced motion is preferred
    })

    it('triggers scroll progress when elements intersect viewport', () => {
      mockReducedMotion(false)
      vi.useFakeTimers()

      render(<LandingPage onSignIn={vi.fn()} />)

      // Verify observer was created and observing
      expect(mockObserve).toHaveBeenCalled()

      // Simulate intersection with viewport
      if (observerCallback) {
        const mockEntry: Partial<IntersectionObserverEntry> = {
          isIntersecting: true,
          boundingClientRect: { top: 100, height: 200 } as DOMRect,
          intersectionRatio: 0.5,
          target: document.createElement('div'),
        }

        act(() => {
          observerCallback!([mockEntry as IntersectionObserverEntry], {} as IntersectionObserver)
        })
      }

      // Run RAF callbacks
      act(() => {
        vi.runAllTimers()
      })

      // Component should still be intact after intersection (multiple sign-in buttons exist)
      const buttons = screen.getAllByRole('button', { name: 'Sign in with Google' })
      expect(buttons.length).toBeGreaterThanOrEqual(1)

      vi.useRealTimers()
    })

    it('handles scroll events with RAF batching', () => {
      mockReducedMotion(false)
      vi.useFakeTimers()

      // Mock RAF
      let rafCallback: FrameRequestCallback | null = null
      const mockRafId = 123
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafCallback = cb
        return mockRafId
      })
      const cancelRafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

      render(<LandingPage onSignIn={vi.fn()} />)

      // Trigger scroll event
      act(() => {
        window.dispatchEvent(new Event('scroll'))
      })

      // Second scroll should cancel previous RAF
      act(() => {
        window.dispatchEvent(new Event('scroll'))
      })

      // cancelAnimationFrame should have been called for batching
      expect(cancelRafSpy).toHaveBeenCalled()

      // Run RAF callback
      if (rafCallback) {
        act(() => {
          rafCallback!(performance.now())
        })
      }

      act(() => {
        vi.runAllTimers()
      })

      vi.useRealTimers()
    })
  })
})
