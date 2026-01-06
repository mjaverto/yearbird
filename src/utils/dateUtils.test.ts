import { describe, expect, it, vi } from 'vitest'
import {
  formatRelativeTime,
  getDaysInMonth,
  isLeapYear,
  isPastDate,
  isToday,
  isWeekend,
} from './dateUtils'

describe('dateUtils', () => {
  it('detects leap years correctly', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(1900)).toBe(false)
    expect(isLeapYear(2000)).toBe(true)
  })

  it('returns correct days in month', () => {
    expect(getDaysInMonth(2025, 1)).toBe(28)
    expect(getDaysInMonth(2024, 1)).toBe(29)
    expect(getDaysInMonth(2025, 3)).toBe(30)
  })

  it('identifies weekends', () => {
    expect(isWeekend(2024, 5, 8)).toBe(true)
    expect(isWeekend(2024, 5, 10)).toBe(false)
  })

  it('identifies today based on system time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 0, 15))

    expect(isToday(2025, 0, 15)).toBe(true)
    expect(isToday(2025, 0, 14)).toBe(false)

    vi.useRealTimers()
  })

  it('detects past dates relative to today', () => {
    const today = new Date(2025, 0, 15)

    expect(isPastDate(2025, 0, 14, today)).toBe(true)
    expect(isPastDate(2025, 0, 15, today)).toBe(false)
    expect(isPastDate(2025, 0, 16, today)).toBe(false)
  })

  it('formats relative times', () => {
    const now = new Date('2026-01-01T12:00:00.000Z')

    expect(formatRelativeTime(new Date('2026-01-01T12:00:00.000Z'), now)).toBe('just now')
    expect(formatRelativeTime(new Date('2026-01-01T11:50:00.000Z'), now)).toBe('10m ago')
    expect(formatRelativeTime(new Date('2026-01-01T10:00:00.000Z'), now)).toBe('2h ago')
  })
})
