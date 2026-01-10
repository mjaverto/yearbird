interface CalendarLoadingScreenProps {
  /** When true, triggers fade-out animation */
  isHiding?: boolean
  /** Called when fade-out animation completes */
  onHidden?: () => void
}

/**
 * Full-screen loading screen shown after authentication while calendars load.
 * Blocks the entire screen to prevent FOUC during initial data fetch.
 *
 * Uses a fade-out animation when hiding to:
 * 1. Provide a polished transition
 * 2. Give the browser time to paint the content underneath
 */
export function CalendarLoadingScreen({ isHiding = false, onHidden }: CalendarLoadingScreenProps) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-300 ${
        isHiding ? 'opacity-0' : 'opacity-100'
      }`}
      onTransitionEnd={(e) => {
        // Only respond to opacity transition on this element
        if (e.propertyName === 'opacity' && isHiding && onHidden) {
          onHidden()
        }
      }}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Logo with glow effect */}
        <div className="relative">
          <div className="absolute -inset-8 rounded-full bg-amber-100/60 blur-3xl" />
          <img
            src="/eagle.svg"
            alt="Yearbird"
            className="relative h-16 w-16 float-bird"
          />
        </div>

        {/* App name */}
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Yearbird
        </h1>

        {/* Loading indicator */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">
            Loading your calendars
          </p>
        </div>
      </div>
    </div>
  )
}
