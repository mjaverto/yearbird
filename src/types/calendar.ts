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

export interface YearbirdEvent {
  id: string
  title: string
  description?: string
  location?: string
  startDate: string
  endDate: string
  isAllDay: boolean
  isMultiDay: boolean
  durationDays: number
  googleLink: string
  category: EventCategory
  color: string
  calendarId?: string
  calendarName?: string
  calendarColor?: string
}
