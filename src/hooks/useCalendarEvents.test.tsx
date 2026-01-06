import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setCachedEvents } from '../services/cache'
import { fetchEventsForYear } from '../services/calendar'
import type { YearbirdEvent } from '../types/calendar'
import { useCalendarEvents } from './useCalendarEvents'

vi.mock('../services/calendar', () => ({
  fetchEventsForYear: vi.fn(),
}))

const fetchEventsForYearMock = vi.mocked(fetchEventsForYear)
const CALENDAR_IDS = ['primary']

const cachedEvent: YearbirdEvent = {
  id: 'primary:1',
  title: 'Trip',
  startDate: '2026-01-01',
  endDate: '2026-01-03',
  isAllDay: true,
  isMultiDay: true,
  durationDays: 2,
  googleLink: '',
  category: 'uncategorized',
  color: '#9CA3AF',
}

describe('useCalendarEvents', () => {
  beforeEach(() => {
    localStorage.clear()
    fetchEventsForYearMock.mockReset()
  })

  it('does not fetch without an access token', () => {
    const { result } = renderHook(() => useCalendarEvents(null, 2026, CALENDAR_IDS))

    expect(fetchEventsForYearMock).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.events).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('uses cached data immediately', async () => {
    setCachedEvents(2026, [cachedEvent], 'primary')

    const { result } = renderHook(() => useCalendarEvents('token', 2026, CALENDAR_IDS))

    await waitFor(() => expect(result.current.isFromCache).toBe(true))
    expect(result.current.events).toHaveLength(1)
    expect(fetchEventsForYearMock).not.toHaveBeenCalled()
  })

  it('fetches when cache is missing and allows refresh', async () => {
    fetchEventsForYearMock.mockResolvedValueOnce([
      {
        id: '1',
        summary: "Mom's birthday",
        start: { date: '2026-06-10' },
        end: { date: '2026-06-11' },
        status: 'confirmed',
        htmlLink: '',
      },
      {
        id: '2',
        summary: 'Meeting',
        start: { dateTime: '2026-01-02T10:00:00Z' },
        end: { dateTime: '2026-01-02T11:00:00Z' },
        status: 'confirmed',
        htmlLink: '',
      },
    ])

    const { result } = renderHook(() => useCalendarEvents('token', 2026, CALENDAR_IDS))

    await waitFor(() => expect(fetchEventsForYearMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.events).toHaveLength(1))
    expect(result.current.isFromCache).toBe(false)
    expect(result.current.events[0]?.category).toBe('birthdays')

    fetchEventsForYearMock.mockResolvedValueOnce([
      {
        id: '3',
        summary: 'Retreat',
        start: { date: '2026-02-01' },
        end: { date: '2026-02-04' },
        status: 'confirmed',
        htmlLink: '',
      },
    ])

    await act(async () => {
      await result.current.refetch()
    })

    await waitFor(() => expect(fetchEventsForYearMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.events[0]?.id).toBe('primary:3'))
  })

  it('sets error when fetch fails', async () => {
    fetchEventsForYearMock.mockRejectedValueOnce(new Error('UNAUTHORIZED'))

    const { result } = renderHook(() => useCalendarEvents('token', 2026, CALENDAR_IDS))

    await waitFor(() => {
      expect(result.current.error).toBe('UNAUTHORIZED')
    })
  })
})
