import { describe, expect, it } from 'vitest'
import { buildGoogleCalendarCreateUrl } from './googleCalendar'

describe('buildGoogleCalendarCreateUrl', () => {
  it('builds correct URL for a date in January', () => {
    const url = buildGoogleCalendarCreateUrl(2025, 0, 15)

    expect(url).toBe(
      'https://calendar.google.com/calendar/r/eventedit?dates=20250115/20250116&allday=true'
    )
  })

  it('builds correct URL for a date in December', () => {
    const url = buildGoogleCalendarCreateUrl(2025, 11, 25)

    expect(url).toBe(
      'https://calendar.google.com/calendar/r/eventedit?dates=20251225/20251226&allday=true'
    )
  })

  it('pads single-digit months correctly', () => {
    const url = buildGoogleCalendarCreateUrl(2025, 2, 5) // March 5

    expect(url).toContain('20250305')
    expect(url).toContain('20250306')
  })

  it('pads single-digit days correctly', () => {
    const url = buildGoogleCalendarCreateUrl(2025, 9, 3) // October 3

    expect(url).toContain('20251003')
    expect(url).toContain('20251004')
  })

  it('handles end of month correctly', () => {
    const url = buildGoogleCalendarCreateUrl(2025, 0, 31) // January 31

    expect(url).toContain('20250131')
    expect(url).toContain('20250201') // Rolls over to February
  })

  it('handles end of year correctly', () => {
    const url = buildGoogleCalendarCreateUrl(2025, 11, 31) // December 31

    expect(url).toContain('20251231')
    expect(url).toContain('20260101') // Rolls over to next year
  })

  it('handles leap year February 29', () => {
    const url = buildGoogleCalendarCreateUrl(2024, 1, 29) // Feb 29, 2024 (leap year)

    expect(url).toContain('20240229')
    expect(url).toContain('20240301')
  })

  it('includes allday=true parameter', () => {
    const url = buildGoogleCalendarCreateUrl(2025, 5, 15)

    expect(url).toContain('allday=true')
  })

  it('uses the correct base URL', () => {
    const url = buildGoogleCalendarCreateUrl(2025, 0, 1)

    expect(url.startsWith('https://calendar.google.com/calendar/r/eventedit')).toBe(true)
  })
})
