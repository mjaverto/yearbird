import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCalendarList } from '../services/calendar'
import type { GoogleCalendarListEntry } from '../types/calendar'

interface UseCalendarListResult {
  calendars: GoogleCalendarListEntry[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const sortCalendars = (calendars: GoogleCalendarListEntry[]) => {
  return [...calendars].sort((a, b) => {
    if (a.primary && !b.primary) {
      return -1
    }
    if (!a.primary && b.primary) {
      return 1
    }
    return (a.summary ?? '').localeCompare(b.summary ?? '')
  })
}

const filterReadableCalendars = (calendars: GoogleCalendarListEntry[]) =>
  calendars.filter((calendar) => calendar.accessRole !== 'freeBusyReader')

export function useCalendarList(accessToken: string | null): UseCalendarListResult {
  const [calendars, setCalendars] = useState<GoogleCalendarListEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCalendars = useCallback(
    async (signal?: AbortSignal) => {
      if (!accessToken) {
        setCalendars([])
        setIsLoading(false)
        setError(null)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const items = await fetchCalendarList(accessToken, { signal })
        if (signal?.aborted) {
          return
        }
        const readable = filterReadableCalendars(items)
        setCalendars(sortCalendars(readable))
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        const message = err instanceof Error ? err.message : 'Failed to fetch calendars'
        setError(message)
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false)
        }
      }
    },
    [accessToken]
  )

  useEffect(() => {
    if (!accessToken) {
      setCalendars([])
      setIsLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    void fetchCalendars(controller.signal)
    return () => {
      controller.abort()
    }
  }, [accessToken, fetchCalendars])

  const memoizedCalendars = useMemo(() => calendars, [calendars])

  return {
    calendars: memoizedCalendars,
    isLoading,
    error,
    refetch: () => fetchCalendars(),
  }
}
