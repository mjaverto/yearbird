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
} from '../../utils/dateUtils'
import { buildGoogleCalendarCreateUrl } from '../../utils/googleCalendar'
import type { CategoryConfig } from '../../types/categories'
import type { YearbirdEvent } from '../../types/calendar'
import { useTooltip, type TooltipSource } from '../../hooks/useTooltip'
import { calculateEventBars, type EventBar } from '../../utils/eventBars'
import { getDensityScale } from '../../utils/density'
import { DayHeader } from './DayHeader'
import { EventBars } from './EventBars'
import { EventTooltip } from './EventTooltip'
import { getEventTooltipId } from './eventTooltipUtils'

interface YearGridProps {
  year: number
  events: YearbirdEvent[]
  today: Date
  onHideEvent?: (title: string) => void
  categories: CategoryConfig[]
  isScrollable?: boolean
  scrollDensity?: number
  showDayHeader?: boolean
}

const padDay = (value: number) => value.toString().padStart(2, '0')
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

const getDateKey = (year: number, month: number, day: number) => {
  return `${year}-${padDay(month)}-${padDay(day)}`
}

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
        const key = getDateKey(year, current.getMonth() + 1, current.getDate())
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
  today,
  onHideEvent,
  categories,
  isScrollable = false,
  scrollDensity = 60,
  showDayHeader = true,
}: YearGridProps) {
  const {
    tooltip,
    showTooltip,
    updateTooltipPosition,
    scheduleHideTooltip,
    hideTooltip,
    cancelHideTooltip,
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
            eventBars={eventBarsByMonth.get(monthIndex) ?? []}
            onEventHover={showTooltip}
            onEventMove={updateTooltipPosition}
            onEventLeave={scheduleHideTooltip}
            activeEventId={activeEventId}
            activeTooltipId={activeTooltipId}
            isScrollable={isScrollable}
            scrollDensity={scrollDensity}
            className={monthRowClassName}
            style={monthRowStyle}
          />
        ))}
      </div>
      {tooltip.event ? (
        <EventTooltip
          event={tooltip.event}
          position={tooltip.position}
          categories={categories}
          onMouseEnter={cancelHideTooltip}
          onMouseLeave={scheduleHideTooltip}
          onFocus={cancelHideTooltip}
          onBlur={hideTooltip}
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
  eventBars: EventBar[]
  onEventHover?: (event: YearbirdEvent, position: { x: number; y: number }, source?: TooltipSource) => void
  onEventMove?: (position: { x: number; y: number }) => void
  onEventLeave?: (eventId?: string) => void
  activeEventId?: string
  activeTooltipId?: string
  isScrollable?: boolean
  scrollDensity?: number
  className?: string
  style?: CSSProperties
}

function MonthRow({
  year,
  month,
  monthName,
  today,
  singleDayEventsByDate,
  eventBars,
  onEventHover,
  onEventMove,
  onEventLeave,
  activeEventId,
  activeTooltipId,
  isScrollable = false,
  scrollDensity = 60,
  className,
  style,
}: MonthRowProps) {
  const daysInMonth = getDaysInMonth(year, month)
  const [gridSize, setGridSize] = useState({ height: 0, width: 0 })
  const gridRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = gridRef.current
    if (!node || typeof ResizeObserver === 'undefined') {
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
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [])

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
            const dateKey = getDateKey(year, month + 1, day)
            const singleDayEvents = singleDayEventsByDate.get(dateKey) ?? []

            return (
              <DayCell
                key={dayIndex}
                year={year}
                month={month}
                day={day}
                isValid={isValidDay}
                today={today}
                singleDayEvents={singleDayEvents}
                showTitle={isScrollable}
                titleDensity={scrollDensity}
                availableHeight={gridSize.height}
                availableWidth={gridSize.width}
                onEventHover={onEventHover}
                onEventMove={onEventMove}
                onEventLeave={onEventLeave}
                activeEventId={activeEventId}
                activeTooltipId={activeTooltipId}
              />
            )
          })}
        </div>

        <EventBars
          bars={eventBars}
          onEventHover={onEventHover}
          onEventMove={onEventMove}
          onEventLeave={onEventLeave}
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
  singleDayEvents?: YearbirdEvent[]
  showTitle?: boolean
  titleDensity?: number
  availableHeight?: number
  availableWidth?: number
  onEventHover?: (event: YearbirdEvent, position: { x: number; y: number }, source?: TooltipSource) => void
  onEventMove?: (position: { x: number; y: number }) => void
  onEventLeave?: (eventId?: string) => void
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
  showTitle = false,
  titleDensity = 60,
  onEventHover,
  onEventMove,
  availableHeight = 0,
  availableWidth = 0,
  onEventLeave,
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
  const dateKey = getDateKey(year, month + 1, day)
  const url = buildGoogleCalendarCreateUrl(year, month, day)
  const ariaLabel = `Create event on ${MONTHS[month]} ${day}, ${year}`
  const primaryEvent = singleDayEvents[0]
  const eventColor = primaryEvent?.color
  const describedBy =
    !showTitle && primaryEvent && activeEventId === primaryEvent.id ? activeTooltipId : undefined
  const hasMultipleEvents = singleDayEvents.length > 1

  const handleMouseEnter = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!primaryEvent || showTitle) {
      return
    }
    onEventHover?.(primaryEvent, { x: event.clientX, y: event.clientY }, 'pointer')
  }

  const handleMouseMove = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!primaryEvent || showTitle) {
      return
    }
    onEventMove?.({ x: event.clientX, y: event.clientY })
  }

  const handleMouseLeave = () => {
    if (!primaryEvent || showTitle) {
      return
    }
    onEventLeave?.(primaryEvent.id)
  }

  const handleFocus = (event: FocusEvent<HTMLAnchorElement>) => {
    if (!primaryEvent || showTitle) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    onEventHover?.(
      primaryEvent,
      { x: rect.left + rect.width / 2, y: rect.top + rect.height },
      'focus'
    )
  }

  return (
    <div className="group relative h-full w-full">
      <a
        className={clsx(
          'relative block h-full w-full cursor-pointer border border-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500',
          weekend ? 'bg-zinc-50' : 'bg-white',
          isPast && 'opacity-60',
          isTodayDate && 'border-sky-500/80 today-ring'
        )}
        data-date={dateKey}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        aria-current={isTodayDate ? 'date' : undefined}
        aria-describedby={describedBy}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleMouseLeave}
      >
        {eventColor && !showTitle && !hasMultipleEvents ? (
          <span
            className="absolute inset-x-1 bottom-0 h-1 rounded-full"
            style={{ backgroundColor: eventColor }}
            data-color={eventColor}
            aria-hidden="true"
          />
        ) : null}
      </a>
      {!showTitle && hasMultipleEvents ? (
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
      ) : null}
      {showTitle && singleDayEvents.length > 0 ? (
        <DayEventsStack
          dateKey={dateKey}
          events={singleDayEvents}
          titleDensityScale={titleDensityScale}
          availableHeight={availableHeight}
          availableWidth={availableWidth}
          activeEventId={activeEventId}
          activeTooltipId={activeTooltipId}
          onEventHover={onEventHover}
          onEventMove={onEventMove}
          onEventLeave={onEventLeave}
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
  onEventHover?: (event: YearbirdEvent, position: { x: number; y: number }, source?: TooltipSource) => void
  onEventMove?: (position: { x: number; y: number }) => void
  onEventLeave?: () => void
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
  onEventHover,
  onEventMove,
  onEventLeave,
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
        const handleItemMouseEnter = (eventMouse: MouseEvent<HTMLDivElement>) => {
          onEventHover?.(event, { x: eventMouse.clientX, y: eventMouse.clientY }, 'pointer')
        }
        const handleItemMouseMove = (eventMouse: MouseEvent<HTMLDivElement>) => {
          onEventMove?.({ x: eventMouse.clientX, y: eventMouse.clientY })
        }
        const handleItemFocus = (eventFocus: FocusEvent<HTMLDivElement>) => {
          const rect = eventFocus.currentTarget.getBoundingClientRect()
          onEventHover?.(
            event,
            { x: rect.left + rect.width / 2, y: rect.top + rect.height },
            'focus'
          )
        }
        const handleItemKeyDown = (eventKey: KeyboardEvent<HTMLDivElement>) => {
          if (eventKey.key !== 'Enter' && eventKey.key !== ' ') {
            return
          }
          eventKey.preventDefault()
          const rect = eventKey.currentTarget.getBoundingClientRect()
          onEventHover?.(
            event,
            { x: rect.left + rect.width / 2, y: rect.top + rect.height },
            'focus'
          )
        }
        const handleItemClick = (eventClick: MouseEvent<HTMLDivElement>) => {
          onEventHover?.(event, { x: eventClick.clientX, y: eventClick.clientY }, 'pointer')
        }

        return (
          <div
            key={`${dateKey}-${event.id}`}
            className={clsx(
              'pointer-events-auto rounded-sm text-white',
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
            onMouseEnter={handleItemMouseEnter}
            onMouseMove={handleItemMouseMove}
            onMouseLeave={onEventLeave}
            onFocus={handleItemFocus}
            onBlur={onEventLeave}
            onKeyDown={handleItemKeyDown}
          >
            {showStackTitles ? event.title : null}
          </div>
        )
      })}
    </div>
  )
}
