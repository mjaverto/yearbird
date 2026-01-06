import { describe, expect, it, vi } from 'vitest'
import { getFixtureCalendars, getFixtureEventsForYear } from './calendarFixtures'

describe('calendar fixtures', () => {
  it('filters fixtures to the requested year', async () => {
    const events2026 = await getFixtureEventsForYear(2026)
    const events2027 = await getFixtureEventsForYear(2027)

    expect(events2026.length).toBeGreaterThan(0)
    expect(events2026.some((event) => event.id === 'evt-standup-2')).toBe(true)
    expect(events2027).toHaveLength(0)
  })

  it('filters fixtures by calendar id when provided', async () => {
    const travelEvents = await getFixtureEventsForYear(2026, 'travel@company.com')

    expect(travelEvents.length).toBeGreaterThan(0)
    expect(travelEvents.every((event) => !event.id?.includes('::'))).toBe(true)
    expect(travelEvents.some((event) => event.id === 'evt-match-9')).toBe(true)
  })

  it('handles unprefixed fixture ids when no calendar is selected', async () => {
    vi.resetModules()
    vi.doMock('../fixtures/calendarEvents', () => ({
      fixtureCalendarEvents: {
        items: [
          {
            id: 'evt-unprefixed',
            status: 'confirmed',
            htmlLink: 'https://calendar.example.com/event?eid=evt-unprefixed',
            summary: 'Unprefixed sample',
            start: { date: '2026-05-01' },
            end: { date: '2026-05-02' },
          },
        ],
      },
    }))

    const { getFixtureEventsForYear: getMockedEvents } = await import('./calendarFixtures')
    const events = await getMockedEvents(2026)
    const filtered = await getMockedEvents(2026, 'primary')

    expect(events).toHaveLength(1)
    expect(events[0]?.id).toBe('evt-unprefixed')
    expect(filtered).toHaveLength(0)
  })

  it('returns fixture calendars', async () => {
    const calendars = await getFixtureCalendars()

    expect(calendars.length).toBeGreaterThan(0)
    expect(calendars.some((calendar) => calendar.primary)).toBe(true)
  })
})
