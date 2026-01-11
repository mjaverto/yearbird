import { describe, expect, it, vi } from 'vitest'
import {
  DAYS_IN_MONTH,
  MONTHS,
  addDays,
  formatRelativeTime,
  getDateKey,
  getDateKeyFromParts,
  getDaysInMonth,
  isLeapYear,
  isPastDate,
  isToday,
  isWeekend,
  parseDateValue,
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

describe('MONTHS constant', () => {
  it('has 12 months', () => {
    expect(MONTHS).toHaveLength(12)
  })

  it('starts with Jan and ends with Dec', () => {
    expect(MONTHS[0]).toBe('Jan')
    expect(MONTHS[11]).toBe('Dec')
  })
})

describe('DAYS_IN_MONTH constant', () => {
  it('has correct days for each month (non-leap year)', () => {
    expect(DAYS_IN_MONTH[0]).toBe(31) // January
    expect(DAYS_IN_MONTH[1]).toBe(28) // February (non-leap)
    expect(DAYS_IN_MONTH[3]).toBe(30) // April
    expect(DAYS_IN_MONTH[6]).toBe(31) // July
  })
})

describe('parseDateValue', () => {
  it('returns null for empty string', () => {
    expect(parseDateValue('')).toBeNull()
  })

  it('parses YYYY-MM-DD format correctly', () => {
    const result = parseDateValue('2025-01-15')
    expect(result).not.toBeNull()
    expect(result?.getFullYear()).toBe(2025)
    expect(result?.getMonth()).toBe(0) // January
    expect(result?.getDate()).toBe(15)
  })

  it('returns null for invalid YYYY-MM-DD format', () => {
    expect(parseDateValue('2025-13-01')).toBeNull() // Invalid month
    expect(parseDateValue('2025-02-30')).toBeNull() // Invalid day for Feb
  })

  it('parses ISO datetime strings', () => {
    const result = parseDateValue('2025-03-20T10:30:00Z')
    expect(result).not.toBeNull()
    expect(result?.getFullYear()).toBe(2025)
    expect(result?.getMonth()).toBe(2) // March
    expect(result?.getDate()).toBe(20)
  })

  it('returns null for completely invalid strings', () => {
    expect(parseDateValue('not-a-date')).toBeNull()
    expect(parseDateValue('abc')).toBeNull()
  })

  it('handles malformed YYYY-MM-DD values', () => {
    expect(parseDateValue('2025-00-15')).toBeNull() // Month 0 is invalid
    expect(parseDateValue('2025-01-00')).toBeNull() // Day 0 is invalid
  })
})

describe('getDateKey', () => {
  it('formats date as YYYY-MM-DD', () => {
    const date = new Date(2025, 0, 15) // January 15, 2025
    expect(getDateKey(date)).toBe('2025-01-15')
  })

  it('pads single-digit months and days', () => {
    const date = new Date(2025, 0, 5) // January 5, 2025
    expect(getDateKey(date)).toBe('2025-01-05')
  })

  it('handles December correctly', () => {
    const date = new Date(2025, 11, 31) // December 31, 2025
    expect(getDateKey(date)).toBe('2025-12-31')
  })
})

describe('getDateKeyFromParts', () => {
  it('formats parts as YYYY-MM-DD', () => {
    expect(getDateKeyFromParts(2025, 1, 15)).toBe('2025-01-15')
  })

  it('pads single-digit months and days', () => {
    expect(getDateKeyFromParts(2025, 1, 5)).toBe('2025-01-05')
    expect(getDateKeyFromParts(2025, 9, 1)).toBe('2025-09-01')
  })

  it('handles December correctly', () => {
    expect(getDateKeyFromParts(2025, 12, 31)).toBe('2025-12-31')
  })
})

describe('addDays', () => {
  it('adds positive days correctly', () => {
    const date = new Date(2025, 0, 15) // January 15, 2025
    const result = addDays(date, 5)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(0)
    expect(result.getDate()).toBe(20)
  })

  it('subtracts days with negative value', () => {
    const date = new Date(2025, 0, 15) // January 15, 2025
    const result = addDays(date, -5)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(0)
    expect(result.getDate()).toBe(10)
  })

  it('handles month boundaries', () => {
    const date = new Date(2025, 0, 30) // January 30, 2025
    const result = addDays(date, 5)
    expect(result.getMonth()).toBe(1) // February
    expect(result.getDate()).toBe(4)
  })

  it('handles year boundaries', () => {
    const date = new Date(2024, 11, 30) // December 30, 2024
    const result = addDays(date, 5)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(0) // January
    expect(result.getDate()).toBe(4)
  })

  it('does not mutate original date', () => {
    const original = new Date(2025, 0, 15)
    const originalTime = original.getTime()
    addDays(original, 5)
    expect(original.getTime()).toBe(originalTime)
  })

  it('normalizes to midnight', () => {
    const date = new Date(2025, 0, 15, 14, 30, 45) // With time
    const result = addDays(date, 1)
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
  })
})
