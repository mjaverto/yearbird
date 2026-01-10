import { useMemo } from 'react'
import type { YearbirdEvent } from '../../types/calendar'
import type { CategoryConfig } from '../../types/categories'
import { getCategoryConfig } from '../../utils/categorize'

interface DayColumnViewProps {
  events: YearbirdEvent[]
  categories: CategoryConfig[]
  onEventClick?: (event: YearbirdEvent, position: { x: number; y: number }) => void
}

// Layout constants
const HOUR_HEIGHT = 40 // px per hour
const START_HOUR = 6 // 6 AM
const END_HOUR = 22 // 10 PM
const VISIBLE_HOURS = END_HOUR - START_HOUR
const TIME_AXIS_WIDTH = 40 // px

interface PositionedEvent {
  event: YearbirdEvent
  top: number
  height: number
  left: number
  width: number
  column: number
  totalColumns: number
}

/**
 * Groups overlapping events and assigns column positions.
 * Events that overlap in time are placed side by side.
 */
function calculateEventPositions(events: YearbirdEvent[]): PositionedEvent[] {
  // Filter to events with valid time data
  const timedEvents = events.filter(
    (e) => e.startTimeMinutes !== undefined && e.endTimeMinutes !== undefined
  )

  if (timedEvents.length === 0) return []

  // Sort by start time, then by duration (longer events first)
  const sorted = [...timedEvents].sort((a, b) => {
    const startDiff = (a.startTimeMinutes ?? 0) - (b.startTimeMinutes ?? 0)
    if (startDiff !== 0) return startDiff
    // Longer events go first (they get column 0)
    const aDuration = (a.endTimeMinutes ?? 0) - (a.startTimeMinutes ?? 0)
    const bDuration = (b.endTimeMinutes ?? 0) - (b.startTimeMinutes ?? 0)
    return bDuration - aDuration
  })

  // Group overlapping events
  const groups: YearbirdEvent[][] = []
  let currentGroup: YearbirdEvent[] = []
  let groupEnd = 0

  for (const event of sorted) {
    const eventStart = event.startTimeMinutes ?? 0
    const eventEnd = event.endTimeMinutes ?? eventStart + 60

    if (currentGroup.length === 0 || eventStart < groupEnd) {
      // Event overlaps with current group
      currentGroup.push(event)
      groupEnd = Math.max(groupEnd, eventEnd)
    } else {
      // Start new group
      if (currentGroup.length > 0) {
        groups.push(currentGroup)
      }
      currentGroup = [event]
      groupEnd = eventEnd
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  // Assign columns within each group
  const positioned: PositionedEvent[] = []

  for (const group of groups) {
    const totalColumns = group.length
    const columnWidth = 100 / totalColumns

    group.forEach((event, index) => {
      const startMinutes = event.startTimeMinutes ?? 0
      const endMinutes = event.endTimeMinutes ?? startMinutes + 60

      // Calculate position relative to visible hours
      const startOffset = startMinutes - START_HOUR * 60
      const duration = Math.max(15, endMinutes - startMinutes) // Min 15 min for visibility

      positioned.push({
        event,
        top: (startOffset / 60) * HOUR_HEIGHT,
        height: (duration / 60) * HOUR_HEIGHT,
        left: index * columnWidth,
        width: columnWidth,
        column: index,
        totalColumns,
      })
    })
  }

  return positioned
}

/**
 * Formats hour number to display string (e.g., 9 -> "9 AM", 14 -> "2 PM")
 */
function formatHour(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  if (hour < 12) return `${hour} AM`
  return `${hour - 12} PM`
}

/**
 * DayColumnView displays timed events in a Google Calendar-style day column.
 *
 * Events are positioned vertically based on their start time, with heights
 * proportional to duration. Overlapping events are displayed side by side.
 */
export function DayColumnView({ events, categories, onEventClick }: DayColumnViewProps) {
  const hours = useMemo(
    () => Array.from({ length: VISIBLE_HOURS }, (_, i) => START_HOUR + i),
    []
  )

  const positionedEvents = useMemo(() => calculateEventPositions(events), [events])

  const handleEventClick = (event: YearbirdEvent, e: React.MouseEvent<HTMLButtonElement>) => {
    if (onEventClick) {
      onEventClick(event, { x: e.clientX, y: e.clientY })
    }
  }

  if (positionedEvents.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-zinc-400">
        No timed events
      </div>
    )
  }

  return (
    <div
      className="relative flex"
      style={{ height: `${VISIBLE_HOURS * HOUR_HEIGHT}px` }}
    >
      {/* Time axis */}
      <div
        className="sticky left-0 z-10 shrink-0 bg-white"
        style={{ width: `${TIME_AXIS_WIDTH}px` }}
      >
        {hours.map((hour) => (
          <div
            key={hour}
            className="relative border-t border-zinc-100 text-right"
            style={{ height: `${HOUR_HEIGHT}px` }}
          >
            <span className="absolute -top-2 right-1 text-[10px] text-zinc-400">
              {formatHour(hour)}
            </span>
          </div>
        ))}
      </div>

      {/* Event column */}
      <div className="relative flex-1">
        {/* Hour grid lines */}
        {hours.map((hour) => (
          <div
            key={hour}
            className="border-t border-zinc-100"
            style={{ height: `${HOUR_HEIGHT}px` }}
          />
        ))}

        {/* Events */}
        {positionedEvents.map((positioned) => {
          const { event, top, height, left, width } = positioned
          const category = getCategoryConfig(event.category, categories)
          const eventColor = event.calendarColor ?? category.color

          return (
            <button
              key={event.id}
              type="button"
              onClick={(e) => handleEventClick(event, e)}
              className="absolute overflow-hidden rounded border-l-2 bg-opacity-20 px-1 py-0.5 text-left transition hover:bg-opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
              style={{
                top: `${top}px`,
                height: `${Math.max(height, 18)}px`,
                left: `${left}%`,
                width: `calc(${width}% - 2px)`,
                borderLeftColor: eventColor,
                backgroundColor: `${eventColor}20`,
              }}
              title={`${event.startTime} - ${event.endTime}: ${event.title}`}
            >
              <div className="line-clamp-2 text-xs font-medium text-zinc-800">
                {event.title}
              </div>
              {height >= 32 && (
                <div className="text-[10px] text-zinc-500">
                  {event.startTime} - {event.endTime}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
