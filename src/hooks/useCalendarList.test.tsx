import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCalendarList } from '../services/calendar'
import { useCalendarList } from './useCalendarList'

vi.mock('../services/calendar', () => ({
  fetchCalendarList: vi.fn(),
}))

const fetchCalendarListMock = vi.mocked(fetchCalendarList)

describe('useCalendarList', () => {
  beforeEach(() => {
    fetchCalendarListMock.mockReset()
  })

  it('skips fetch without an access token', () => {
    const { result } = renderHook(() => useCalendarList(null))

    expect(fetchCalendarListMock).not.toHaveBeenCalled()
    expect(result.current.calendars).toEqual([])
  })

  it('no-ops when refetching without a token', async () => {
    const { result } = renderHook(() => useCalendarList(null))

    await act(async () => {
      await result.current.refetch()
    })

    expect(fetchCalendarListMock).not.toHaveBeenCalled()
  })

  it('filters freeBusy calendars and sorts primary first', async () => {
    fetchCalendarListMock.mockResolvedValueOnce([
      { id: 'work', summary: 'Work', accessRole: 'writer' },
      { id: 'busy', summary: 'Busy', accessRole: 'freeBusyReader' },
      { id: 'primary', summary: 'Personal', primary: true, accessRole: 'owner' },
    ])

    const { result } = renderHook(() => useCalendarList('token'))

    await waitFor(() => expect(result.current.calendars).toHaveLength(2))
    expect(result.current.calendars[0]?.id).toBe('primary')
    expect(result.current.calendars.map((calendar) => calendar.id)).toEqual([
      'primary',
      'work',
    ])
  })

  it('sorts primary ahead when it arrives after secondary calendars', async () => {
    fetchCalendarListMock.mockResolvedValueOnce([
      { id: 'team', summary: 'Team', accessRole: 'writer' },
      { id: 'primary', summary: 'Personal', primary: true, accessRole: 'owner' },
    ])

    const { result } = renderHook(() => useCalendarList('token'))

    await waitFor(() => expect(result.current.calendars).toHaveLength(2))
    expect(result.current.calendars.map((calendar) => calendar.id)).toEqual([
      'primary',
      'team',
    ])
  })

  it('sorts by summary when no primary calendar is present', async () => {
    fetchCalendarListMock.mockResolvedValueOnce([
      { id: 'b', summary: 'Beta', accessRole: 'writer' },
      { id: 'a', summary: 'Alpha', accessRole: 'writer' },
    ])

    const { result } = renderHook(() => useCalendarList('token'))

    await waitFor(() => expect(result.current.calendars).toHaveLength(2))
    expect(result.current.calendars.map((calendar) => calendar.id)).toEqual(['a', 'b'])
  })

  it('ignores abort errors', async () => {
    const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' })
    fetchCalendarListMock.mockRejectedValueOnce(abortError)

    const { result } = renderHook(() => useCalendarList('token'))

    await waitFor(() => expect(fetchCalendarListMock).toHaveBeenCalled())
    expect(result.current.error).toBeNull()
  })

  it('skips state updates after abort', async () => {
    let resolve: (value: unknown) => void = () => {}
    const pending = new Promise((res) => {
      resolve = res
    })
    fetchCalendarListMock.mockReturnValueOnce(pending as Promise<unknown>)

    const { unmount } = renderHook(() => useCalendarList('token'))

    unmount()
    resolve([{ id: 'primary', summary: 'Personal', accessRole: 'owner' }])

    await act(async () => {
      await pending
    })

    expect(fetchCalendarListMock).toHaveBeenCalledTimes(1)
  })

  it('exposes errors and supports refetch', async () => {
    fetchCalendarListMock.mockRejectedValueOnce(new Error('NOPE'))

    const { result } = renderHook(() => useCalendarList('token'))

    await waitFor(() => expect(result.current.error).toBe('NOPE'))

    fetchCalendarListMock.mockResolvedValueOnce([
      { id: 'primary', summary: 'Personal', primary: true, accessRole: 'owner' },
    ])

    await act(async () => {
      await result.current.refetch()
    })

    await waitFor(() => expect(result.current.calendars).toHaveLength(1))
  })
})
