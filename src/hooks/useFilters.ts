import { useCallback, useState } from 'react'
import {
  addFilter,
  getFilters,
  isEventFiltered,
  removeFilter,
  type EventFilter,
} from '../services/filters'
import { scheduleSyncToCloud } from '../services/syncManager'
import type { YearbirdEvent } from '../types/calendar'

interface UseFiltersResult {
  filters: EventFilter[]
  addFilter: (pattern: string) => void
  removeFilter: (id: string) => void
  filterEvents: (events: YearbirdEvent[]) => YearbirdEvent[]
}

export function useFilters(): UseFiltersResult {
  const [filters, setFilters] = useState<EventFilter[]>(() => getFilters())

  const add = useCallback((pattern: string) => {
    const trimmed = pattern.trim()
    if (!trimmed) {
      return
    }
    addFilter(trimmed)
    setFilters(getFilters())
    scheduleSyncToCloud()
  }, [])

  const remove = useCallback((id: string) => {
    removeFilter(id)
    setFilters((prev) => prev.filter((filter) => filter.id !== id))
    scheduleSyncToCloud()
  }, [])

  const filterEvents = useCallback(
    (events: YearbirdEvent[]): YearbirdEvent[] => {
      if (filters.length === 0) {
        return events
      }
      return events.filter((event) => !isEventFiltered(event.title, filters))
    },
    [filters]
  )

  return { filters, addFilter: add, removeFilter: remove, filterEvents }
}
