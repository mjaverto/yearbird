import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { YearbirdEvent } from '../../types/calendar'
import { ExternalLinkIcon } from '../icons/ExternalLinkIcon'
import { TouchTarget } from '../ui/button'
import type { CategoryConfig } from '../../types/categories'
import { getCategoryConfig } from '../../utils/categorize'
import { parseDateValue } from '../../utils/dateUtils'
import { getEventTooltipId } from './eventTooltipUtils'

interface EventTooltipProps {
  event: YearbirdEvent
  position: { x: number; y: number }
  categories: CategoryConfig[]
  onHideEvent?: (title: string) => void
  autoFocus?: boolean
}

const TOOLTIP_OFFSET = 12
const DATE_FORMAT: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
const VIEWPORT_PADDING = 12
const DEFAULT_CALENDAR_COLOR = '#e4e4e7'
const MAX_DESCRIPTION_LENGTH = 200

/**
 * Format time from HH:MM (24h) to readable format like "9:00 AM"
 */
const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

/**
 * Format time range for timed events
 */
const formatTimeRange = (event: YearbirdEvent): string | null => {
  if (event.isAllDay || !event.startTime) {
    return null
  }

  if (event.endTime && event.startTime !== event.endTime) {
    return `${formatTime(event.startTime)} – ${formatTime(event.endTime)}`
  }

  return formatTime(event.startTime)
}

const formatDateRange = (event: YearbirdEvent) => {
  const start = parseDateValue(event.startDate)
  const end = parseDateValue(event.endDate)

  if (!start || !end) {
    return 'Date unavailable'
  }

  const startLabel = start.toLocaleDateString('en-US', DATE_FORMAT)
  const endLabel = end.toLocaleDateString('en-US', DATE_FORMAT)

  if (start.getTime() === end.getTime()) {
    return startLabel
  }

  return `${startLabel} – ${endLabel}`
}

/**
 * Truncate description if too long
 */
const truncateDescription = (text: string): string => {
  if (text.length <= MAX_DESCRIPTION_LENGTH) {
    return text
  }
  return text.slice(0, MAX_DESCRIPTION_LENGTH).trim() + '…'
}

// Icon components for the tooltip
const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
  </svg>
)

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
  </svg>
)

const DocumentTextIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
)

export const EventTooltip = forwardRef<HTMLDivElement, EventTooltipProps>(function EventTooltip({
  event,
  position,
  categories,
  onHideEvent,
  autoFocus = false,
}, ref) {
  const category = getCategoryConfig(event.category, categories)
  const googleLinkTooltipId = `${getEventTooltipId(event.id)}-google-link`
  const internalRef = useRef<HTMLDivElement | null>(null)
  const linkRef = useRef<HTMLAnchorElement | null>(null)
  const hideButtonRef = useRef<HTMLButtonElement | null>(null)
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 })
  const [viewportSize, setViewportSize] = useState(() => {
    if (typeof window === 'undefined') {
      return { width: 0, height: 0 }
    }

    return { width: window.innerWidth, height: window.innerHeight }
  })

  const handleTooltipResize = useCallback((entries: ResizeObserverEntry[]) => {
    const entry = entries[0]
    if (!entry) {
      return
    }

    const { width, height } = entry.contentRect
    setTooltipSize((current) => {
      if (current.width === width && current.height === height) {
        return current
      }

      return { width, height }
    })
  }, [])

  const handleViewportResize = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    const next = { width: window.innerWidth, height: window.innerHeight }
    setViewportSize((current) => {
      if (current.width === next.width && current.height === next.height) {
        return current
      }
      return next
    })
  }, [])

  useLayoutEffect(() => {
    const node = internalRef.current
    if (!node || typeof window === 'undefined') {
      return
    }

    const resizeObserver = new ResizeObserver(handleTooltipResize)

    resizeObserver.observe(node)

    return () => {
      resizeObserver.disconnect()
    }
  }, [handleTooltipResize])

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.addEventListener('resize', handleViewportResize)

    return () => {
      window.removeEventListener('resize', handleViewportResize)
    }
  }, [handleViewportResize])

  useEffect(() => {
    if (!autoFocus) {
      return
    }

    const target = linkRef.current ?? hideButtonRef.current
    if (target) {
      target.focus({ preventScroll: true })
    }
  }, [autoFocus, event.id])

  const tooltipStyle = useMemo(() => {
    // Before we know the tooltip size, hide it to prevent positioning flash
    if (!viewportSize.width || !viewportSize.height || !tooltipSize.width || !tooltipSize.height) {
      return { left: position.x + TOOLTIP_OFFSET, top: position.y + TOOLTIP_OFFSET, opacity: 0 }
    }

    // Calculate space available in each direction from click point
    const spaceRight = viewportSize.width - position.x - VIEWPORT_PADDING
    const spaceLeft = position.x - VIEWPORT_PADDING
    const spaceBelow = viewportSize.height - position.y - VIEWPORT_PADDING
    const spaceAbove = position.y - VIEWPORT_PADDING

    // Determine horizontal position: prefer right, flip to left if not enough space
    let left: number
    if (spaceRight >= tooltipSize.width + TOOLTIP_OFFSET) {
      // Enough space on right - position to right of click
      left = position.x + TOOLTIP_OFFSET
    } else if (spaceLeft >= tooltipSize.width + TOOLTIP_OFFSET) {
      // Not enough on right, but enough on left - position to left of click
      left = position.x - tooltipSize.width - TOOLTIP_OFFSET
    } else {
      // Not enough space on either side - center horizontally and clamp
      left = Math.max(VIEWPORT_PADDING, Math.min(
        position.x - tooltipSize.width / 2,
        viewportSize.width - tooltipSize.width - VIEWPORT_PADDING
      ))
    }

    // Determine vertical position: prefer below, flip to above if not enough space
    let top: number
    if (spaceBelow >= tooltipSize.height + TOOLTIP_OFFSET) {
      // Enough space below - position below click
      top = position.y + TOOLTIP_OFFSET
    } else if (spaceAbove >= tooltipSize.height + TOOLTIP_OFFSET) {
      // Not enough below, but enough above - position above click
      top = position.y - tooltipSize.height - TOOLTIP_OFFSET
    } else {
      // Not enough space above or below - clamp to viewport
      top = Math.max(VIEWPORT_PADDING, Math.min(
        position.y - tooltipSize.height / 2,
        viewportSize.height - tooltipSize.height - VIEWPORT_PADDING
      ))
    }

    return { left, top }
  }, [position, tooltipSize, viewportSize])
  const calendarLabel = event.calendarName ?? event.calendarId
  const calendarColor = event.calendarColor ?? DEFAULT_CALENDAR_COLOR

  // Merge forwarded ref with internal ref
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    internalRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      ref.current = node
    }
  }, [ref])

  // Use portal to render at document body level, escaping any parent stacking contexts
  return createPortal(
    <div
      ref={setRefs}
      className="pointer-events-auto fixed z-[60] w-80 max-w-[calc(100vw-24px)] rounded-lg border border-zinc-200 bg-white p-4 shadow-lg"
      style={tooltipStyle}
      id={getEventTooltipId(event.id)}
      role="tooltip"
      aria-label={`${event.title} details`}
    >
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
        style={{ backgroundColor: category.color }}
      >
        {category.label}
      </span>

      <h3 className="mt-2 text-sm font-semibold text-zinc-900">{event.title}</h3>

      {/* Event metadata section with icons */}
      <div className="mt-2 space-y-1.5">
        {/* Calendar source */}
        {calendarLabel ? (
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-zinc-200"
              style={{ backgroundColor: calendarColor }}
              aria-hidden="true"
            />
            <span className="truncate">{calendarLabel}</span>
          </div>
        ) : null}

        {/* Date and time */}
        <div className="flex items-start gap-2 text-xs text-zinc-600">
          <CalendarIcon className="size-3.5 flex-shrink-0 mt-0.5" />
          <div className="flex flex-col">
            <span>
              {formatDateRange(event)}
              {event.durationDays > 1 ? ` (${event.durationDays} days)` : ''}
            </span>
            {formatTimeRange(event) ? (
              <span className="flex items-center gap-1.5 text-zinc-500">
                <ClockIcon className="size-3" />
                {formatTimeRange(event)}
              </span>
            ) : event.isAllDay ? (
              <span className="text-zinc-500">All day</span>
            ) : null}
          </div>
        </div>

        {/* Location */}
        {event.location ? (
          <div className="flex items-start gap-2 text-xs text-zinc-600">
            <MapPinIcon className="size-3.5 flex-shrink-0 mt-0.5" />
            <span className="break-words">{event.location}</span>
          </div>
        ) : null}

        {/* Description */}
        {event.description ? (
          <div className="flex items-start gap-2 text-xs text-zinc-500">
            <DocumentTextIcon className="size-3.5 flex-shrink-0 mt-0.5" />
            <p className="break-words whitespace-pre-wrap">{truncateDescription(event.description)}</p>
          </div>
        ) : null}
      </div>

      {event.googleLink || onHideEvent ? (
        <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-2">
          {event.googleLink ? (
            <a
              ref={linkRef}
              href={event.googleLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex size-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
              aria-label="Open in Google Calendar"
              aria-describedby={googleLinkTooltipId}
            >
              <TouchTarget>
                <ExternalLinkIcon className="size-4" />
              </TouchTarget>
              <span
                id={googleLinkTooltipId}
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 rounded-md bg-zinc-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                Open in Google Calendar
              </span>
            </a>
          ) : null}

          {onHideEvent ? (
            <button
              ref={hideButtonRef}
              type="button"
              className="ml-auto inline-flex items-center rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 transition hover:bg-zinc-50"
              onClick={() => onHideEvent(event.title)}
              aria-label={`Hide events like ${event.title}`}
            >
              Hide this event
            </button>
          ) : null}
        </div>
      ) : null}
    </div>,
    document.body
  )
})
