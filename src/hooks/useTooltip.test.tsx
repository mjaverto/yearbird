import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

  it('shows tooltip when clicking an event', async () => {
    const { useTooltip } = await import('./useTooltip')
    const event = buildEvent()

    const { result } = renderHook(() => useTooltip())

    act(() => {
      result.current.showTooltip(event, { x: 10, y: 20 })
    })

    expect(result.current.tooltip.event).toEqual(event)
    expect(result.current.tooltip.position).toEqual({ x: 10, y: 20 })
  })

  it('toggles tooltip off when clicking the same event', async () => {
    const { useTooltip } = await import('./useTooltip')
    const event = buildEvent()

    const { result } = renderHook(() => useTooltip())

    // Click to show
    act(() => {
      result.current.showTooltip(event, { x: 10, y: 20 })
    })
    expect(result.current.tooltip.event).toEqual(event)

    // Click same event to toggle off
    act(() => {
      result.current.showTooltip(event, { x: 10, y: 20 })
    })
    expect(result.current.tooltip.event).toBeNull()
  })

  it('switches tooltip when clicking a different event', async () => {
    const { useTooltip } = await import('./useTooltip')
    const eventA = buildEvent({ id: 'event-a' })
    const eventB = buildEvent({ id: 'event-b' })

    const { result } = renderHook(() => useTooltip())

    act(() => {
      result.current.showTooltip(eventA, { x: 1, y: 1 })
    })
    expect(result.current.tooltip.event?.id).toBe('event-a')

    act(() => {
      result.current.showTooltip(eventB, { x: 2, y: 2 })
    })
    expect(result.current.tooltip.event?.id).toBe('event-b')
  })

  it('hides tooltip immediately with hideTooltip', async () => {
    const { useTooltip } = await import('./useTooltip')
    const event = buildEvent()

    const { result } = renderHook(() => useTooltip())

    act(() => {
      result.current.showTooltip(event, { x: 10, y: 20 })
    })
    expect(result.current.tooltip.event).not.toBeNull()

    act(() => {
      result.current.hideTooltip()
    })
    expect(result.current.tooltip.event).toBeNull()
  })

  it('returns a tooltipRef for click-away detection', async () => {
    const { useTooltip } = await import('./useTooltip')

    const { result } = renderHook(() => useTooltip())

    expect(result.current.tooltipRef).toBeDefined()
    expect(result.current.tooltipRef.current).toBeNull()
  })

  it('provides backward-compatible no-op functions', async () => {
    const { useTooltip } = await import('./useTooltip')

    const { result } = renderHook(() => useTooltip())

    // These should not throw
    expect(() => result.current.updateTooltipPosition({ x: 0, y: 0 })).not.toThrow()
    expect(() => result.current.cancelHideTooltip()).not.toThrow()
    expect(() => result.current.scheduleHideTooltip()).not.toThrow()
  })
})
