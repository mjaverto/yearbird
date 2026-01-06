import type { YearbirdEvent } from '../types/calendar'

const CACHE_PREFIX = 'yearbird:events:'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_CLEANUP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface CachedData {
  events: YearbirdEvent[]
  timestamp: number
}

const getStorage = () => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const parseCachedData = (raw: string): CachedData | null => {
  try {
    const parsed = JSON.parse(raw) as CachedData
    if (!parsed || !Array.isArray(parsed.events) || typeof parsed.timestamp !== 'number') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}
const buildCacheKey = (year: number, suffix?: string) =>
  suffix ? `${CACHE_PREFIX}${year}:${suffix}` : `${CACHE_PREFIX}${year}`


export function getCachedEvents(year: number, suffix?: string): YearbirdEvent[] | null {
  const storage = getStorage()
  if (!storage) {
    return null
  }

  const key = buildCacheKey(year, suffix)
  const raw = storage.getItem(key)
  if (!raw) {
    return null
  }

  const cached = parseCachedData(raw)
  if (!cached) {
    storage.removeItem(key)
    return null
  }

  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    storage.removeItem(key)
    return null
  }

  return cached.events
}

export function setCachedEvents(year: number, events: YearbirdEvent[], suffix?: string): void {
  const storage = getStorage()
  if (!storage) {
    return
  }

  const key = buildCacheKey(year, suffix)
  const payload: CachedData = {
    events,
    timestamp: Date.now(),
  }

  try {
    storage.setItem(key, JSON.stringify(payload))
  } catch {
    clearOldCaches(storage)
    try {
      storage.setItem(key, JSON.stringify(payload))
    } catch {
      console.warn('Failed to cache events')
    }
  }
}

export function clearCachedEvents(year: number, suffix?: string): void {
  const storage = getStorage()
  if (!storage) {
    return
  }
  storage.removeItem(buildCacheKey(year, suffix))
}

export function clearAllCaches(): void {
  const storage = getStorage()
  if (!storage) {
    return
  }

  for (const key of Object.keys(storage)) {
    if (key.startsWith('yearbird:')) {
      storage.removeItem(key)
    }
  }
}

export function clearEventCaches(): void {
  const storage = getStorage()
  if (!storage) {
    return
  }

  for (const key of Object.keys(storage)) {
    if (key.startsWith(CACHE_PREFIX)) {
      storage.removeItem(key)
    }
  }
}

export function getCacheTimestamp(year: number, suffix?: string): Date | null {
  const storage = getStorage()
  if (!storage) {
    return null
  }

  const key = buildCacheKey(year, suffix)
  const raw = storage.getItem(key)
  if (!raw) {
    return null
  }

  const cached = parseCachedData(raw)
  if (!cached) {
    return null
  }

  return new Date(cached.timestamp)
}

function clearOldCaches(storage: Storage): void {
  for (const key of Object.keys(storage)) {
    if (!key.startsWith(CACHE_PREFIX)) {
      continue
    }

    const raw = storage.getItem(key)
    if (!raw) {
      continue
    }

    const cached = parseCachedData(raw)
    if (!cached || Date.now() - cached.timestamp > CACHE_CLEANUP_MAX_AGE_MS) {
      storage.removeItem(key)
    }
  }
}
