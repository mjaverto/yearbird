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
const HIDE_DELAY_MS = 1000
const CAN_ANIMATE = typeof requestAnimationFrame === 'function'
const CANCEL_ANIMATION = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null

export function useTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState>({
    event: null,
    position: DEFAULT_POSITION,
    source: DEFAULT_SOURCE,
  })
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const positionLockedRef = useRef(false)
  const sourceRef = useRef<TooltipSource>(DEFAULT_SOURCE)
  const rafRef = useRef<number | null>(null)
  const pendingPositionRef = useRef<TooltipState['position'] | null>(null)

  const clearHideTimeout = useCallback(() => {
    if (!hideTimeoutRef.current) {
      return
    }

    clearTimeout(hideTimeoutRef.current)
    hideTimeoutRef.current = null
  }, [])

  const showTooltip = useCallback((
    event: YearbirdEvent,
    position: TooltipState['position'],
    source: TooltipSource = DEFAULT_SOURCE
  ) => {
    // Cancel any pending hide timer so new events show immediately without delay.
    // The 1s delay only applies when leaving events entirely (moving to empty space).
    clearHideTimeout()
    positionLockedRef.current = source === 'pointer'
    sourceRef.current = source
    setTooltip({
      event,
      position,
      source,
    })
  }, [clearHideTimeout])

  const updateTooltipPosition = useCallback((position: TooltipState['position']) => {
    if (positionLockedRef.current) {
      return
    }
    pendingPositionRef.current = position
    if (!CAN_ANIMATE) {
      setTooltip((current) => {
        if (!current.event) {
          return current
        }

        if (current.position.x === position.x && current.position.y === position.y) {
          return current
        }

        return { ...current, position }
      })
      return
    }

    if (rafRef.current !== null) {
      return
    }

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const nextPosition = pendingPositionRef.current
      if (!nextPosition) {
        return
      }

      setTooltip((current) => {
        if (!current.event) {
          return current
        }

        if (current.position.x === nextPosition.x && current.position.y === nextPosition.y) {
          return current
        }

        return {
          ...current,
          position: nextPosition,
        }
      })
    })
  }, [])

  const hideTooltip = useCallback(() => {
    clearHideTimeout()
    positionLockedRef.current = false
    sourceRef.current = DEFAULT_SOURCE
    setTooltip({ event: null, position: DEFAULT_POSITION, source: DEFAULT_SOURCE })
  }, [clearHideTimeout])

  const scheduleHideTooltip = useCallback(() => {
    if (sourceRef.current !== 'pointer') {
      hideTooltip()
      return
    }
    clearHideTimeout()
    hideTimeoutRef.current = setTimeout(() => {
      hideTooltip()
    }, HIDE_DELAY_MS)
  }, [clearHideTimeout, hideTooltip])

  useEffect(() => {
    return () => {
      clearHideTimeout()
      if (rafRef.current !== null && CANCEL_ANIMATION) {
        CANCEL_ANIMATION(rafRef.current)
      }
    }
  }, [clearHideTimeout])

  return {
    tooltip,
    showTooltip,
    updateTooltipPosition,
    scheduleHideTooltip,
    hideTooltip,
    cancelHideTooltip: clearHideTimeout,
  }
}
