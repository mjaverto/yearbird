import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent } from 'react'
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
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onHideEvent?: (title: string) => void
  onFocus?: () => void
  onBlur?: () => void
  autoFocus?: boolean
}

const TOOLTIP_OFFSET = 12
const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
const VIEWPORT_PADDING = 12
const DEFAULT_CALENDAR_COLOR = '#e4e4e7'

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

  return `${startLabel} - ${endLabel}`
}

export function EventTooltip({
  event,
  position,
  categories,
  onMouseEnter,
  onMouseLeave,
  onHideEvent,
  onFocus,
  onBlur,
  autoFocus = false,
}: EventTooltipProps) {
  const category = getCategoryConfig(event.category, categories)
  const googleLinkTooltipId = `${getEventTooltipId(event.id)}-google-link`
  const tooltipRef = useRef<HTMLDivElement | null>(null)
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
    const node = tooltipRef.current
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
    const baseLeft = position.x + TOOLTIP_OFFSET
    const baseTop = position.y + TOOLTIP_OFFSET

    if (!viewportSize.width || !viewportSize.height || !tooltipSize.width || !tooltipSize.height) {
      return { left: baseLeft, top: baseTop }
    }

    const maxLeft = viewportSize.width - tooltipSize.width - VIEWPORT_PADDING
    const maxTop = viewportSize.height - tooltipSize.height - VIEWPORT_PADDING
    const safeMaxLeft = Math.max(VIEWPORT_PADDING, maxLeft)
    const safeMaxTop = Math.max(VIEWPORT_PADDING, maxTop)
    const left = Math.min(Math.max(VIEWPORT_PADDING, baseLeft), safeMaxLeft)
    const top = Math.min(Math.max(VIEWPORT_PADDING, baseTop), safeMaxTop)

    return { left, top }
  }, [position, tooltipSize, viewportSize])
  const calendarLabel = event.calendarName ?? event.calendarId
  const calendarColor = event.calendarColor ?? DEFAULT_CALENDAR_COLOR

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return
    }
    onBlur?.()
  }

  return (
    <div
      ref={tooltipRef}
      className="pointer-events-auto fixed z-50 max-w-xs rounded-lg border border-zinc-200 bg-white p-3 shadow-lg"
      style={tooltipStyle}
      id={getEventTooltipId(event.id)}
      role="tooltip"
      aria-label={`${event.title} details`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={handleBlur}
    >
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
        style={{ backgroundColor: category.color }}
      >
        {category.label}
      </span>

      <h3 className="mt-2 text-sm font-semibold text-zinc-900">{event.title}</h3>

      {calendarLabel ? (
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
          <span
            className="h-2.5 w-2.5 rounded-full border border-zinc-200"
            style={{ backgroundColor: calendarColor }}
            aria-hidden="true"
          />
          <span>{calendarLabel}</span>
        </div>
      ) : null}

      <p className="mt-1 text-xs text-zinc-600">
        {formatDateRange(event)}
        {event.durationDays > 1 ? ` (${event.durationDays} days)` : ''}
      </p>

      {event.location ? (
        <p className="mt-1 text-xs text-zinc-600">{event.location}</p>
      ) : null}

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
              Hide
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
