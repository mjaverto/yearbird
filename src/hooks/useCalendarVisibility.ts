import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GoogleCalendarListEntry } from '../types/calendar'
import { getDisabledCalendars, setDisabledCalendars } from '../services/calendarVisibility'

interface UseCalendarVisibilityResult {
  disabledCalendarIds: string[]
  visibleCalendarIds: string[]
  disableCalendar: (id: string) => void
  enableCalendar: (id: string) => void
}

export function useCalendarVisibility(
  calendars: GoogleCalendarListEntry[]
): UseCalendarVisibilityResult {
  const [disabledCalendarIds, setDisabledCalendarIds] = useState<string[]>(() =>
    getDisabledCalendars()
  )
  const calendarIds = useMemo(() => calendars.map((calendar) => calendar.id), [calendars])
  const calendarIdSet = useMemo(() => new Set(calendarIds), [calendarIds])

  const cleanedDisabledIds = useMemo(() => {
    if (calendarIdSet.size === 0) {
      return disabledCalendarIds
    }
    return disabledCalendarIds.filter((id) => calendarIdSet.has(id))
  }, [disabledCalendarIds, calendarIdSet])

  useEffect(() => {
    if (calendarIdSet.size === 0) {
      return
    }
    if (cleanedDisabledIds.length !== disabledCalendarIds.length) {
      setDisabledCalendars(cleanedDisabledIds)
    }
  }, [calendarIdSet.size, cleanedDisabledIds, disabledCalendarIds.length])

  const handleDisable = useCallback(
    (id: string) => {
      setDisabledCalendarIds((prev) => {
        const cleaned = calendarIdSet.size ? prev.filter((entry) => calendarIdSet.has(entry)) : prev
        if (cleaned.includes(id)) {
          return cleaned
        }
        const next = [...cleaned, id]
        setDisabledCalendars(next)
        return next
      })
    },
    [calendarIdSet]
  )

  const handleEnable = useCallback(
    (id: string) => {
      setDisabledCalendarIds((prev) => {
        const cleaned = calendarIdSet.size ? prev.filter((entry) => calendarIdSet.has(entry)) : prev
        if (!cleaned.includes(id)) {
          return cleaned
        }
        const next = cleaned.filter((entry) => entry !== id)
        setDisabledCalendars(next)
        return next
      })
    },
    [calendarIdSet]
  )

  const visibleCalendarIds = useMemo(
    () => calendarIds.filter((id) => !cleanedDisabledIds.includes(id)),
    [calendarIds, cleanedDisabledIds]
  )

  return {
    disabledCalendarIds: cleanedDisabledIds,
    visibleCalendarIds,
    disableCalendar: handleDisable,
    enableCalendar: handleEnable,
  }
}
