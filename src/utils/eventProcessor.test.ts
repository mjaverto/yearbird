import { describe, expect, it } from 'vitest'
import type { GoogleCalendarEvent } from '../types/calendar'
import { processEvent, processEvents } from './eventProcessor'

const buildAllDayEvent = (
  overrides: Partial<GoogleCalendarEvent> = {}
): GoogleCalendarEvent => ({
  id: '1',
  summary: "Mom's birthday",
  start: { date: '2025-01-15' },
  end: { date: '2025-01-16' },
  status: 'confirmed',
  htmlLink: 'https://example.com',
  ...overrides,
})

describe('processEvent', () => {
  it('keeps all-day single-day events', () => {
    const result = processEvent(buildAllDayEvent())

    expect(result).not.toBeNull()
    expect(result?.isAllDay).toBe(true)
    expect(result?.isMultiDay).toBe(false)
    expect(result?.durationDays).toBe(1)
    expect(result?.startDate).toBe('2025-01-15')
    expect(result?.endDate).toBe('2025-01-15')
    expect(result?.category).toBe('birthdays')
  })

  it('keeps multi-day timed events', () => {
    const event: GoogleCalendarEvent = {
      id: '2',
      summary: 'Conference',
      start: { dateTime: '2025-01-15T09:00:00Z' },
      end: { dateTime: '2025-01-17T17:00:00Z' },
      status: 'confirmed',
      htmlLink: 'https://example.com',
    }

    const result = processEvent(event)

    expect(result).not.toBeNull()
    expect(result?.isAllDay).toBe(false)
    expect(result?.isMultiDay).toBe(true)
    expect(result?.durationDays).toBe(3)
    expect(result?.startDate).toBe('2025-01-15')
    expect(result?.endDate).toBe('2025-01-17')
  })

  it('keeps timed events that cross midnight', () => {
    const event: GoogleCalendarEvent = {
      id: '3',
      summary: 'Overnight work',
      start: { dateTime: '2025-01-15T23:00:00-05:00' },
      end: { dateTime: '2025-01-16T01:00:00-05:00' },
      status: 'confirmed',
      htmlLink: 'https://example.com',
    }

    const result = processEvent(event)

    expect(result).not.toBeNull()
    expect(result?.isMultiDay).toBe(true)
    expect(result?.durationDays).toBe(2)
    expect(result?.startDate).toBe('2025-01-15')
    expect(result?.endDate).toBe('2025-01-16')
  })

  it('uses event time zone for timed events', () => {
    const event: GoogleCalendarEvent = {
      id: '3a',
      summary: 'Overnight travel',
      start: {
        dateTime: '2025-01-01T07:00:00Z',
        timeZone: 'America/Los_Angeles',
      },
      end: {
        dateTime: '2025-01-01T10:00:00Z',
        timeZone: 'America/Los_Angeles',
      },
      status: 'confirmed',
      htmlLink: 'https://example.com',
    }

    const result = processEvent(event)

    expect(result).not.toBeNull()
    expect(result?.startDate).toBe('2024-12-31')
    expect(result?.endDate).toBe('2025-01-01')
    expect(result?.durationDays).toBe(2)
  })

  it('includes single-day timed events with isSingleDayTimed flag', () => {
    const event: GoogleCalendarEvent = {
      id: '4',
      summary: 'Meeting',
      start: { dateTime: '2025-01-15T09:00:00Z' },
      end: { dateTime: '2025-01-15T10:00:00Z' },
      status: 'confirmed',
      htmlLink: 'https://example.com',
    }

    const result = processEvent(event)

    expect(result).not.toBeNull()
    expect(result?.isAllDay).toBe(false)
    expect(result?.isMultiDay).toBe(false)
    expect(result?.isSingleDayTimed).toBe(true)
    expect(result?.durationDays).toBe(1)
  })

  it('extracts time fields for timed events', () => {
    // Use explicit timezone to avoid local timezone issues in tests
    const event: GoogleCalendarEvent = {
      id: '5',
      summary: 'Team Standup',
      start: { dateTime: '2025-01-15T09:30:00Z', timeZone: 'UTC' },
      end: { dateTime: '2025-01-15T10:00:00Z', timeZone: 'UTC' },
      status: 'confirmed',
      htmlLink: 'https://example.com',
    }

    const result = processEvent(event)

    expect(result).not.toBeNull()
    expect(result?.startTime).toBe('09:30')
    expect(result?.endTime).toBe('10:00')
    expect(result?.startTimeMinutes).toBe(9 * 60 + 30) // 570
    expect(result?.endTimeMinutes).toBe(10 * 60) // 600
  })

  it('respects timezone when extracting time fields', () => {
    // 15:00 UTC = 10:00 EST (America/New_York)
    const event: GoogleCalendarEvent = {
      id: '6',
      summary: 'NYC Meeting',
      start: {
        dateTime: '2025-01-15T15:00:00Z',
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: '2025-01-15T16:00:00Z',
        timeZone: 'America/New_York',
      },
      status: 'confirmed',
      htmlLink: 'https://example.com',
    }

    const result = processEvent(event)

    expect(result).not.toBeNull()
    // In America/New_York (EST, -5), 15:00 UTC = 10:00 local
    expect(result?.startTime).toBe('10:00')
    expect(result?.endTime).toBe('11:00')
    expect(result?.startTimeMinutes).toBe(10 * 60) // 600
    expect(result?.endTimeMinutes).toBe(11 * 60) // 660
  })

  it('does not include time fields for all-day events', () => {
    const event = buildAllDayEvent()

    const result = processEvent(event)

    expect(result).not.toBeNull()
    expect(result?.startTime).toBeUndefined()
    expect(result?.endTime).toBeUndefined()
    expect(result?.startTimeMinutes).toBeUndefined()
    expect(result?.endTimeMinutes).toBeUndefined()
  })

  it('filters out cancelled events', () => {
    const event = buildAllDayEvent({ status: 'cancelled' })

    expect(processEvent(event)).toBeNull()
  })

  it('filters out invalid all-day events', () => {
    const event = buildAllDayEvent({ start: { date: 'not-a-date' } })

    expect(processEvent(event)).toBeNull()
  })
})

describe('processEvents', () => {
  it('filters cancelled events but keeps single-day timed events', () => {
    const events = processEvents([
      {
        id: '1',
        status: 'cancelled',
        summary: 'Cancelled',
        htmlLink: '',
        start: { date: '2026-01-01' },
        end: { date: '2026-01-02' },
      },
      {
        id: '2',
        summary: 'Single day',
        status: 'confirmed',
        htmlLink: '',
        start: { dateTime: '2026-01-01T10:00:00Z' },
        end: { dateTime: '2026-01-01T11:00:00Z' },
      },
      {
        id: '3',
        summary: 'Multi day',
        status: 'confirmed',
        htmlLink: '',
        start: { date: '2026-01-01' },
        end: { date: '2026-01-03' },
      },
    ])

    expect(events).toHaveLength(2)
    // Single-day timed event is kept with isSingleDayTimed flag
    expect(events[0]?.id).toBe('2')
    expect(events[0]?.isSingleDayTimed).toBe(true)
    // Multi-day event is also kept
    expect(events[1]?.id).toBe('3')
    expect(events[1]?.isMultiDay).toBe(true)
  })

  it('filters out null results', () => {
    const valid = buildAllDayEvent({ summary: 'Family reunion' })
    const cancelled = buildAllDayEvent({ id: 'event-2', status: 'cancelled' })

    expect(processEvents([valid, cancelled])).toHaveLength(1)
  })
})
