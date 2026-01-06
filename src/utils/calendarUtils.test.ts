import { describe, expect, it } from 'vitest'
import { resolveCalendarId, type CalendarMeta } from './calendarUtils'
import type { YearbirdEvent } from '../types/calendar'

const buildEvent = (overrides: Partial<YearbirdEvent> = {}): YearbirdEvent => ({
  id: 'cal123:event456',
  title: 'Test Event',
  startDate: '2025-01-15',
  endDate: '2025-01-15',
  isAllDay: true,
  isMultiDay: false,
  durationDays: 1,
  googleLink: '',
  category: 'other',
  color: '#888888',
  ...overrides,
})

describe('resolveCalendarId', () => {
  it('returns calendarId when explicitly set on the event', () => {
    const event = buildEvent({ calendarId: 'explicit-calendar-id' })
    const calendarMetaById = new Map<string, CalendarMeta>()

    expect(resolveCalendarId(event, calendarMetaById)).toBe('explicit-calendar-id')
  })

  it('extracts calendarId from event id prefix when calendarId is not set', () => {
    const event = buildEvent({ id: 'cal123:event456', calendarId: undefined })
    const calendarMetaById = new Map<string, CalendarMeta>([
      ['cal123', { name: 'Work Calendar', color: '#FF0000' }],
    ])

    expect(resolveCalendarId(event, calendarMetaById)).toBe('cal123')
  })

  it('returns undefined when event id has no separator', () => {
    const event = buildEvent({ id: 'noseparator', calendarId: undefined })
    const calendarMetaById = new Map<string, CalendarMeta>([
      ['noseparator', { name: 'Some Calendar' }],
    ])

    expect(resolveCalendarId(event, calendarMetaById)).toBeUndefined()
  })

  it('returns undefined when separator is at the start (index 0)', () => {
    const event = buildEvent({ id: ':leadingcolon', calendarId: undefined })
    const calendarMetaById = new Map<string, CalendarMeta>()

    expect(resolveCalendarId(event, calendarMetaById)).toBeUndefined()
  })

  it('returns undefined when extracted prefix is not in calendarMetaById', () => {
    const event = buildEvent({ id: 'unknown:event123', calendarId: undefined })
    const calendarMetaById = new Map<string, CalendarMeta>([
      ['known', { name: 'Known Calendar' }],
    ])

    expect(resolveCalendarId(event, calendarMetaById)).toBeUndefined()
  })

  it('uses first separator when multiple colons exist', () => {
    const event = buildEvent({ id: 'cal:sub:event', calendarId: undefined })
    const calendarMetaById = new Map<string, CalendarMeta>([
      ['cal', { name: 'Calendar' }],
      ['cal:sub', { name: 'Nested Calendar' }],
    ])

    expect(resolveCalendarId(event, calendarMetaById)).toBe('cal')
  })

  it('handles empty calendarMetaById map', () => {
    const event = buildEvent({ id: 'cal:event', calendarId: undefined })
    const calendarMetaById = new Map<string, CalendarMeta>()

    expect(resolveCalendarId(event, calendarMetaById)).toBeUndefined()
  })

  it('prefers explicit calendarId over extracted prefix', () => {
    const event = buildEvent({
      id: 'extracted:event',
      calendarId: 'explicit',
    })
    const calendarMetaById = new Map<string, CalendarMeta>([
      ['extracted', { name: 'Extracted' }],
      ['explicit', { name: 'Explicit' }],
    ])

    expect(resolveCalendarId(event, calendarMetaById)).toBe('explicit')
  })
})
