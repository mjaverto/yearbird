import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCalendarList, fetchEventsForYear } from './calendar'

const stubFetch = (mock: ReturnType<typeof vi.fn>) => {
  vi.stubGlobal('fetch', mock as typeof fetch)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('calendar service', () => {
  it('fetches all pages for the year', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: '1', summary: 'First', start: {}, end: {}, status: 'confirmed', htmlLink: '' }],
          nextPageToken: 'next',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: '2', summary: 'Second', start: {}, end: {}, status: 'confirmed', htmlLink: '' }],
        }),
      })

    stubFetch(fetchMock)

    const events = await fetchEventsForYear('token', 2025)

    expect(events).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const firstUrl = new URL(fetchMock.mock.calls[0][0] as string)
    expect(firstUrl.searchParams.get('fields')).toBe(
      'items(id,status,summary,description,location,start,end,htmlLink),nextPageToken'
    )
  })


  it('fetches calendar list pages', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 'primary', summary: 'Primary', accessRole: 'owner' }],
          nextPageToken: 'next',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: 'work', summary: 'Work', accessRole: 'writer' }],
        }),
      })

    stubFetch(fetchMock)

    const calendars = await fetchCalendarList('token')

    expect(calendars).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const firstUrl = new URL(fetchMock.mock.calls[0][0] as string)
    expect(firstUrl.pathname).toContain('/users/me/calendarList')
  })
  it('throws UNAUTHORIZED on 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    stubFetch(fetchMock)

    await expect(fetchEventsForYear('token', 2025)).rejects.toThrow('UNAUTHORIZED')
  })

  it('throws a generic error for non-401 failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 })
    stubFetch(fetchMock)

    await expect(fetchEventsForYear('token', 2025)).rejects.toThrow('Calendar API error: 403')
  })


  it('retries on rate limiting with a date header', async () => {
    const retryAt = new Date(Date.now() + 1000).toUTCString()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': retryAt }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [],
        }),
      })

    stubFetch(fetchMock)

    const events = await fetchEventsForYear('token', 2025)

    expect(events).toHaveLength(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('retries on rate limiting', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '0' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [],
        }),
      })

    stubFetch(fetchMock)

    const events = await fetchEventsForYear('token', 2025)

    expect(events).toHaveLength(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
