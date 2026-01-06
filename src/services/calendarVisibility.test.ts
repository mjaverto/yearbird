import { beforeEach, describe, expect, it } from 'vitest'
import {
  disableCalendar,
  enableCalendar,
  getDisabledCalendars,
  setDisabledCalendars,
} from './calendarVisibility'

const STORAGE_KEY = 'yearbird:disabled-calendars'

describe('calendarVisibility', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty list for missing or invalid storage', () => {
    expect(getDisabledCalendars()).toEqual([])

    localStorage.setItem(STORAGE_KEY, '{not-json')
    expect(getDisabledCalendars()).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })


  it('clears invalid list payloads', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 'primary' }))

    expect(getDisabledCalendars()).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
  it('dedupes and trims when setting', () => {
    const result = setDisabledCalendars([' primary ', '', 'primary', 'work'])

    expect(result).toEqual(['primary', 'work'])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual(['primary', 'work'])
  })

  it('disables and enables calendars', () => {
    expect(disableCalendar('primary')).toEqual(['primary'])
    expect(disableCalendar('primary')).toEqual(['primary'])

    expect(enableCalendar('primary')).toEqual([])

    expect(enableCalendar('missing')).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
