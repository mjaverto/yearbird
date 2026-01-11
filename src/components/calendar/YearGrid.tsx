import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import clsx from 'clsx'
import {
  MONTHS,
  getDaysInMonth,
  isPastDate,
  isToday,
  isWeekend,
  parseDateValue,
  getDateKeyFromParts,
} from '../../utils/dateUtils'
import { buildGoogleCalendarCreateUrl, buildGoogleCalendarDayUrl } from '../../utils/googleCalendar'
import type { CategoryConfig } from '../../types/categories'
import type { YearbirdEvent } from '../../types/calendar'
import { useTooltip, type TooltipSource } from '../../hooks/useTooltip'
import { calculateEventBars, type EventBar } from '../../utils/eventBars'
import { getDensityScale } from '../../utils/density'
import { DayHeader } from './DayHeader'
import { EventBars } from './EventBars'
import { EventTooltip } from './EventTooltip'
import { getEventTooltipId } from './eventTooltipUtils'
import { DaySummaryPopover } from './DaySummaryPopover'

interface YearGridProps {
  year: number
  events: YearbirdEvent[]
  /** Timed events by date (YYYY-MM-DD) for showing in day popover */
  timedEventsByDate?: Map<string, YearbirdEvent[]>
  today: Date
  onHideEvent?: (title: string) => void
  categories: CategoryConfig[]
  isScrollable?: boolean
  scrollDensity?: number
  showDayHeader?: boolean
  /** Called when the grid has fully rendered with correct dimensions */
  onReady?: () => void
}

const DAY_COLUMN_COUNT = 31
const MONTH_ROW_MIN_HEIGHT_VH = 5
const MONTH_ROW_HEIGHT_RANGE_VH = 45
const MONTH_ROW_MIN_HEIGHT_PX = 44
const MONTH_ROW_HEIGHT_RANGE_PX = 256
const STACK_FONT_BASE = 8
const STACK_FONT_RANGE = 3
const STACK_LINE_HEIGHT_BASE = 1.05
const STACK_LINE_HEIGHT_RANGE = 0.2
const STACK_PADDING_PX = 8
const STACK_GAP_DENSE_THRESHOLD = 3
const STACK_GAP_DENSE_PX = 2
const STACK_GAP_SPARSE_PX = 4
const STACK_TITLE_DENSITY_THRESHOLD = 0.3
const STACK_BAR_HEIGHT_PX = 5
const STACK_MIN_CHARS_PER_LINE = 6
const STACK_CHAR_WIDTH_RATIO = 0.55
const STACK_FALLBACK_CHARS_PER_LINE = 12
const GRID_GAP_PX = 1

const getEventRange = (event: YearbirdEvent) => {
  const start = parseDateValue(event.startDate)
  const end = parseDateValue(event.endDate)

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null
  }

  if (end.getTime() < start.getTime()) {
    return null
  }

  return { start, end }
}

/**
 * Builds a map of single-day events by date key.
 * Used for rendering dots on day cells (excludes multi-day events shown as bars).
 */
const buildSingleDayEventMap = (
  events: YearbirdEvent[],
  year: number,
  categoryPriority: Map<string, number>
) => {
  const map = new Map<string, YearbirdEvent[]>()
  const sortedEvents = [...events].sort((a, b) => {
    const priorityA = categoryPriority.get(a.category) ?? Number.MAX_SAFE_INTEGER
    const priorityB = categoryPriority.get(b.category) ?? Number.MAX_SAFE_INTEGER
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }
    if (a.durationDays !== b.durationDays) {
      return b.durationDays - a.durationDays
    }
    if (a.startDate !== b.startDate) {
      return a.startDate.localeCompare(b.startDate)
    }
    return a.title.localeCompare(b.title)
  })

  for (const event of sortedEvents) {
    if (event.durationDays > 1) {
      continue
    }

    const range = getEventRange(event)
    if (!range) {
      continue
    }

    const current = new Date(range.start)
    while (current <= range.end) {
      if (current.getFullYear() === year) {
        const key = getDateKeyFromParts(year, current.getMonth() + 1, current.getDate())
        const existing = map.get(key)
        if (existing) {
          existing.push(event)
        } else {
          map.set(key, [event])
        }
      }
      current.setDate(current.getDate() + 1)
    }
  }

  return map
}

/**
 * Builds a map of all-day and multi-day events by date key.
 * Used for the popover to show all events touching a day (including multi-day spans).
 */
const buildAllDayEventMap = (
  events: YearbirdEvent[],
  year: number,
  categoryPriority: Map<string, number>
) => {
  const map = new Map<string, YearbirdEvent[]>()
  const sortedEvents = [...events].sort((a, b) => {
    const priorityA = categoryPriority.get(a.category) ?? Number.MAX_SAFE_INTEGER
    const priorityB = categoryPriority.get(b.category) ?? Number.MAX_SAFE_INTEGER
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }
    if (a.durationDays !== b.durationDays) {
      return b.durationDays - a.durationDays
    }
    if (a.startDate !== b.startDate) {
      return a.startDate.localeCompare(b.startDate)
    }
    return a.title.localeCompare(b.title)
  })

  for (const event of sortedEvents) {
    // Include all events (single-day and multi-day), but exclude timed events
    if (event.isSingleDayTimed) {
      continue
    }

    const range = getEventRange(event)
    if (!range) {
      continue
    }

    const current = new Date(range.start)
    while (current <= range.end) {
      if (current.getFullYear() === year) {
        const key = getDateKeyFromParts(year, current.getMonth() + 1, current.getDate())
        const existing = map.get(key)
        if (existing) {
          existing.push(event)
        } else {
          map.set(key, [event])
        }
      }
      current.setDate(current.getDate() + 1)
    }
  }

  return map
}

export function YearGrid({
  year,
  events,
  timedEventsByDate,
  today,
  onHideEvent,
  categories,
  isScrollable = false,
  scrollDensity = 60,
  showDayHeader = true,
  onReady,
}: YearGridProps) {
  const {
    tooltip,
    tooltipRef,
    showTooltip,
    hideTooltip,
  } = useTooltip()
  const activeEventId = tooltip.event?.id
  const activeTooltipId = tooltip.event ? getEventTooltipId(tooltip.event.id) : undefined
  const categoryPriority = useMemo(
    () => new Map(categories.map((category, index) => [category.category, index])),
    [categories]
  )
  const singleDayEventsByDate = useMemo(
    () => buildSingleDayEventMap(events, year, categoryPriority),
    [events, year, categoryPriority]
  )
  const allDayEventsByDate = useMemo(
    () => buildAllDayEventMap(events, year, categoryPriority),
    [events, year, categoryPriority]
  )
  const eventBarsByMonth = useMemo(() => {
    const grouped = new Map<number, EventBar[]>()
    const bars = calculateEventBars(events, year)

    for (const bar of bars) {
      const existing = grouped.get(bar.month) ?? []
      existing.push(bar)
      grouped.set(bar.month, existing)
    }

    return grouped
  }, [events, year])
  const densityScale = getDensityScale(scrollDensity)
  const monthRowClassName = isScrollable ? 'flex-none' : 'flex-1'
  const monthRowStyle: CSSProperties | undefined = isScrollable
    ? {
        height: `${MONTH_ROW_MIN_HEIGHT_VH + densityScale * MONTH_ROW_HEIGHT_RANGE_VH}vh`,
        minHeight: `${MONTH_ROW_MIN_HEIGHT_PX + densityScale * MONTH_ROW_HEIGHT_RANGE_PX}px`,
      }
    : undefined

  // Track when all 12 MonthRows have reported their dimensions via ResizeObserver
  const readyMonthsRef = useRef(new Set<number>())
  const hasSignaledReady = useRef(false)
  const handleMonthReady = (monthIndex: number) => {
    if (hasSignaledReady.current) return
    readyMonthsRef.current.add(monthIndex)
    if (readyMonthsRef.current.size === 12 && onReady) {
      hasSignaledReady.current = true
      onReady()
    }
  }

  return (
    <div className={clsx('flex w-full flex-col', isScrollable ? 'min-h-full' : 'h-full')}>
      {showDayHeader ? <DayHeader /> : null}

      <div className={clsx('flex flex-col gap-px', isScrollable ? 'flex-none' : 'min-h-0 flex-1')}>
        {MONTHS.map((monthName, monthIndex) => (
          <MonthRow
            key={monthName}
            year={year}
            month={monthIndex}
            monthName={monthName}
            today={today}
            singleDayEventsByDate={singleDayEventsByDate}
            allDayEventsByDate={allDayEventsByDate}
            timedEventsByDate={timedEventsByDate}
            eventBars={eventBarsByMonth.get(monthIndex) ?? []}
            categories={categories}
            onEventHover={showTooltip}
            activeEventId={activeEventId}
            activeTooltipId={activeTooltipId}
            isScrollable={isScrollable}
            scrollDensity={scrollDensity}
            className={monthRowClassName}
            style={monthRowStyle}
            onReady={() => handleMonthReady(monthIndex)}
          />
        ))}
      </div>
      {tooltip.event ? (
        <EventTooltip
          ref={tooltipRef}
          event={tooltip.event}
          position={tooltip.position}
          categories={categories}
          onHideEvent={
            onHideEvent
              ? (title) => {
                  onHideEvent(title)
                  hideTooltip()
                }
              : undefined
          }
          autoFocus={tooltip.source === 'focus'}
        />
      ) : null}
    </div>
  )
}

interface MonthRowProps {
  year: number
  month: number
  monthName: string
  today: Date
  singleDayEventsByDate: Map<string, YearbirdEvent[]>
  allDayEventsByDate: Map<string, YearbirdEvent[]>
  timedEventsByDate?: Map<string, YearbirdEvent[]>
  eventBars: EventBar[]
  categories: CategoryConfig[]
  onEventHover?: (event: YearbirdEvent, position: { x: number; y: number }, source?: TooltipSource) => void
  activeEventId?: string
  activeTooltipId?: string
  isScrollable?: boolean
  scrollDensity?: number
  className?: string
  style?: CSSProperties
  /** Called when ResizeObserver has measured this row */
  onReady?: () => void
}

function MonthRow({
  year,
  month,
  monthName,
  today,
  singleDayEventsByDate,
  allDayEventsByDate,
  timedEventsByDate,
  eventBars,
  categories,
  onEventHover,
  activeEventId,
  activeTooltipId,
  isScrollable = false,
  scrollDensity = 60,
  className,
  style,
  onReady,
}: MonthRowProps) {
  const daysInMonth = getDaysInMonth(year, month)
  const [gridSize, setGridSize] = useState({ height: 0, width: 0 })
  const gridRef = useRef<HTMLDivElement | null>(null)
  const hasSignaledReady = useRef(false)

  useEffect(() => {
    const node = gridRef.current
    if (!node || typeof ResizeObserver === 'undefined') {
      // No ResizeObserver support - signal ready immediately
      if (!hasSignaledReady.current && onReady) {
        hasSignaledReady.current = true
        onReady()
      }
      return
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }
      setGridSize({
        height: entry.contentRect.height,
        width: entry.contentRect.width,
      })
      // Signal ready after first measurement
      if (!hasSignaledReady.current && onReady) {
        hasSignaledReady.current = true
        onReady()
      }
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [onReady])

  return (
    <div className={clsx('flex min-h-0', className)} style={style}>
      <div
        className="flex flex-none items-center justify-end pr-2"
        style={{ width: 'var(--tv-month-column)' }}
      >
        <span
          className="font-semibold text-zinc-500"
          style={{ fontSize: 'var(--tv-month-label)' }}
        >
          {monthName}
        </span>
      </div>

      <div className="relative flex-1 min-h-0">
        <div
          ref={gridRef}
          className="grid h-full grid-cols-31 bg-zinc-200/70"
          style={{ gap: 'var(--tv-grid-gap)' }}
        >
          {Array.from({ length: DAY_COLUMN_COUNT }, (_, dayIndex) => {
            const day = dayIndex + 1
            const isValidDay = day <= daysInMonth
            const dateKey = getDateKeyFromParts(year, month + 1, day)
            const singleDayEvents = singleDayEventsByDate.get(dateKey) ?? []
            const allDayEvents = allDayEventsByDate.get(dateKey) ?? []
            const timedEvents = timedEventsByDate?.get(dateKey) ?? []

            return (
              <DayCell
                key={dayIndex}
                year={year}
                month={month}
                day={day}
                isValid={isValidDay}
                today={today}
                singleDayEvents={singleDayEvents}
                allDayEvents={allDayEvents}
                timedEvents={timedEvents}
                allEventsByDate={allDayEventsByDate}
                allTimedEventsByDate={timedEventsByDate}
                categories={categories}
                showTitle={isScrollable}
                titleDensity={scrollDensity}
                availableHeight={gridSize.height}
                availableWidth={gridSize.width}
                onEventClick={(event, position) => onEventHover?.(event, position, 'pointer')}
                activeEventId={activeEventId}
                activeTooltipId={activeTooltipId}
              />
            )
          })}
        </div>

        <EventBars
          bars={eventBars}
          onEventClick={(event, position) => onEventHover?.(event, position, 'pointer')}
          activeEventId={activeEventId}
          activeTooltipId={activeTooltipId}
          isScrollable={isScrollable}
          scrollDensity={scrollDensity}
        />
      </div>
    </div>
  )
}

interface DayCellProps {
  year: number
  month: number
  day: number
  isValid: boolean
  today: Date
  /** Single-day events for dot display on year view */
  singleDayEvents?: YearbirdEvent[]
  /** All-day and multi-day events for popover (includes events spanning this day) */
  allDayEvents?: YearbirdEvent[]
  /** Timed events for the day column view in popover */
  timedEvents?: YearbirdEvent[]
  /** Map of all-day events by date key for popover navigation */
  allEventsByDate?: Map<string, YearbirdEvent[]>
  /** Map of timed events by date key for popover navigation */
  allTimedEventsByDate?: Map<string, YearbirdEvent[]>
  categories: CategoryConfig[]
  showTitle?: boolean
  titleDensity?: number
  availableHeight?: number
  availableWidth?: number
  onEventClick?: (event: YearbirdEvent, position: { x: number; y: number }) => void
  activeEventId?: string
  activeTooltipId?: string
}

function DayCell({
  year,
  month,
  day,
  isValid,
  today,
  singleDayEvents = [],
  allDayEvents = [],
  timedEvents = [],
  allEventsByDate,
  allTimedEventsByDate,
  categories,
  showTitle = false,
  titleDensity = 60,
  onEventClick,
  availableHeight = 0,
  availableWidth = 0,
  activeEventId,
  activeTooltipId,
}: DayCellProps) {
  const titleDensityScale = getDensityScale(titleDensity)
  if (!isValid) {
    return <div className="bg-zinc-100" />
  }

  const weekend = isWeekend(year, month, day)
  const isTodayDate = isToday(year, month, day, today)
  const isPast = isPastDate(year, month, day, today)
  const dateKey = getDateKeyFromParts(year, month + 1, day)
  const createUrl = buildGoogleCalendarCreateUrl(year, month, day)
  const dayUrl = buildGoogleCalendarDayUrl(year, month, day)
  const hasEvents = singleDayEvents.length > 0

  // Visual indicator: dots for visible events only (same filter as year view)
  // Timed events are hidden from dots but shown in popover when clicking
  const cellContent = !showTitle && singleDayEvents.length > 0 ? (
    <div
      className="pointer-events-none absolute bottom-1 left-1 flex items-center gap-1"
      aria-hidden="true"
    >
      {singleDayEvents.slice(0, 3).map((event) => (
        <span
          key={`${dateKey}-${event.id}`}
          className="h-1.5 w-1.5 rounded-sm"
          style={{ backgroundColor: event.color }}
          data-color={event.color}
        />
      ))}
      {singleDayEvents.length > 3 ? (
        <span className="text-[8px] font-semibold text-zinc-400">+</span>
      ) : null}
    </div>
  ) : null

  const cellClassName = clsx(
    'relative block h-full w-full cursor-pointer border border-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500',
    weekend ? 'bg-zinc-50' : 'bg-white',
    isPast && 'opacity-60',
    isTodayDate && 'border-sky-500/80 today-ring'
  )

  // Non-scrollable mode: Use popover for days with events, direct link for empty days
  const hasTimedEvents = timedEvents.length > 0
  const hasAllDayEvents = allDayEvents.length > 0
  const hasAnyEvents = hasEvents || hasAllDayEvents || hasTimedEvents

  if (!showTitle) {
    if (hasAnyEvents) {
      const date = new Date(year, month, day)
      const totalEvents = allDayEvents.length + timedEvents.length
      const ariaLabel = `View ${totalEvents} event${totalEvents === 1 ? '' : 's'} on ${MONTHS[month]} ${day}, ${year}`

      return (
        <div className="group relative h-full w-full">
          <DaySummaryPopover
            date={date}
            events={allDayEvents}
            timedEvents={timedEvents}
            allEventsByDate={allEventsByDate}
            timedEventsByDate={allTimedEventsByDate}
            year={year}
            categories={categories}
            googleCalendarCreateUrl={createUrl}
            googleCalendarDayUrl={dayUrl}
            onEventClick={onEventClick}
          >
            <div
              className={cellClassName}
              data-date={dateKey}
              role="button"
              tabIndex={0}
              aria-label={ariaLabel}
              aria-current={isTodayDate ? 'date' : undefined}
            >
              {cellContent}
            </div>
          </DaySummaryPopover>
        </div>
      )
    }

    // Empty day: direct link to create event
    const ariaLabel = `Create event on ${MONTHS[month]} ${day}, ${year}`
    return (
      <div className="group relative h-full w-full">
        <a
          className={cellClassName}
          data-date={dateKey}
          href={createUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel}
          aria-current={isTodayDate ? 'date' : undefined}
        />
      </div>
    )
  }

  // Scrollable mode (showTitle=true): click events in DayEventsStack, anchor links to Google Calendar
  const ariaLabel = hasEvents
    ? `${singleDayEvents.length} event${singleDayEvents.length === 1 ? '' : 's'} on ${MONTHS[month]} ${day}, ${year}`
    : `Create event on ${MONTHS[month]} ${day}, ${year}`

  return (
    <div className="group relative h-full w-full">
      <a
        className={cellClassName}
        data-date={dateKey}
        href={createUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        aria-current={isTodayDate ? 'date' : undefined}
      >
        {cellContent}
      </a>
      {showTitle && singleDayEvents.length > 0 ? (
        <DayEventsStack
          dateKey={dateKey}
          events={singleDayEvents}
          titleDensityScale={titleDensityScale}
          availableHeight={availableHeight}
          availableWidth={availableWidth}
          activeEventId={activeEventId}
          activeTooltipId={activeTooltipId}
          onEventClick={onEventClick}
        />
      ) : null}
    </div>
  )
}

interface DayEventsStackProps {
  dateKey: string
  events: YearbirdEvent[]
  titleDensityScale: number
  availableHeight: number
  availableWidth: number
  activeEventId?: string
  activeTooltipId?: string
  onEventClick?: (event: YearbirdEvent, position: { x: number; y: number }) => void
}

const allocateStackLines = (neededLines: number[], maxLinesTotal: number) => {
  const eventCount = neededLines.length
  if (eventCount === 0) {
    return []
  }
  if (maxLinesTotal <= eventCount) {
    return Array.from({ length: eventCount }, () => 1)
  }

  const totalNeededLines = neededLines.reduce((sum, lines) => sum + lines, 0)
  if (totalNeededLines <= maxLinesTotal) {
    return [...neededLines]
  }

  const extraNeeded = neededLines.map((lines) => Math.max(0, lines - 1))
  const totalExtraNeeded = extraNeeded.reduce((sum, lines) => sum + lines, 0)
  const availableExtra = maxLinesTotal - eventCount

  if (availableExtra <= 0 || totalExtraNeeded === 0) {
    return Array.from({ length: eventCount }, () => 1)
  }
  if (totalExtraNeeded <= availableExtra) {
    return neededLines.map((lines) => Math.max(1, lines))
  }

  const allocations = extraNeeded.map(
    (lines) => 1 + Math.floor((lines / totalExtraNeeded) * availableExtra)
  )
  const allocatedTotal = allocations.reduce((sum, lines) => sum + lines, 0)
  let remaining = Math.max(0, maxLinesTotal - allocatedTotal)
  const order = extraNeeded
    .map((lines, index) => ({ lines, index }))
    .filter(({ lines }) => lines > 0)
    .sort((a, b) => b.lines - a.lines)
    .map(({ index }) => index)

  let cursor = 0
  while (remaining > 0 && order.length > 0) {
    const index = order[cursor % order.length]
    if (allocations[index] < neededLines[index]) {
      allocations[index] += 1
      remaining -= 1
    }
    cursor += 1
  }

  return allocations
}

function DayEventsStack({
  dateKey,
  events,
  titleDensityScale,
  availableHeight,
  availableWidth,
  activeEventId,
  activeTooltipId,
  onEventClick,
}: DayEventsStackProps) {
  if (events.length === 0) {
    return null
  }

  const stackFontSize = STACK_FONT_BASE + titleDensityScale * STACK_FONT_RANGE
  const lineHeight = STACK_LINE_HEIGHT_BASE + titleDensityScale * STACK_LINE_HEIGHT_RANGE
  const lineHeightPx = stackFontSize * lineHeight
  const gapPx = events.length > STACK_GAP_DENSE_THRESHOLD ? STACK_GAP_DENSE_PX : STACK_GAP_SPARSE_PX
  const totalGap = gapPx * Math.max(0, events.length - 1)
  const stackAvailable = Math.max(0, availableHeight - STACK_PADDING_PX - totalGap)
  const maxLinesTotal = lineHeightPx > 0 ? Math.floor(stackAvailable / lineHeightPx) : 0
  const gridContentWidth =
    availableWidth > 0
      ? Math.max(0, availableWidth - GRID_GAP_PX * (DAY_COLUMN_COUNT - 1))
      : 0
  const cellWidth = gridContentWidth > 0 ? gridContentWidth / DAY_COLUMN_COUNT : 0
  const charsPerLine =
    cellWidth > 0
      ? Math.max(
          STACK_MIN_CHARS_PER_LINE,
          Math.floor(cellWidth / (stackFontSize * STACK_CHAR_WIDTH_RATIO))
        )
      : STACK_FALLBACK_CHARS_PER_LINE
  const estimatedLines = events.map((event) =>
    Math.max(1, Math.ceil(event.title.length / charsPerLine))
  )
  const canFitOneLineEach = maxLinesTotal >= events.length
  const showStackTitles = titleDensityScale >= STACK_TITLE_DENSITY_THRESHOLD && canFitOneLineEach
  const lineAllocations = showStackTitles
    ? allocateStackLines(estimatedLines, maxLinesTotal)
    : []

  return (
    <div
      className={clsx(
        'pointer-events-none absolute inset-x-1 inset-y-1 flex flex-col justify-end overflow-hidden',
        events.length > STACK_GAP_DENSE_THRESHOLD ? 'gap-0.5' : 'gap-1'
      )}
    >
      {events.map((event, index) => {
        const describedByItem = activeEventId === event.id ? activeTooltipId : undefined
        const clampLines = showStackTitles ? lineAllocations[index] ?? 1 : undefined
        const shouldClamp = showStackTitles && clampLines !== undefined && clampLines < estimatedLines[index]

        const handleItemClick = (eventClick: MouseEvent<HTMLDivElement>) => {
          onEventClick?.(event, { x: eventClick.clientX, y: eventClick.clientY })
        }
        const handleItemFocus = (eventFocus: FocusEvent<HTMLDivElement>) => {
          const rect = eventFocus.currentTarget.getBoundingClientRect()
          onEventClick?.(event, { x: rect.left + rect.width / 2, y: rect.top + rect.height })
        }
        const handleItemKeyDown = (eventKey: KeyboardEvent<HTMLDivElement>) => {
          if (eventKey.key !== 'Enter' && eventKey.key !== ' ') {
            return
          }
          eventKey.preventDefault()
          const rect = eventKey.currentTarget.getBoundingClientRect()
          onEventClick?.(event, { x: rect.left + rect.width / 2, y: rect.top + rect.height })
        }

        return (
          <div
            key={`${dateKey}-${event.id}`}
            className={clsx(
              'pointer-events-auto cursor-pointer rounded-sm text-white',
              showStackTitles ? 'px-1.5 break-words' : 'px-1'
            )}
            style={{
              backgroundColor: event.color,
              fontSize: `${stackFontSize}px`,
              lineHeight,
              height: showStackTitles ? 'auto' : `${STACK_BAR_HEIGHT_PX}px`,
              display: shouldClamp ? '-webkit-box' : 'block',
              WebkitBoxOrient: shouldClamp ? 'vertical' : undefined,
              WebkitLineClamp: shouldClamp ? clampLines : undefined,
              overflow: shouldClamp ? 'hidden' : 'visible',
            }}
            role="button"
            tabIndex={0}
            aria-label={event.title}
            aria-describedby={describedByItem}
            onClick={handleItemClick}
            onFocus={handleItemFocus}
            onKeyDown={handleItemKeyDown}
          >
            {showStackTitles ? event.title : null}
          </div>
        )
      })}
    </div>
  )
}
