import { useCallback, useEffect, useRef, useState } from 'react'
import type { YearbirdEvent } from '../types/calendar'

export type TooltipSource = 'pointer' | 'focus'

interface TooltipState {
  event: YearbirdEvent | null
  position: { x: number; y: number }
  source: TooltipSource
}

const DEFAULT_POSITION = { x: 0, y: 0 }
const DEFAULT_SOURCE: TooltipSource = 'pointer'

export function useTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState>({
    event: null,
    position: DEFAULT_POSITION,
    source: DEFAULT_SOURCE,
  })
  const tooltipRef = useRef<HTMLDivElement | null>(null)

  const showTooltip = useCallback((
    event: YearbirdEvent,
    position: TooltipState['position'],
    source: TooltipSource = DEFAULT_SOURCE
  ) => {
    setTooltip((current) => {
      // Toggle off if clicking the same event
      if (current.event?.id === event.id) {
        return { event: null, position: DEFAULT_POSITION, source: DEFAULT_SOURCE }
      }
      return { event, position, source }
    })
  }, [])

  const hideTooltip = useCallback(() => {
    setTooltip({ event: null, position: DEFAULT_POSITION, source: DEFAULT_SOURCE })
  }, [])

  // Click-away to close tooltip
  useEffect(() => {
    if (!tooltip.event) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      // Don't close if clicking inside the tooltip
      if (tooltipRef.current?.contains(target)) return
      // Don't close if clicking on an event (it will toggle via showTooltip)
      if ((target as Element).closest?.('[role="button"]')) return
      hideTooltip()
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideTooltip()
      }
    }

    // Delay adding listener to avoid immediate close from the click that opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [tooltip.event, hideTooltip])

  return {
    tooltip,
    tooltipRef,
    showTooltip,
    hideTooltip,
    // Keep these for backward compatibility but they're no longer used
    updateTooltipPosition: () => {},
    scheduleHideTooltip: hideTooltip,
    cancelHideTooltip: () => {},
  }
}
