import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCachedEvents, getCacheTimestamp, setCachedEvents } from '../services/cache'
import { fetchEventsForYear } from '../services/calendar'
import type { YearbirdEvent } from '../types/calendar'
import { processEvents } from '../utils/eventProcessor'

type CacheSnapshot = {
  events: YearbirdEvent[]
  lastUpdated: Date | null
  isFromCache: boolean
}

interface UseCalendarEventsResult {
  events: YearbirdEvent[]
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  isFromCache: boolean
  refetch: () => Promise<void>
}

const buildCalendarCacheKey = (calendarIds: string[]) =>
  calendarIds.map((id) => encodeURIComponent(id)).sort().join('|')

const readCache = (year: number, cacheKey?: string): CacheSnapshot => {
  const cached = getCachedEvents(year, cacheKey)
  return {
    events: cached ?? [],
    lastUpdated: cached ? getCacheTimestamp(year, cacheKey) : null,
    isFromCache: Boolean(cached),
  }
}

const emptyCache: CacheSnapshot = {
  events: [],
  lastUpdated: null,
  isFromCache: false,
}

export function useCalendarEvents(
  accessToken: string | null,
  year: number,
  calendarIds: string[]
): UseCalendarEventsResult {
  const normalizedCalendarIds = useMemo(
    () => Array.from(new Set(calendarIds)).filter(Boolean),
    [calendarIds]
  )
  const calendarKey = useMemo(() => {
    if (normalizedCalendarIds.length === 0) {
      return undefined
    }
    return buildCalendarCacheKey(normalizedCalendarIds)
  }, [normalizedCalendarIds])

  const [cacheState, setCacheState] = useState<CacheSnapshot>(() =>
    readCache(year, calendarKey)
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || normalizedCalendarIds.length === 0) {
      setCacheState(emptyCache)
      setIsLoading(false)
      setError(null)
      return
    }

    setCacheState(readCache(year, calendarKey))
  }, [accessToken, year, calendarKey, normalizedCalendarIds.length])

  const fetchEvents = useCallback(
    async (signal?: AbortSignal) => {
      if (!accessToken || normalizedCalendarIds.length === 0) {
        setCacheState(emptyCache)
        setIsLoading(false)
        setError(null)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const responses = await Promise.all(
          normalizedCalendarIds.map(async (calendarId) => ({
            calendarId,
            events: await fetchEventsForYear(accessToken, year, { signal, calendarId }),
          }))
        )
        if (signal?.aborted) {
          return
        }

        const processed = responses.flatMap(({ calendarId, events }) =>
          processEvents(events, calendarId)
        )
        setCacheState({
          events: processed,
          lastUpdated: new Date(),
          isFromCache: false,
        })
        setCachedEvents(year, processed, calendarKey)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        const message = err instanceof Error ? err.message : 'Failed to fetch events'
        setError(message)
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false)
        }
      }
    },
    [accessToken, year, normalizedCalendarIds, calendarKey]
  )

  useEffect(() => {
    if (!accessToken || normalizedCalendarIds.length === 0) {
      return
    }

    const cached = getCachedEvents(year, calendarKey)
    if (cached) {
      return
    }

    const controller = new AbortController()
    void fetchEvents(controller.signal)
    return () => {
      controller.abort()
    }
  }, [accessToken, year, fetchEvents, calendarKey, normalizedCalendarIds.length])

  const refetch = useCallback(() => fetchEvents(), [fetchEvents])

  return {
    events: cacheState.events,
    isLoading,
    error,
    lastUpdated: cacheState.lastUpdated,
    isFromCache: cacheState.isFromCache,
    refetch,
  }
}
