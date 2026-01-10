import type { KeyboardEvent, MouseEvent } from 'react'
import clsx from 'clsx'
import type { EventBar } from '../../utils/eventBars'
import type { YearbirdEvent } from '../../types/calendar'
import { getDensityScale } from '../../utils/density'

type TooltipPosition = { x: number; y: number }

interface EventBarsProps {
  bars: EventBar[]
  onEventClick?: (event: YearbirdEvent, position: TooltipPosition) => void
  activeEventId?: string
  activeTooltipId?: string
  isScrollable?: boolean
  scrollDensity?: number
}

const DAY_COLUMN_COUNT = 31
const ROW_HEIGHT_PERCENT = 18
const ROW_GAP_PERCENT = 2
const SCROLL_ROW_HEIGHT_MAX = 30
const SCROLL_ROW_HEIGHT_MIN = 10
const SCROLL_BAR_FONT_MAX = 12
const SCROLL_BAR_FONT_MIN = 8

export function EventBars({
  bars,
  onEventClick,
  activeEventId,
  activeTooltipId,
  isScrollable = false,
  scrollDensity = 60,
}: EventBarsProps) {
  if (bars.length === 0) {
    return null
  }

  const rowCount = Math.max(1, ...bars.map((bar) => bar.row + 1))
  const totalGap = (rowCount - 1) * ROW_GAP_PERCENT
  const availableHeight = Math.max(0, 100 - totalGap)
  const computedRowHeight = availableHeight / rowCount
  const densityScale = getDensityScale(scrollDensity)
  const maxRowHeight = isScrollable
    ? SCROLL_ROW_HEIGHT_MIN + densityScale * (SCROLL_ROW_HEIGHT_MAX - SCROLL_ROW_HEIGHT_MIN)
    : ROW_HEIGHT_PERCENT
  const rowHeightPercent = Math.min(maxRowHeight, computedRowHeight)

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {bars.map((bar) => (
        <EventBarItem
          key={`${bar.event.id}-${bar.month}`}
          bar={bar}
          rowHeightPercent={rowHeightPercent}
          isActive={activeEventId === bar.event.id}
          tooltipId={activeTooltipId}
          isScrollable={isScrollable}
          densityScale={densityScale}
          onClick={(position) => onEventClick?.(bar.event, position)}
        />
      ))}
    </div>
  )
}

interface EventBarItemProps {
  bar: EventBar
  rowHeightPercent: number
  isActive: boolean
  tooltipId?: string
  isScrollable: boolean
  densityScale: number
  onClick: (position: TooltipPosition) => void
}

function EventBarItem({
  bar,
  rowHeightPercent,
  isActive,
  tooltipId,
  isScrollable,
  densityScale,
  onClick,
}: EventBarItemProps) {
  // In scrollable mode, use density-based sizing; otherwise use CSS variable for TV scaling
  const barFontSize = isScrollable
    ? `${SCROLL_BAR_FONT_MIN + densityScale * (SCROLL_BAR_FONT_MAX - SCROLL_BAR_FONT_MIN)}px`
    : 'var(--tv-event-bar-font)'
  const left = ((bar.startDay - 1) / DAY_COLUMN_COUNT) * 100
  const width = ((bar.endDay - bar.startDay + 1) / DAY_COLUMN_COUNT) * 100
  const top = bar.row * (rowHeightPercent + ROW_GAP_PERCENT)
  const describedBy = isActive ? tooltipId : undefined

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    onClick({ x: event.clientX, y: event.clientY })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      onClick({ x: rect.left + rect.width / 2, y: rect.top + rect.height })
    }
  }

  return (
    <div
      className="group pointer-events-auto absolute"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        top: `${top}%`,
        height: `${rowHeightPercent}%`,
      }}
    >
      <div
        className={clsx(
          'relative flex h-full w-full cursor-pointer items-center truncate rounded-sm',
          isScrollable ? 'px-1.5 pr-7' : 'px-1 pr-7 text-[10px]',
          'font-medium text-white',
          'transition hover:brightness-110',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/80',
          "before:absolute before:-inset-y-0.5 before:-inset-x-0.5 before:content-[''] before:rounded-sm before:bg-transparent"
        )}
        style={{
          backgroundColor: bar.event.color,
          fontSize: barFontSize,
        }}
        role="button"
        tabIndex={0}
        aria-label={bar.event.title}
        aria-describedby={describedBy}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <span className="truncate">{bar.event.title}</span>
      </div>
    </div>
  )
}
