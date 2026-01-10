import type {
  CalendarEventsResponse,
  CalendarListResponse,
  GoogleCalendarEvent,
  GoogleCalendarListEntry,
} from '../types/calendar'
import { isFixtureMode } from '../utils/env'
import { log } from '../utils/logger'
import { getFixtureCalendars, getFixtureEventsForYear } from './calendarFixtures'

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3'
const MAX_RETRIES = 3
const DEFAULT_CALENDAR_ID = 'primary'
const DEFAULT_TIMEZONE = 'UTC'
const EVENT_FIELDS = 'items(id,status,summary,description,location,start,end,htmlLink),nextPageToken'
const CALENDAR_LIST_FIELDS =
  'items(id,summary,primary,accessRole,backgroundColor,foregroundColor),nextPageToken'

type FetchEventsOptions = {
  signal?: AbortSignal
  calendarId?: string
  timeZone?: string
  maxRetries?: number
}

type FetchCalendarsOptions = {
  signal?: AbortSignal
  maxRetries?: number
}

const getLocalTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? DEFAULT_TIMEZONE
  } catch (error) {
    log.debug('Timezone detection error:', error)
    return DEFAULT_TIMEZONE
  }
}

const getRetryAfterMs = (headers: Headers) => {
  const retryAfter = headers.get('Retry-After')
  if (!retryAfter) {
    return null
  }

  const seconds = Number.parseInt(retryAfter, 10)
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000)
  }

  const retryAt = Date.parse(retryAfter)
  if (!Number.isNaN(retryAt)) {
    return Math.max(0, retryAt - Date.now())
  }

  return null
}

const backoffDelayMs = (attempt: number) => Math.min(2000, 500 * (attempt + 1))

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchWithRetry = async (
  url: string,
  accessToken: string,
  options?: FetchEventsOptions | FetchCalendarsOptions
) => {
  const maxRetries = options?.maxRetries ?? MAX_RETRIES
  const maxAttempts = maxRetries + 1

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: options?.signal,
    })

    if (response.ok) {
      return response
    }

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED')
    }

    const shouldRetry = response.status === 429 || response.status >= 500
    if (!shouldRetry || attempt === maxAttempts - 1) {
      throw new Error(`Calendar API error: ${response.status}`)
    }

    const retryAfterMs = getRetryAfterMs(response.headers)
    const delayMs = retryAfterMs ?? backoffDelayMs(attempt)
    if (delayMs > 0) {
      await sleep(delayMs)
    }
  }
  throw new Error('Calendar API error: retry limit exceeded')
}

export async function fetchEventsForYear(
  accessToken: string,
  year: number,
  options?: FetchEventsOptions
) {
  if (isFixtureMode()) {
    return await getFixtureEventsForYear(year, options?.calendarId)
  }

  const timeMin = `${year}-01-01T00:00:00Z`
  const timeMax = `${year + 1}-01-01T00:00:00Z`

  const allEvents: GoogleCalendarEvent[] = []
  let pageToken: string | undefined
  const calendarId = options?.calendarId ?? DEFAULT_CALENDAR_ID
  const timeZone = options?.timeZone ?? getLocalTimeZone()

  do {
    const url = new URL(`${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`)
    url.searchParams.set('timeMin', timeMin)
    url.searchParams.set('timeMax', timeMax)
    url.searchParams.set('maxResults', '250')
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    url.searchParams.set('timeZone', timeZone)
    url.searchParams.set('fields', EVENT_FIELDS)

    if (pageToken) {
      url.searchParams.set('pageToken', pageToken)
    }

    const response = await fetchWithRetry(url.toString(), accessToken, options)

    const data: CalendarEventsResponse = await response.json()
    const items = data.items ?? []
    allEvents.push(...items)
    pageToken = data.nextPageToken
  } while (pageToken)

  return allEvents
}

export async function fetchCalendarList(
  accessToken: string,
  options?: FetchCalendarsOptions
): Promise<GoogleCalendarListEntry[]> {
  if (isFixtureMode()) {
    return await getFixtureCalendars()
  }

  const allCalendars: GoogleCalendarListEntry[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(`${CALENDAR_API_BASE}/users/me/calendarList`)
    url.searchParams.set('fields', CALENDAR_LIST_FIELDS)
    url.searchParams.set('maxResults', '250')

    if (pageToken) {
      url.searchParams.set('pageToken', pageToken)
    }

    const response = await fetchWithRetry(url.toString(), accessToken, options)
    const data: CalendarListResponse = await response.json()
    const items = data.items ?? []
    allCalendars.push(...items)
    pageToken = data.nextPageToken
  } while (pageToken)

  return allCalendars
}
