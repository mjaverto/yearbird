import type { GoogleCalendarEvent, GoogleCalendarListEntry } from '../types/calendar'

const FIXTURE_EVENT_SEPARATOR = '::'

const loadFixtureEvents = async () => {
  const { fixtureCalendarEvents } = await import('../fixtures/calendarEvents')
  return fixtureCalendarEvents.items ?? []
}

const loadFixtureCalendars = async () => {
  const { fixtureCalendarList } = await import('../fixtures/calendarList')
  return fixtureCalendarList.items ?? []
}

const parseEventDateAsUTC = (value?: string): Date | null => {
  if (!value) {
    return null
  }

  const dateString = value.length === 10 ? `${value}T00:00:00Z` : value
  const parsed = new Date(dateString)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()))
}

const isEventInYear = (event: GoogleCalendarEvent, year: number) => {
  const startValue = event.start?.dateTime ?? event.start?.date
  const endValue = event.end?.dateTime ?? event.end?.date
  const start = parseEventDateAsUTC(startValue)
  const end = parseEventDateAsUTC(endValue)
  if (!start || !end) {
    return false
  }

  const yearStart = new Date(Date.UTC(year, 0, 1))
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1))
  return start < yearEnd && end > yearStart
}

const extractFixtureCalendarId = (eventId: string) => {
  const separatorIndex = eventId.indexOf(FIXTURE_EVENT_SEPARATOR)
  if (separatorIndex <= 0) {
    return null
  }

  return eventId.slice(0, separatorIndex)
}

const stripFixtureEventId = (eventId: string) => {
  const separatorIndex = eventId.indexOf(FIXTURE_EVENT_SEPARATOR)
  if (separatorIndex <= 0) {
    return eventId
  }

  return eventId.slice(separatorIndex + FIXTURE_EVENT_SEPARATOR.length)
}

export async function getFixtureEventsForYear(
  year: number,
  calendarId?: string
): Promise<GoogleCalendarEvent[]> {
  const events = await loadFixtureEvents()
  return events
    .filter((event) => isEventInYear(event, year))
    .filter((event) => {
      if (!calendarId) {
        return true
      }
      return extractFixtureCalendarId(event.id) === calendarId
    })
    .map((event) => ({
      ...event,
      id: stripFixtureEventId(event.id),
    }))
}

export async function getFixtureCalendars(): Promise<GoogleCalendarListEntry[]> {
  return await loadFixtureCalendars()
}
