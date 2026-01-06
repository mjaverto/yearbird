import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCalendarVisibility } from './useCalendarVisibility'

const calendars = [{ id: 'primary', summary: 'Personal' }]

const STORAGE_KEY = 'yearbird:disabled-calendars'

describe('useCalendarVisibility', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('filters unknown calendar ids and syncs storage', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['primary', 'unknown']))

    const { result } = renderHook(() => useCalendarVisibility(calendars))

    expect(result.current.disabledCalendarIds).toEqual(['primary'])

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual(['primary'])
    })
  })


  it('keeps stored ids when calendar list is empty', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['primary']))

    const { result } = renderHook(() => useCalendarVisibility([]))

    expect(result.current.disabledCalendarIds).toEqual(['primary'])
  })
  it('toggles visibility', () => {
    const { result } = renderHook(() => useCalendarVisibility(calendars))

    expect(result.current.visibleCalendarIds).toEqual(['primary'])

    act(() => {
      result.current.disableCalendar('primary')
    })
    expect(result.current.visibleCalendarIds).toEqual([])

    act(() => {
      result.current.enableCalendar('primary')
    })
    expect(result.current.visibleCalendarIds).toEqual(['primary'])
  })
})
