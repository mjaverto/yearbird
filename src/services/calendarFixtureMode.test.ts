import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('calendar fixture mode', () => {
  it('returns fixture events when fixture mode is enabled', async () => {
    vi.resetModules()
    vi.doMock('../utils/env', () => ({
      isFixtureMode: () => true,
    }))

    const { fetchEventsForYear } = await import('./calendar')

    const events = await fetchEventsForYear('token', 2026)

    expect(events.some((event) => event.id === 'evt-review-1')).toBe(true)
  })

  it('returns fixture calendars when fixture mode is enabled', async () => {
    vi.resetModules()
    vi.doMock('../utils/env', () => ({
      isFixtureMode: () => true,
    }))

    const { fetchCalendarList } = await import('./calendar')

    const calendars = await fetchCalendarList('token')

    expect(calendars.some((calendar) => calendar.primary)).toBe(true)
  })
})
