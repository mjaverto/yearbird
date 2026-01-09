export interface GoogleCalendarEvent {
  id: string
  summary?: string
  description?: string
  location?: string
  start: {
    date?: string
    dateTime?: string
    timeZone?: string
  }
  end: {
    date?: string
    dateTime?: string
    timeZone?: string
  }
  status: 'confirmed' | 'tentative' | 'cancelled'
  htmlLink: string
}

export interface CalendarEventsResponse {
  items?: GoogleCalendarEvent[]
  nextPageToken?: string
}

export interface GoogleCalendarListEntry {
  id: string
  summary?: string
  primary?: boolean
  accessRole?: 'freeBusyReader' | 'reader' | 'writer' | 'owner'
  backgroundColor?: string
  foregroundColor?: string
}

export interface CalendarListResponse {
  items?: GoogleCalendarListEntry[]
  nextPageToken?: string
}

export type BuiltInCategory =
  | 'work'
  | 'races'
  | 'birthdays'
  | 'holidays'
  | 'adventures'
  | 'family'
  | 'uncategorized'

export type CustomCategoryId = `custom-${string}`

export type EventCategory = BuiltInCategory | CustomCategoryId

/**
 * Processed calendar event for display in Yearbird.
 */
export interface YearbirdEvent {
  id: string
  title: string
  description?: string
  location?: string
  /** Start date in YYYY-MM-DD format */
  startDate: string
  /** End date in YYYY-MM-DD format */
  endDate: string
  /** Whether this is an all-day event (no specific start/end time) */
  isAllDay: boolean
  /** Whether the event spans multiple days */
  isMultiDay: boolean
  /**
   * Whether this is a single-day timed event (e.g., meeting, appointment).
   * Used to filter timed events when `showTimedEvents` setting is false.
   */
  isSingleDayTimed: boolean
  /** Number of days the event spans */
  durationDays: number
  /** Link to the event in Google Calendar */
  googleLink: string
  /** The assigned category for this event */
  category: EventCategory
  /** The color associated with the category */
  color: string
  /** ID of the calendar this event belongs to */
  calendarId?: string
  /** Name of the calendar this event belongs to */
  calendarName?: string
  /** Color of the calendar this event belongs to */
  calendarColor?: string
}
