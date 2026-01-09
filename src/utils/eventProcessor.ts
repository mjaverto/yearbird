import { categorizeEvent } from './categorize'
import type { GoogleCalendarEvent, YearbirdEvent } from '../types/calendar'

const MS_PER_DAY = 24 * 60 * 60 * 1000

const parseAsLocalDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map((part) => Number.parseInt(part, 10))
  if (!year || !month || !day) {
    return new Date('invalid')
  }

  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return new Date('invalid')
  }

  return date
}

const formatDateOnly = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getDateOnlyFromDateTime = (dateTime: string, timeZone?: string) => {
  if (!timeZone) {
    return dateTime.split('T')[0]
  }

  const parsed = new Date(dateTime)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(parsed)
}

const diffDateOnly = (startDate: string, endDate: string): number | null => {
  const start = parseAsLocalDate(startDate)
  const end = parseAsLocalDate(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null
  }
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY)
}

const shiftDate = (dateStr: string, days: number): string | null => {
  const date = parseAsLocalDate(dateStr)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  date.setDate(date.getDate() + days)
  return formatDateOnly(date)
}

const calculateDurationDays = (
  startDate: string,
  endDate: string,
  isAllDay: boolean
): number | null => {
  const daySpan = diffDateOnly(startDate, endDate)
  if (daySpan === null || daySpan < 0) {
    return null
  }
  if (isAllDay) {
    return Math.max(1, daySpan)
  }
  return Math.max(1, daySpan + 1)
}

export function processEvent(
  event: GoogleCalendarEvent,
  calendarId?: string
): YearbirdEvent | null {
  if (event.status === 'cancelled') {
    return null
  }

  const isAllDay = Boolean(event.start?.date) && !event.start?.dateTime
  if (isAllDay) {
    if (!event.start?.date || !event.end?.date) {
      return null
    }
  } else if (!event.start?.dateTime || !event.end?.dateTime) {
    return null
  }

  let startDate: string
  let endDate: string
  let durationDays: number

  if (isAllDay) {
    startDate = event.start.date!
    const displayEndDate = shiftDate(event.end.date!, -1)
    if (!displayEndDate) {
      return null
    }
    const allDayDuration = calculateDurationDays(startDate, event.end.date!, true)
    if (allDayDuration === null) {
      return null
    }
    endDate = displayEndDate
    durationDays = allDayDuration
  } else {
    const timeZone = event.start.timeZone ?? event.end.timeZone
    const startDateValue = getDateOnlyFromDateTime(event.start.dateTime!, timeZone)
    const endDateValue = getDateOnlyFromDateTime(event.end.dateTime!, timeZone)

    if (!startDateValue || !endDateValue) {
      return null
    }

    startDate = startDateValue
    endDate = endDateValue
    const timedDuration = calculateDurationDays(startDate, endDate, false)
    if (timedDuration === null) {
      return null
    }
    durationDays = timedDuration
  }

  const isMultiDay = durationDays > 1
  const isSingleDayTimed = !isAllDay && !isMultiDay

  const title = event.summary?.trim() || 'Untitled event'
  const description = event.description?.trim()
  const location = event.location?.trim()
  const { category, color } = categorizeEvent(title)

  const resolvedId = calendarId ? `${calendarId}:${event.id}` : event.id

  return {
    id: resolvedId,
    title,
    ...(description ? { description } : {}),
    ...(location ? { location } : {}),
    startDate,
    endDate,
    isAllDay,
    isMultiDay,
    isSingleDayTimed,
    durationDays,
    googleLink: event.htmlLink || '',
    category,
    color,
    ...(calendarId ? { calendarId } : {}),
  }
}

export function processEvents(
  events: GoogleCalendarEvent[],
  calendarId?: string
): YearbirdEvent[] {
  return events
    .map((event) => processEvent(event, calendarId))
    .filter((event): event is YearbirdEvent => Boolean(event))
}
