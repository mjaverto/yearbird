import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { YearbirdEvent } from '../types/calendar'

const buildEvent = (overrides: Partial<YearbirdEvent> = {}): YearbirdEvent => ({
  id: 'event-1',
  title: 'Trip',
  startDate: '2025-01-10',
  endDate: '2025-01-12',
  isAllDay: true,
  isMultiDay: true,
  durationDays: 3,
  googleLink: 'https://calendar.google.com',
  category: 'holidays',
  color: '#F59E0B',
  ...overrides,
})

describe('useTooltip', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows and hides tooltip with delay', async () => {
    vi.useFakeTimers()
    const { useTooltip } = await import('./useTooltip')
    const event = buildEvent()

    const { result } = renderHook(() => useTooltip())

    act(() => {
      result.current.showTooltip(event, { x: 10, y: 20 })
    })

    expect(result.current.tooltip.event).toEqual(event)
    expect(result.current.tooltip.position).toEqual({ x: 10, y: 20 })

    act(() => {
      result.current.cancelHideTooltip()
      result.current.scheduleHideTooltip()
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.tooltip.event).toBeNull()
    vi.useRealTimers()
  })

  describe('with requestAnimationFrame', () => {
    beforeEach(() => {
      const raf = vi.fn((callback: FrameRequestCallback) => {
        callback(0)
        return 1
      })
      vi.stubGlobal('requestAnimationFrame', raf)
      vi.stubGlobal('cancelAnimationFrame', vi.fn())
      vi.resetModules()
    })

    it('updates position with requestAnimationFrame', async () => {
      const { useTooltip } = await import('./useTooltip')
      const event = buildEvent()
      const { result } = renderHook(() => useTooltip())

      act(() => {
        result.current.showTooltip(event, { x: 4, y: 8 }, 'focus')
      })

      act(() => {
        result.current.updateTooltipPosition({ x: 12, y: 24 })
      })

      act(() => {
        result.current.updateTooltipPosition({ x: 12, y: 24 })
      })

      expect(result.current.tooltip.position).toEqual({ x: 12, y: 24 })
    })

    it('ignores position updates when no event is active', async () => {
      const { useTooltip } = await import('./useTooltip')
      const { result } = renderHook(() => useTooltip())

      act(() => {
        result.current.updateTooltipPosition({ x: 5, y: 5 })
      })

      expect(result.current.tooltip.event).toBeNull()
    })

    it('locks pointer-driven tooltips after opening', async () => {
      const { useTooltip } = await import('./useTooltip')
      const event = buildEvent({ id: 'event-locked' })
      const { result } = renderHook(() => useTooltip())

      act(() => {
        result.current.showTooltip(event, { x: 8, y: 12 }, 'pointer')
      })

      act(() => {
        result.current.updateTooltipPosition({ x: 20, y: 30 })
      })

      expect(result.current.tooltip.position).toEqual({ x: 8, y: 12 })
    })
  })

  it('skips scheduling when a frame is already pending', async () => {
    const callbacks: FrameRequestCallback[] = []
    const raf = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback)
      return callbacks.length
    })
    vi.stubGlobal('requestAnimationFrame', raf)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.resetModules()

    const { useTooltip } = await import('./useTooltip')
    const { result } = renderHook(() => useTooltip())

    act(() => {
      result.current.updateTooltipPosition({ x: 3, y: 7 })
    })

    act(() => {
      result.current.updateTooltipPosition({ x: 5, y: 9 })
    })

    expect(raf).toHaveBeenCalledTimes(1)

    act(() => {
      callbacks[0]?.(0)
    })

  })

  it('hides immediately for focus-driven tooltips', async () => {
    const { useTooltip } = await import('./useTooltip')
    const event = buildEvent({ id: 'focus-hide' })
    const { result } = renderHook(() => useTooltip())

    act(() => {
      result.current.showTooltip(event, { x: 6, y: 9 }, 'focus')
    })

    act(() => {
      result.current.scheduleHideTooltip()
    })

    expect(result.current.tooltip.event).toBeNull()
  })

  it('immediately switches tooltips when hovering a new event during hide delay', async () => {
    vi.useFakeTimers()
    const { useTooltip } = await import('./useTooltip')
    const eventA = buildEvent({ id: 'event-a' })
    const eventB = buildEvent({ id: 'event-b' })
    const { result } = renderHook(() => useTooltip())

    act(() => {
      result.current.showTooltip(eventA, { x: 2, y: 4 }, 'pointer')
    })

    act(() => {
      result.current.scheduleHideTooltip()
    })

    // New event should show immediately - no need to wait for delay
    act(() => {
      result.current.showTooltip(eventB, { x: 8, y: 10 }, 'pointer')
    })

    expect(result.current.tooltip.event).toEqual(eventB)

    // Delay should have been cancelled, so advancing time should not hide tooltip
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.tooltip.event).toEqual(eventB)
    vi.useRealTimers()
  })

  it('handles rapid hover across multiple events without flicker', async () => {
    vi.useFakeTimers()
    const { useTooltip } = await import('./useTooltip')
    const eventA = buildEvent({ id: 'event-a' })
    const eventB = buildEvent({ id: 'event-b' })
    const eventC = buildEvent({ id: 'event-c' })
    const eventD = buildEvent({ id: 'event-d' })
    const { result } = renderHook(() => useTooltip())

    // Simulate rapid mouse movement across 4 events
    act(() => {
      result.current.showTooltip(eventA, { x: 1, y: 1 }, 'pointer')
    })
    expect(result.current.tooltip.event?.id).toBe('event-a')

    act(() => {
      result.current.scheduleHideTooltip()
      result.current.showTooltip(eventB, { x: 2, y: 2 }, 'pointer')
    })
    expect(result.current.tooltip.event?.id).toBe('event-b')

    act(() => {
      result.current.scheduleHideTooltip()
      result.current.showTooltip(eventC, { x: 3, y: 3 }, 'pointer')
    })
    expect(result.current.tooltip.event?.id).toBe('event-c')

    act(() => {
      result.current.scheduleHideTooltip()
      result.current.showTooltip(eventD, { x: 4, y: 4 }, 'pointer')
    })
    expect(result.current.tooltip.event?.id).toBe('event-d')

    // Final event should persist after delay (no hide scheduled since we're still on an event)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.tooltip.event?.id).toBe('event-d')

    vi.useRealTimers()
  })

  it('falls back to immediate updates when raf is unavailable', async () => {
    vi.stubGlobal('requestAnimationFrame', undefined)
    vi.stubGlobal('cancelAnimationFrame', undefined)
    vi.resetModules()

    const { useTooltip } = await import('./useTooltip')
    const event = buildEvent({ id: 'event-2' })
    const { result } = renderHook(() => useTooltip())

    act(() => {
      result.current.showTooltip(event, { x: 1, y: 1 }, 'focus')
    })

    act(() => {
      result.current.updateTooltipPosition({ x: 2, y: 3 })
    })

    act(() => {
      result.current.updateTooltipPosition({ x: 6, y: 9 })
    })

    expect(result.current.tooltip.position).toEqual({ x: 6, y: 9 })
  })

  it('ignores updates without an active event when raf is unavailable', async () => {
    vi.stubGlobal('requestAnimationFrame', undefined)
    vi.stubGlobal('cancelAnimationFrame', undefined)
    vi.resetModules()

    const { useTooltip } = await import('./useTooltip')
    const { result } = renderHook(() => useTooltip())

    act(() => {
      result.current.updateTooltipPosition({ x: 4, y: 6 })
    })

    expect(result.current.tooltip.event).toBeNull()
  })

  it('skips updating when position has not changed and raf is unavailable', async () => {
    vi.stubGlobal('requestAnimationFrame', undefined)
    vi.stubGlobal('cancelAnimationFrame', undefined)
    vi.resetModules()

    const { useTooltip } = await import('./useTooltip')
    const event = buildEvent({ id: 'event-same-position' })
    const { result } = renderHook(() => useTooltip())

    act(() => {
      result.current.showTooltip(event, { x: 5, y: 7 }, 'focus')
    })

    act(() => {
      result.current.updateTooltipPosition({ x: 5, y: 7 })
    })

    expect(result.current.tooltip.position).toEqual({ x: 5, y: 7 })
  })

  it('skips updating when position has not changed with requestAnimationFrame', async () => {
    const callbacks: FrameRequestCallback[] = []
    const raf = vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback)
      return callbacks.length
    })
    vi.stubGlobal('requestAnimationFrame', raf)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.resetModules()

    const { useTooltip } = await import('./useTooltip')
    const event = buildEvent({ id: 'event-raf-same' })
    const { result } = renderHook(() => useTooltip())

    act(() => {
      result.current.showTooltip(event, { x: 8, y: 12 }, 'focus')
    })

    act(() => {
      result.current.updateTooltipPosition({ x: 8, y: 12 })
    })

    act(() => {
      callbacks[0]?.(0)
    })

    expect(result.current.tooltip.position).toEqual({ x: 8, y: 12 })
  })
})
