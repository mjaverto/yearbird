const GOOGLE_CALENDAR_EVENT_CREATE_URL = 'https://calendar.google.com/calendar/r/eventedit'

const padDatePart = (value: number) => value.toString().padStart(2, '0')

const formatDate = (date: Date) => {
  return `${date.getFullYear()}${padDatePart(date.getMonth() + 1)}${padDatePart(date.getDate())}`
}

export const buildGoogleCalendarCreateUrl = (year: number, monthIndex: number, day: number) => {
  const start = new Date(year, monthIndex, day)
  const end = new Date(start)
  end.setDate(start.getDate() + 1)

  const dates = `${formatDate(start)}/${formatDate(end)}`
  return `${GOOGLE_CALENDAR_EVENT_CREATE_URL}?dates=${dates}&allday=true`
}
