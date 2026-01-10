import { useState, useEffect } from 'react'

const STORAGE_KEY = 'yearbird:mobile-nudge-dismissed'
const PHONE_MAX_WIDTH = 640 // phones only, not tablets

/**
 * A dismissible bottom banner that nudges phone users toward desktop.
 * Only shows on narrow viewports (phones, not tablets).
 */
export function MobileNudge() {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)

  useEffect(() => {
    // Check if already dismissed
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') {
        return
      }
    } catch {
      // localStorage not available, show banner anyway
    }

    // Only show on phone-sized screens (narrow width)
    const checkWidth = () => {
      const isPhone = window.innerWidth <= PHONE_MAX_WIDTH
      setIsVisible(isPhone)
    }

    checkWidth()
    window.addEventListener('resize', checkWidth)
    return () => window.removeEventListener('resize', checkWidth)
  }, [])

  const handleDismiss = () => {
    setIsDismissing(true)
    // Wait for animation, then hide
    setTimeout(() => {
      setIsVisible(false)
      try {
        localStorage.setItem(STORAGE_KEY, 'true')
      } catch {
        // localStorage not available
      }
    }, 200)
  }

  if (!isVisible) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 bottom-0 z-50 safe-area-pb transition-all duration-200 ${
        isDismissing ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <div className="mx-2 mb-2 flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 shadow-lg backdrop-blur-sm">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900">
            365 days on a phone? Bold move. 🦅
          </p>
          <p className="mt-0.5 text-xs text-amber-700/80">
            Yearbird shines on a bigger screen—try desktop for the full view.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-full p-1.5 text-amber-600 transition hover:bg-amber-100 hover:text-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
          aria-label="Dismiss"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
