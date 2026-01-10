import { useCallback, type KeyboardEvent, type MouseEvent } from 'react'
import type { YearbirdEvent } from '../../types/calendar'
import type { CategoryConfig } from '../../types/categories'
import { ExternalLinkIcon } from '../icons/ExternalLinkIcon'

interface EventListItemProps {
  event: YearbirdEvent
  category: CategoryConfig
  onClick?: (event: YearbirdEvent, position: { x: number; y: number }) => void
  onKeyDown?: (e: KeyboardEvent) => void
  isHighlighted?: boolean
}

/**
 * EventListItem displays an individual event row inside the DaySummaryPopover.
 *
 * @example
 * <EventListItem
 *   event={event}
 *   category={category}
 *   onClick={(e, pos) => openTooltip(e, pos)}
 *   isHighlighted={selectedIndex === index}
 * />
 */
export function EventListItem({
  event,
  category,
  onClick,
  onKeyDown,
  isHighlighted = false,
}: EventListItemProps) {
  const calendarLabel = event.calendarName ?? event.calendarId
  const dotColor = event.color || category.color

  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      onClick?.(event, { x: e.clientX, y: e.clientY })
    },
    [event, onClick]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Handle Enter/Space to trigger click
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const rect = e.currentTarget.getBoundingClientRect()
        onClick?.(event, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      }
      // Forward other key events to parent handler
      onKeyDown?.(e)
    },
    [event, onClick, onKeyDown]
  )

  const handleExternalLinkClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      e.stopPropagation()
    },
    []
  )

  const handleExternalLinkKeyDown = useCallback(
    (e: KeyboardEvent<HTMLAnchorElement>) => {
      // Prevent row handler from intercepting link activation
      if (e.key === 'Enter' || e.key === ' ') {
        e.stopPropagation()
      }
    },
    []
  )

  return (
    <div
      role="button"
      tabIndex={0}
      className={`flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 transition ${
        isHighlighted ? 'bg-zinc-100' : 'hover:bg-zinc-50'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={event.title}
    >
      {/* Color dot */}
      <span
        className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full border border-zinc-200"
        style={{ backgroundColor: dotColor }}
        aria-hidden="true"
      />

      {/* Event details */}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium text-zinc-900">{event.title}</p>
        {calendarLabel ? (
          <p className="truncate text-xs text-zinc-500">{calendarLabel}</p>
        ) : null}
      </div>

      {/* External link icon */}
      {event.googleLink ? (
        <a
          href={event.googleLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 flex-shrink-0 rounded p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          aria-label={`Open ${event.title} in Google Calendar`}
          onClick={handleExternalLinkClick}
          onKeyDown={handleExternalLinkKeyDown}
        >
          <ExternalLinkIcon className="h-4 w-4" />
        </a>
      ) : null}
    </div>
  )
}
