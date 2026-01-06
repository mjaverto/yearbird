import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

interface LandingPageProps {
  onSignIn: () => void
  authNotice?: string | null
  isReady?: boolean
  isSigningIn?: boolean
  // TV Mode props
  useTvMode?: boolean
  isGisUnavailable?: boolean
  onTvSignIn?: () => void
  onToggleTvMode?: (enabled: boolean) => void
}

const IMAGE_WIDTH = 1280
const IMAGE_HEIGHT = 831
const HERO_SIZES = '100vw'
const SCREENSHOT_SIZES = '(min-width: 1024px) 55vw, (min-width: 640px) 88vw, 92vw'
const LIGHTBOX_ANIMATION_MS = 220

const buildImage = (name: string) => ({
  src: `/marketing/${name}.png`,
  avif: `/marketing/${name}-1280.avif 1280w, /marketing/${name}-1920.avif 1920w`,
  webp: `/marketing/${name}-1280.webp 1280w, /marketing/${name}-1920.webp 1920w`,
  png: `/marketing/${name}.png 1280w, /marketing/${name}-1920.png 1920w`,
})

const heroImage = buildImage('year-grid')

const screenshotRowClass = (reverse: boolean) =>
  [
    'grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center',
    reverse ? 'lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1' : null,
  ]
    .filter(Boolean)
    .join(' ')

const statCards = [
  {
    id: 'time-horizon',
    label: 'Time horizon',
    value: '365 days',
    body: 'Full-year visibility beats day-to-day, week-to-week thrash.',
  },
  {
    id: 'momentum',
    label: 'Focus',
    value: 'In control',
    body: 'Plan for you first. See tradeoffs before they become regrets.',
  },
  {
    id: 'security',
    label: 'Privacy',
    value: 'Read-only',
    body: 'No writes. Your calendar stays yours. We never see your data—everything runs in your browser.',
  },
]

// Focal points define where to zoom into each screenshot (percentage from top-left)
// These are tuned to highlight the key UI feature in each image
interface FocalPoint {
  x: number // 0-100, percentage from left
  y: number // 0-100, percentage from top
}

const screenshotRows = [
  {
    id: 'portfolio-themes',
    eyebrow: 'Goal themes',
    title: 'Color your year by what matters.',
    body: 'See goals, projects, and life lanes without the noise.',
    image: buildImage('filters-categories'),
    alt: 'Filters panel showing strategic categories alongside the full-year view',
    reverse: false,
    focalPoint: { x: 50, y: 45 } as FocalPoint, // Center on the filters modal
    panY: -20, // Pan upward after zoom (only this one gets pan)
  },
  {
    id: 'monthly-focus',
    eyebrow: 'Monthly focus',
    title: 'Zoom in without losing the year.',
    body: 'Stay on the months that decide everything.',
    image: buildImage('month-scroll'),
    alt: 'Month scroll view showing focused months in the year calendar',
    reverse: true,
    focalPoint: { x: 10, y: 10 } as FocalPoint, // Zoom toward top-left corner
  },
  {
    id: 'instant-detail',
    eyebrow: 'Instant detail',
    title: 'Get the detail, keep the grid.',
    body: 'Stay in flow while decisions are still fresh.',
    image: buildImage('event-tooltip'),
    alt: 'Tooltip detail view highlighting a specific calendar event',
    reverse: false,
    focalPoint: { x: 50, y: 10 } as FocalPoint, // Zoom toward top-center
  },
]

type ScreenshotRow = (typeof screenshotRows)[number]

const decisionBullets = [
  { id: 'overloaded-months', text: 'Spot overloaded months before they break the plan.' },
  { id: 'deep-work', text: 'Protect focus time like a top performer.' },
  { id: 'priorities', text: 'Align personal, team, and life goals in one view.' },
]

const decisionCards = [
  {
    id: 'milestone-weeks',
    title: 'Milestone weeks',
    body: 'Set the weeks that make the year.',
  },
  {
    id: 'protected-time',
    title: 'Protected time',
    body: 'Block the focus that moves the needle.',
  },
  {
    id: 'theme-filters',
    title: 'Theme filters',
    body: 'Flip between goals, projects, and life lanes fast.',
  },
  {
    id: 'signal-over-noise',
    title: 'Signal over noise',
    body: 'Strip the year down to what actually matters.',
  },
]

interface OriginRect {
  top: number
  left: number
  width: number
  height: number
}

interface ScreenshotLightboxProps {
  activeShot: ScreenshotRow | null
  originRect: OriginRect | null
  isAnimatingIn: boolean
  isClosing: boolean
  onClose: () => void
}

function ScreenshotLightbox({
  activeShot,
  originRect,
  isAnimatingIn,
  isClosing,
  onClose,
}: ScreenshotLightboxProps) {
  if (!activeShot || !originRect) {
    return null
  }

  const isExpanded = isAnimatingIn && !isClosing

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${activeShot.title} expanded view`}
      className="fixed inset-0 z-50 cursor-zoom-out"
      onClick={onClose}
    >
      {/* Backdrop blur only - no dark background */}
      <div
        className={`absolute inset-0 backdrop-blur-md transition-all duration-300 ease-out ${
          isExpanded ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      />

      {/* Image container that animates from origin to center */}
      <div
        className="absolute transition-all duration-300 ease-out overflow-hidden rounded-2xl shadow-2xl"
        style={
          isExpanded
            ? {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(90vw, 1200px)',
                height: 'auto',
                maxHeight: '85vh',
              }
            : {
                top: originRect.top,
                left: originRect.left,
                width: originRect.width,
                height: originRect.height,
                transform: 'translate(0, 0)',
              }
        }
      >
        <picture>
          <source type="image/avif" srcSet={activeShot.image.avif} sizes="100vw" />
          <source type="image/webp" srcSet={activeShot.image.webp} sizes="100vw" />
          <img
            src={activeShot.image.src}
            srcSet={activeShot.image.png}
            sizes="100vw"
            alt={activeShot.alt}
            width={IMAGE_WIDTH}
            height={IMAGE_HEIGHT}
            loading="eager"
            decoding="async"
            className="w-full h-full object-contain"
          />
        </picture>
      </div>
    </div>
  )
}

function useScreenshotLightbox() {
  const [activeShot, setActiveShot] = useState<ScreenshotRow | null>(null)
  const [originRect, setOriginRect] = useState<OriginRect | null>(null)
  const [isAnimatingIn, setIsAnimatingIn] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const timerRef = useRef<number | null>(null)

  const openShot = useCallback((shot: ScreenshotRow, event: React.MouseEvent) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    // Capture the bounding rect of the clicked element
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    setOriginRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    })

    setIsClosing(false)
    setIsAnimatingIn(false)
    setActiveShot(shot)

    // Trigger expand animation on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsAnimatingIn(true)
      })
    })
  }, [])

  const closeShot = useCallback(() => {
    if (!activeShot || isClosing) {
      return
    }
    setIsClosing(true)
    timerRef.current = window.setTimeout(() => {
      setActiveShot(null)
      setOriginRect(null)
      setIsAnimatingIn(false)
      setIsClosing(false)
    }, LIGHTBOX_ANIMATION_MS + 100) // Slightly longer to ensure animation completes
  }, [activeShot, isClosing])

  useEffect(() => {
    if (!activeShot) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeShot()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeShot, closeShot])

  useEffect(() => {
    if (!activeShot) {
      return
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [activeShot])

  useEffect(
    () => () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
    },
    [],
  )

  return {
    openShot,
    lightbox: (
      <ScreenshotLightbox
        activeShot={activeShot}
        originRect={originRect}
        isAnimatingIn={isAnimatingIn}
        isClosing={isClosing}
        onClose={closeShot}
      />
    ),
  }
}

// ============================================================================
// Scroll-Reveal Zoom Animation
// ============================================================================
// Two-phase animation:
// Phase 1: Zoom IN toward the focal point
// Phase 2: Pan upward while staying zoomed (Ken Burns style)

const SCROLL_ZOOM_CONFIG = {
  startScale: 1.0, // Start at normal size
  endScale: 2.2, // Zoom IN 120% toward focal point
  startOpacity: 1.0,
  endOpacity: 1.0,
  // For images with pan: zoom completes at 50%, then pan takes over
  zoomEnd: 0.5,
  // Delay before animation starts (in rem, converted to px at runtime)
  delayRem: 30, // Wait ~480px (30rem) after element enters viewport
  // Animation completes over this portion of element height
  triggerEnd: 0.85,
} as const

// Subscribe to prefers-reduced-motion media query changes
const subscribeToReducedMotion = (callback: () => void): (() => void) => {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  mediaQuery.addEventListener('change', callback)
  return () => mediaQuery.removeEventListener('change', callback)
}

// Get current reduced motion preference
const getReducedMotionSnapshot = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// SSR fallback - assume no reduced motion preference
const getReducedMotionServerSnapshot = (): boolean => false

// Prefers-reduced-motion hook using useSyncExternalStore for proper SSR handling
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  )
}

// Attempt at easeOutCubic for smooth deceleration - feels natural for zoom-out
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)

interface ScrollZoomState {
  scale: number
  opacity: number
  transformOrigin: string
  translateY: number // percentage
}

function useScrollRevealZoom(
  focalPoint: FocalPoint,
  prefersReducedMotion: boolean,
  panY?: number, // Optional: pan amount after zoom (only some images pan)
): {
  ref: React.RefObject<HTMLDivElement>
  style: ScrollZoomState
} {
  const ref = useRef<HTMLDivElement>(null!)
  // Initialize to 1 (fully revealed) if reduced motion preferred, 0 otherwise
  const [progress, setProgress] = useState(() => (prefersReducedMotion ? 1 : 0))
  const rafRef = useRef<number | null>(null)

  // Memoize transform origin string
  const transformOrigin = useMemo(
    () => `${focalPoint.x}% ${focalPoint.y}%`,
    [focalPoint.x, focalPoint.y],
  )

  useEffect(() => {
    // Skip animation setup entirely if user prefers reduced motion
    if (prefersReducedMotion) {
      return
    }

    const element = ref.current
    if (!element) return

    // Calculate animation progress based on element's position in viewport
    const updateProgress = () => {
      const rect = element.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const { delayRem, triggerEnd } = SCROLL_ZOOM_CONFIG

      // Convert rem to px (scales with user's font size)
      const remToPx = parseFloat(getComputedStyle(document.documentElement).fontSize)
      const delayPx = delayRem * remToPx

      // Animation trigger point: element top must be this far up from viewport bottom
      const triggerPoint = viewportHeight - delayPx

      // If element top is still below trigger point, no animation yet
      if (rect.top > triggerPoint) {
        setProgress(0)
        return
      }

      // How far past the trigger point (0 = just triggered, positive = scrolled further)
      const pixelsPastTrigger = triggerPoint - rect.top

      // Animation completes over this many pixels of scroll
      const animationRange = rect.height * triggerEnd
      const rawProgress = pixelsPastTrigger / animationRange

      // Clamp between 0 and 1, then apply easing
      const clampedProgress = Math.max(0, Math.min(1, rawProgress))
      const easedProgress = easeOutCubic(clampedProgress)

      setProgress(easedProgress)
    }

    // Use Intersection Observer for efficient initial detection
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Element is visible, start tracking scroll
            updateProgress()
          }
        })
      },
      {
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        rootMargin: '50px 0px',
      },
    )

    observer.observe(element)

    // Scroll handler for smooth progress updates
    const handleScroll = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      rafRef.current = requestAnimationFrame(updateProgress)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })

    // Initial calculation via scroll handler to use RAF
    handleScroll()

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [prefersReducedMotion])

  // Calculate current animation values based on progress
  const style = useMemo((): ScrollZoomState => {
    const { startScale, endScale, startOpacity, endOpacity, zoomEnd } = SCROLL_ZOOM_CONFIG

    // If no pan, zoom takes full progress range
    // If pan enabled, zoom completes at zoomEnd, then pan takes over
    const hasPan = panY !== undefined

    let scale: number
    let translateY = 0

    if (hasPan) {
      // Two-phase: Zoom (0 to zoomEnd), then Pan (zoomEnd to 1)
      const zoomProgress = Math.min(progress / zoomEnd, 1)
      scale = startScale + (endScale - startScale) * easeOutCubic(zoomProgress)

      // Pan only starts after zoom completes
      if (progress > zoomEnd) {
        const panProgress = (progress - zoomEnd) / (1 - zoomEnd)
        translateY = panY * easeOutCubic(panProgress)
      }
    } else {
      // Zoom only - takes full progress range
      scale = startScale + (endScale - startScale) * easeOutCubic(progress)
    }

    return {
      scale,
      opacity: startOpacity + (endOpacity - startOpacity) * progress,
      transformOrigin,
      translateY,
    }
  }, [progress, transformOrigin, panY])

  return { ref, style }
}

interface ScrollZoomImageProps {
  item: ScreenshotRow
  onExpand: (item: ScreenshotRow, event: React.MouseEvent) => void
  prefersReducedMotion: boolean
}

function ScrollZoomImage({ item, onExpand, prefersReducedMotion }: ScrollZoomImageProps) {
  const panY = 'panY' in item ? (item.panY as number) : undefined
  const { ref, style } = useScrollRevealZoom(item.focalPoint, prefersReducedMotion, panY)

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={(e) => onExpand(item, e)}
        className="group relative block w-full overflow-hidden rounded-2xl border border-zinc-100 shadow-xl transition-shadow hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 cursor-zoom-in"
        aria-label={`Expand ${item.title} view`}
        style={{
          // GPU-accelerated properties only for smooth animation
          willChange: prefersReducedMotion ? 'auto' : 'transform, opacity',
        }}
      >
        <picture>
          <source type="image/avif" srcSet={item.image.avif} sizes={SCREENSHOT_SIZES} />
          <source type="image/webp" srcSet={item.image.webp} sizes={SCREENSHOT_SIZES} />
          <img
            src={item.image.src}
            srcSet={item.image.png}
            sizes={SCREENSHOT_SIZES}
            alt={item.alt}
            width={IMAGE_WIDTH}
            height={IMAGE_HEIGHT}
            loading="lazy"
            decoding="async"
            className="w-full transition-transform duration-300 ease-out group-hover:scale-[1.02]"
            style={{
              transform: `scale(${style.scale}) translateY(${style.translateY}%)`,
              opacity: style.opacity,
              transformOrigin: style.transformOrigin,
              // Smooth transition for the scroll-driven animation
              transition: prefersReducedMotion
                ? 'none'
                : 'transform 0.1s ease-out, opacity 0.1s ease-out',
            }}
          />
        </picture>
      </button>
    </div>
  )
}

export function LandingPage({
  onSignIn,
  authNotice,
  isReady = true,
  isSigningIn = false,
  useTvMode = false,
  isGisUnavailable = false,
  onTvSignIn,
  onToggleTvMode,
}: LandingPageProps) {
  const { openShot, lightbox } = useScreenshotLightbox()
  const prefersReducedMotion = usePrefersReducedMotion()

  // Determine if we should show TV mode UI
  // Show when: explicitly in TV mode, or when GIS is unavailable
  const showTvMode = useTvMode || isGisUnavailable

  // Handler for sign-in that routes to the appropriate flow
  const handleSignIn = useCallback(() => {
    if (showTvMode && onTvSignIn) {
      onTvSignIn()
    } else {
      onSignIn()
    }
  }, [showTvMode, onTvSignIn, onSignIn])

  return (
    <div className="landing-bg relative min-h-screen w-screen overflow-hidden text-zinc-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-10 h-80 w-80 rounded-full bg-amber-200/60 blur-[120px]" />
        <div className="absolute right-[-6rem] top-16 h-96 w-96 rounded-full bg-emerald-200/50 blur-[130px]" />
        <div className="absolute bottom-[-7rem] left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-sky-200/40 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08)_0,_transparent_55%)]" />
      </div>

      <a
        href="https://github.com/mjaverto/yearbird"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute right-4 top-4 z-20 rounded-full p-2 text-zinc-400 transition hover:bg-white/50 hover:text-zinc-600 sm:right-6 sm:top-6"
        aria-label="View on GitHub"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-6 w-6"
          fill="currentColor"
        >
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
      </a>

      <main className="relative z-10">
        {/* Hero text - centered */}
        <section className="mx-auto w-full max-w-4xl px-6 pb-16 pt-24 text-center">
          <div className="reveal" style={{ animationDelay: '80ms' }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-amber-50/80 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-amber-900">
              Ambitious planning, radically simple
            </span>

            <div className="mt-8 flex flex-col items-center gap-3">
              <img src="/eagle.svg" alt="Yearbird" className="float-bird h-12 w-12" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-zinc-400">
                  Yearbird
                </p>
                <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl font-display">
                  Plan a year worth winning.
                </h1>
              </div>
            </div>

            <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-600 sm:text-lg">
              Yearbird turns your Google Calendar into a giant year-at-a-glance map with
              365 days on one bold screen. It is built for founders, athletes, creators,
              students, and anyone chasing an ambitious year who wants to stay focused and in
              control.
            </p>

            <div className="mt-10 flex flex-col items-center gap-5">
              {/* Show auth notice, but not GIS unavailable message when TV mode is active */}
              {authNotice && !(showTvMode && isGisUnavailable) ? (
                <div
                  role="alert"
                  className="w-full max-w-xl rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900"
                >
                  {authNotice}
                </div>
              ) : null}
              {/* TV Mode notice when active */}
              {showTvMode ? (
                <div
                  className="w-full max-w-xl rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-900"
                >
                  <strong>TV Mode:</strong> Using redirect-based sign-in for better compatibility.
                  {useTvMode && onToggleTvMode ? (
                    <>
                      {' '}
                      <button
                        type="button"
                        onClick={() => onToggleTvMode(false)}
                        className="underline decoration-sky-300 underline-offset-2 transition hover:text-sky-700"
                      >
                        Switch back to popup mode
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleSignIn}
                disabled={!showTvMode && !isReady}
                aria-busy={isSigningIn}
                className="relative inline-flex items-center justify-center gap-3 rounded-full border border-zinc-300 bg-white px-8 py-4 text-base font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <svg aria-hidden="true" viewBox="0 0 48 48" className="h-6 w-6">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.92 2.39 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.36 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.95c-.58 3.02-2.26 5.62-4.78 7.35l7.73 6c4.51-4.18 7.08-10.36 7.08-17.82z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.92.94 7.63 2.56 10.97l7.97-6.38z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.9-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.59-3.86-13.47-9.19l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>Sign in with Google{showTvMode ? ' (TV Mode)' : ''}</span>
                {isSigningIn ? (
                  <span className="absolute right-4 flex h-5 w-5 items-center justify-center">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                  </span>
                ) : null}
              </button>
              <p className="text-xs text-zinc-400">
                <a
                  href="https://github.com/mjaverto/yearbird"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-zinc-300 underline-offset-2 transition hover:text-zinc-600"
                >
                  Open Source
                </a>
                {' - Your data never leaves your browser.'}
                {!showTvMode && onToggleTvMode ? (
                  <>
                    {' · '}
                    <button
                      type="button"
                      onClick={() => onToggleTvMode(true)}
                      className="underline decoration-zinc-300 underline-offset-2 transition hover:text-zinc-600"
                    >
                      Try TV Mode
                    </button>
                  </>
                ) : null}
              </p>
              <p className="text-xs text-zinc-400">
                <a href="/privacy.html" className="underline decoration-zinc-300 underline-offset-2 transition hover:text-zinc-600">Privacy Policy</a>
                <span className="mx-2">&middot;</span>
                <a href="/terms.html" className="underline decoration-zinc-300 underline-offset-2 transition hover:text-zinc-600">Terms of Service</a>
              </p>
            </div>
          </div>
        </section>

        {/* Hero image - edge-to-edge showcase */}
        <section className="w-full px-2 pb-28 sm:px-3">
          <div className="reveal relative" style={{ animationDelay: '160ms' }}>
            <div className="absolute -inset-4 rounded-[32px] bg-white/50 blur-3xl sm:-inset-8 sm:rounded-[48px]" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-xl border border-white/70 bg-white/90 shadow-[0_50px_100px_-40px_rgba(15,23,42,0.4)] backdrop-blur sm:rounded-2xl lg:rounded-3xl">
              <picture>
                <source type="image/avif" srcSet={heroImage.avif} sizes={HERO_SIZES} />
                <source type="image/webp" srcSet={heroImage.webp} sizes={HERO_SIZES} />
                <img
                  src={heroImage.src}
                  srcSet={heroImage.png}
                  sizes={HERO_SIZES}
                  alt="Yearbird full-year calendar view across all 12 months"
                  width={IMAGE_WIDTH}
                  height={IMAGE_HEIGHT}
                  loading="eager"
                  decoding="async"
                  className="w-full"
                />
              </picture>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          <div className="grid gap-6 sm:grid-cols-3">
            {statCards.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
                  {item.label}
                </p>
                <p className="mt-3 text-2xl font-semibold text-zinc-900">{item.value}</p>
                <p className="mt-2 text-sm text-zinc-600">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-6xl px-6 pb-28">
          <div className="reveal" style={{ animationDelay: '80ms' }}>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
              See it in action
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-zinc-900 sm:text-4xl font-display">
              Built for the way you think.
            </h2>
            <p className="mt-3 max-w-2xl text-base text-zinc-600">
              Every view is designed to help high achievers commit faster.
            </p>
          </div>

          <div className="mt-14 space-y-14">
            {screenshotRows.map((item) => (
              <article
                key={item.id}
                className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm"
              >
                <div className={screenshotRowClass(item.reverse)}>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">
                      {item.eyebrow}
                    </p>
                  <h3 className="mt-3 text-2xl font-semibold text-zinc-900">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm text-zinc-600">{item.body}</p>
                </div>
                <ScrollZoomImage
                  item={item}
                  onExpand={openShot}
                  prefersReducedMotion={prefersReducedMotion}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

        {/* Mid-page CTA */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-28">
          <div className="flex flex-col items-center justify-center gap-5 rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white/80 px-8 py-12 text-center shadow-sm">
            <p className="text-sm font-medium text-emerald-700">
              Ready to see your year in one view?
            </p>
            <button
              type="button"
              onClick={handleSignIn}
              disabled={!showTvMode && !isReady}
              aria-busy={isSigningIn}
              className="relative inline-flex items-center justify-center gap-3 rounded-full border border-zinc-300 bg-white px-8 py-4 text-base font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <svg aria-hidden="true" viewBox="0 0 48 48" className="h-6 w-6">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.92 2.39 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.36 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.95c-.58 3.02-2.26 5.62-4.78 7.35l7.73 6c4.51-4.18 7.08-10.36 7.08-17.82z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.92.94 7.63 2.56 10.97l7.97-6.38z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.9-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.59-3.86-13.47-9.19l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>Sign in with Google{showTvMode ? ' (TV Mode)' : ''}</span>
              {isSigningIn ? (
                <span className="absolute right-4 flex h-5 w-5 items-center justify-center">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                </span>
              ) : null}
            </button>
            <p className="text-xs text-zinc-500">
              Read-only access · Your data never leaves your browser
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-32">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="rounded-[28px] border border-white/80 bg-white/80 p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-600">
                Built for ambitious years
              </p>
              <h2 className="mt-4 text-3xl font-semibold text-zinc-900 sm:text-4xl font-display">
                Stop reacting. Start owning the year.
              </h2>
              <p className="mt-4 text-base text-zinc-600">
                When 365 days are visible, tradeoffs get obvious. Commit faster, say no
                sooner, and protect the weeks that move the goal.
              </p>
              <div className="mt-6 space-y-3 text-sm text-zinc-600">
                {decisionBullets.map((line) => (
                  <div key={line.id} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                    <span>{line.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {decisionCards.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                    {item.title}
                  </p>
                  <p className="mt-3 text-sm text-zinc-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {lightbox}

      <footer className="relative z-10 flex flex-col items-center gap-4 pb-12 pt-4 text-xs text-zinc-400">
        <a
          href="https://github.com/mjaverto/yearbird"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 transition hover:text-zinc-600"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="currentColor"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          <span>Yearbird on GitHub</span>
        </a>
        <span>Your data never leaves your browser. Built for people who think in years.</span>
        <div className="flex items-center gap-3">
          <a href="/privacy.html" className="transition hover:text-zinc-600">Privacy Policy</a>
          <span aria-hidden="true">&middot;</span>
          <a href="/terms.html" className="transition hover:text-zinc-600">Terms of Service</a>
        </div>
        <span>&copy; {new Date().getFullYear()} Yearbird.com</span>
      </footer>
    </div>
  )
}
