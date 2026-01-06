import type { YearbirdEvent } from '../types/calendar'

export type CalendarMeta = { name?: string; color?: string }

export const resolveCalendarId = (
  event: YearbirdEvent,
  calendarMetaById: Map<string, CalendarMeta>
) => {
  if (event.calendarId) {
    return event.calendarId
  }
  const separatorIndex = event.id.indexOf(':')
  if (separatorIndex <= 0) {
    return undefined
  }
  const candidate = event.id.slice(0, separatorIndex)
  if (!calendarMetaById.has(candidate)) {
    return undefined
  }
  return candidate
}
