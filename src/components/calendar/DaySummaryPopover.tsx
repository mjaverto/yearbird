import { Popover, PopoverButton, PopoverPanel, CloseButton } from '@headlessui/react'
import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'
import type { YearbirdEvent } from '../../types/calendar'
import type { CategoryConfig } from '../../types/categories'
import { ExternalLinkIcon } from '../icons/ExternalLinkIcon'
import { getCategoryConfig } from '../../utils/categorize'
import { DayColumnView } from './DayColumnView'
import { buildGoogleCalendarCreateUrl, buildGoogleCalendarDayUrl } from '../../utils/googleCalendar'
import { getDateKey, addDays } from '../../utils/dateUtils'

interface DaySummaryPopoverProps {
  date: Date
  /** All-day and multi-day events for this day */
  events: YearbirdEvent[]
  /** Single-day timed events (meetings, appointments) for column view */
  timedEvents?: YearbirdEvent[]
  /** Map of all-day events by date key (YYYY-MM-DD) for navigation */
  allEventsByDate?: Map<string, YearbirdEvent[]>
  /** Map of timed events by date key (YYYY-MM-DD) for navigation */
  timedEventsByDate?: Map<string, YearbirdEvent[]>
  /** Year constraint for navigation boundaries */
  year?: number
  categories: CategoryConfig[]
  googleCalendarCreateUrl: string
  googleCalendarDayUrl: string
  children: React.ReactNode
  onEventClick?: (event: YearbirdEvent, position: { x: number; y: number }) => void
}

const MAX_VISIBLE_EVENTS = 6
const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }

/**
 * DaySummaryPopover displays a list of events for a clicked day cell.
 * Supports left/right navigation via arrow buttons or keyboard arrows.
 *
 * Usage:
 * ```tsx
 * <DaySummaryPopover
 *   date={new Date(2025, 0, 15)}
 *   events={eventsForDay}
 *   allEventsByDate={allDayEventMap}
 *   timedEventsByDate={timedEventMap}
 *   categories={categoryConfigs}
 *   googleCalendarCreateUrl="https://calendar.google.com/calendar/r/eventedit?dates=20250115/20250116"
 *   googleCalendarDayUrl="https://calendar.google.com/calendar/r/day/2025/1/15"
 *   onEventClick={(event, pos) => showTooltip(event, pos)}
 * >
 *   <span className="day-cell">15</span>
 * </DaySummaryPopover>
 * ```
 */
export function DaySummaryPopover({
  date,
  events,
  timedEvents,
  allEventsByDate,
  timedEventsByDate,
  year,
  categories,
  googleCalendarCreateUrl,
  googleCalendarDayUrl,
  children,
  onEventClick,
}: DaySummaryPopoverProps) {
  // Track the currently viewed date (allows navigation while popover stays open)
  // Using date.toISOString() as key ensures state resets when popover opens on different day
  const [currentDate, setCurrentDate] = useState(date)

  // Navigation is enabled when event maps are provided
  const canNavigate = Boolean(allEventsByDate)

  // Compute year boundaries for navigation (defaults to current date's year if not provided)
  const navigationYear = year ?? date.getFullYear()
  const yearStart = useMemo(() => new Date(navigationYear, 0, 1), [navigationYear])
  const yearEnd = useMemo(() => new Date(navigationYear, 11, 31), [navigationYear])

  // Check if navigation is allowed in each direction
  const canNavigatePrevious = canNavigate && currentDate > yearStart
  const canNavigateNext = canNavigate && currentDate < yearEnd

  // Get events for the current viewing date
  // FIX: When navigation is enabled, use empty array for missing dates instead of falling back to original props
  const currentDateKey = getDateKey(currentDate)
  const currentAllDayEvents = canNavigate
    ? (allEventsByDate?.get(currentDateKey) ?? [])
    : events
  const currentTimedEvents = canNavigate
    ? (timedEventsByDate?.get(currentDateKey) ?? [])
    : (timedEvents ?? [])

  // Generate URLs for current date
  const currentCreateUrl = canNavigate
    ? buildGoogleCalendarCreateUrl(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
    : googleCalendarCreateUrl
  const currentDayUrl = canNavigate
    ? buildGoogleCalendarDayUrl(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
    : googleCalendarDayUrl

  const formattedDate = currentDate.toLocaleDateString('en-US', DATE_FORMAT)
  const visibleEvents = currentAllDayEvents.slice(0, MAX_VISIBLE_EVENTS)
  const overflowCount = currentAllDayEvents.length - MAX_VISIBLE_EVENTS
  const hasOverflow = overflowCount > 0
  const hasTimedEvents = currentTimedEvents.length > 0

  const navigatePrevious = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    setCurrentDate((d) => {
      const newDate = addDays(d, -1)
      // Enforce year boundary
      return newDate >= yearStart ? newDate : d
    })
  }, [yearStart])

  const navigateNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    setCurrentDate((d) => {
      const newDate = addDays(d, 1)
      // Enforce year boundary
      return newDate <= yearEnd ? newDate : d
    })
  }, [yearEnd])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!canNavigate) return

      if (e.key === 'ArrowLeft' && canNavigatePrevious) {
        e.preventDefault()
        navigatePrevious()
      } else if (e.key === 'ArrowRight' && canNavigateNext) {
        e.preventDefault()
        navigateNext()
      }
    },
    [canNavigate, canNavigatePrevious, canNavigateNext, navigatePrevious, navigateNext]
  )

  // Reset currentDate when the trigger date prop changes (handles popover key change)
  // This is needed because useState only uses initial value on mount
  if (currentDate.getTime() !== date.getTime() && !canNavigate) {
    setCurrentDate(date)
  }

  const handleEventClick = (
    event: YearbirdEvent,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (onEventClick) {
      onEventClick(event, { x: e.clientX, y: e.clientY })
    }
  }

  return (
    <Popover className="relative h-full w-full">
      <PopoverButton as="div" className="h-full w-full cursor-pointer">
        {children}
      </PopoverButton>

      <PopoverPanel
        anchor={{ to: 'right start', gap: 12, padding: 16 }}
        className="z-50 w-80 max-h-[80vh] flex flex-col rounded-lg border border-zinc-200 bg-white shadow-lg focus:outline-none"
      >
        {/* Wrapper div for keyboard navigation - PopoverPanel doesn't accept tabIndex */}
        <div
          className="flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset"
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center gap-1">
            {canNavigate ? (
              <button
                type="button"
                onClick={navigatePrevious}
                disabled={!canNavigatePrevious}
                className="rounded p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                aria-label="Previous day"
              >
                <ChevronLeftIcon className="size-4" />
              </button>
            ) : null}
            {/* aria-live announces date changes to screen readers */}
            <h3
              className="text-sm font-semibold text-zinc-900"
              aria-live="polite"
              aria-atomic="true"
            >
              {formattedDate}
            </h3>
            {canNavigate ? (
              <button
                type="button"
                onClick={navigateNext}
                disabled={!canNavigateNext}
                className="rounded p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                aria-label="Next day"
              >
                <ChevronRightIcon className="size-4" />
              </button>
            ) : null}
          </div>
          <CloseButton
            className="rounded p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label="Close popover"
          >
            <XIcon className="size-4" />
          </CloseButton>
        </div>

        {/* All-day events list */}
        <div className="shrink-0 px-2 py-2">
          {visibleEvents.length === 0 ? (
            <p className="px-2 py-3 text-center text-sm text-zinc-500">
              {hasTimedEvents ? 'No all-day events' : 'No events'}
            </p>
          ) : (
            <ul className="space-y-1" role="list">
              {visibleEvents.map((event) => {
                const category = getCategoryConfig(event.category, categories)
                const eventColor = event.calendarColor ?? category.color

                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={(e) => handleEventClick(event, e)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: eventColor }}
                        aria-hidden="true"
                      />
                      <span className="truncate text-sm text-zinc-700">{event.title}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Overflow link */}
          {hasOverflow ? (
            <a
              href={currentDayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block px-2 text-xs text-zinc-500 transition hover:text-zinc-700 hover:underline"
            >
              +{overflowCount} more — View all in Google
            </a>
          ) : null}
        </div>

        {/* Day column view for timed events */}
        {hasTimedEvents ? (
          <div className="min-h-0 flex-1 overflow-hidden border-t border-zinc-100">
            <div className="px-4 py-2 text-xs font-medium text-zinc-500">Schedule</div>
            <div className="overflow-y-auto px-2 pb-2" style={{ maxHeight: 'calc(80vh - 200px)' }}>
              <DayColumnView
                events={currentTimedEvents}
                categories={categories}
                onEventClick={onEventClick}
              />
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-zinc-100 px-4 py-3">
          <a
            href={currentDayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Open Day
            <ExternalLinkIcon className="size-3.5" />
          </a>
          <a
            href={currentCreateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
          >
            <PlusIcon className="size-3.5" />
            New Event
          </a>
        </div>
        </div>
      </PopoverPanel>
    </Popover>
  )
}

// Internal icon components
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}
