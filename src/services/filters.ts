export interface EventFilter {
  id: string
  pattern: string
  createdAt: number
}

const FILTERS_KEY = 'yearbird:filters'

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const parseFilters = (raw: string): EventFilter[] | null => {
  try {
    const parsed = JSON.parse(raw) as EventFilter[]
    if (!Array.isArray(parsed)) {
      return null
    }
    if (
      parsed.some(
        (filter) =>
          !filter ||
          typeof filter.id !== 'string' ||
          typeof filter.pattern !== 'string' ||
          typeof filter.createdAt !== 'number'
      )
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const createFilterId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getFilters(): EventFilter[] {
  const storage = getStorage()
  if (!storage) {
    return []
  }

  const raw = storage.getItem(FILTERS_KEY)
  if (!raw) {
    return []
  }

  const parsed = parseFilters(raw)
  if (!parsed) {
    storage.removeItem(FILTERS_KEY)
    return []
  }

  const cleaned = parsed
    .map((filter) => ({ ...filter, pattern: filter.pattern.trim() }))
    .filter((filter) => filter.pattern.length > 0)

  if (cleaned.length !== parsed.length) {
    try {
      storage.setItem(FILTERS_KEY, JSON.stringify(cleaned))
    } catch {
      // Best effort cleanup; ignore storage failures.
    }
  }

  return cleaned
}

export function addFilter(pattern: string): EventFilter | null {
  const trimmed = pattern.trim()
  if (!trimmed) {
    return null
  }

  const storage = getStorage()
  const filters = storage ? getFilters() : []
  const normalized = trimmed.toLowerCase()
  const existing = filters.find(
    (filter) => filter.pattern.trim().toLowerCase() === normalized
  )
  if (existing) {
    return existing
  }
  const newFilter: EventFilter = {
    id: createFilterId(),
    pattern: trimmed,
    createdAt: Date.now(),
  }

  filters.push(newFilter)

  if (storage) {
    try {
      storage.setItem(FILTERS_KEY, JSON.stringify(filters))
    } catch {
      // Swallow storage errors (quota, disabled storage) and keep in-memory state.
    }
  }

  return newFilter
}

export function removeFilter(id: string): void {
  const storage = getStorage()
  if (!storage) {
    return
  }

  const filters = getFilters().filter((filter) => filter.id !== id)
  try {
    storage.setItem(FILTERS_KEY, JSON.stringify(filters))
  } catch {
    // Ignore storage failures to avoid breaking UI state.
  }
}

export function clearFilters(): void {
  const storage = getStorage()
  if (!storage) {
    return
  }

  storage.removeItem(FILTERS_KEY)
}

export function isEventFiltered(eventTitle: string, filters: EventFilter[]): boolean {
  const lowerTitle = eventTitle.toLowerCase()
  return filters.some((filter) => {
    const pattern = filter.pattern.trim()
    if (!pattern) {
      return false
    }
    return lowerTitle.includes(pattern.toLowerCase())
  })
}
