export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function getDaysInMonth(year: number, month: number): number {
  if (month === 1 && isLeapYear(year)) {
    return 29
  }
  return DAYS_IN_MONTH[month]
}

export function isWeekend(year: number, month: number, day: number): boolean {
  const date = new Date(year, month, day)
  const dayOfWeek = date.getDay()
  return dayOfWeek === 0 || dayOfWeek === 6
}

export function isToday(
  year: number,
  month: number,
  day: number,
  today: Date = new Date()
): boolean {
  return (
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day
  )
}

export function isPastDate(
  year: number,
  month: number,
  day: number,
  today: Date = new Date()
): boolean {
  const todayYear = today.getFullYear()
  if (year !== todayYear) {
    return year < todayYear
  }

  const todayMonth = today.getMonth()
  if (month !== todayMonth) {
    return month < todayMonth
  }

  return day < today.getDate()
}

export function parseDateValue(value: string): Date | null {
  if (!value) {
    return null
  }

  if (value.length === 10) {
    const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10))
    if (!year || !month || !day) {
      return null
    }

    const date = new Date(year, month - 1, day)
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null
    }

    return date
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return date.toLocaleDateString()
}
