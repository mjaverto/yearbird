import { Popover, PopoverButton, PopoverPanel, CloseButton } from '@headlessui/react'
import type { YearbirdEvent } from '../../types/calendar'
import type { CategoryConfig } from '../../types/categories'
import { ExternalLinkIcon } from '../icons/ExternalLinkIcon'
import { getCategoryConfig } from '../../utils/categorize'
import { DayColumnView } from './DayColumnView'

interface DaySummaryPopoverProps {
  date: Date
  /** All-day and multi-day events for this day */
  events: YearbirdEvent[]
  /** Single-day timed events (meetings, appointments) for column view */
  timedEvents?: YearbirdEvent[]
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
 *
 * Usage:
 * ```tsx
 * <DaySummaryPopover
 *   date={new Date(2025, 0, 15)}
 *   events={eventsForDay}
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
  categories,
  googleCalendarCreateUrl,
  googleCalendarDayUrl,
  children,
  onEventClick,
}: DaySummaryPopoverProps) {
  const formattedDate = date.toLocaleDateString('en-US', DATE_FORMAT)
  const visibleEvents = events.slice(0, MAX_VISIBLE_EVENTS)
  const overflowCount = events.length - MAX_VISIBLE_EVENTS
  const hasOverflow = overflowCount > 0
  const hasTimedEvents = timedEvents && timedEvents.length > 0

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
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-900">{formattedDate}</h3>
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
              href={googleCalendarDayUrl}
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
                events={timedEvents}
                categories={categories}
                onEventClick={onEventClick}
              />
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-zinc-100 px-4 py-3">
          <a
            href={googleCalendarDayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Open Day
            <ExternalLinkIcon className="size-3.5" />
          </a>
          <a
            href={googleCalendarCreateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
          >
            <PlusIcon className="size-3.5" />
            New Event
          </a>
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
