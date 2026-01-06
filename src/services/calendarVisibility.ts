const DISABLED_CALENDARS_KEY = 'yearbird:disabled-calendars'

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

const normalizeDisabled = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const entries = value.filter((entry): entry is string => typeof entry === 'string')
  return [...new Set(entries.map((entry) => entry.trim()).filter(Boolean))]
}

const writeDisabledCalendars = (disabled: string[]) => {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    if (disabled.length === 0) {
      storage.removeItem(DISABLED_CALENDARS_KEY)
      return
    }
    storage.setItem(DISABLED_CALENDARS_KEY, JSON.stringify(disabled))
  } catch {
    // Ignore storage failures.
  }
}

export function getDisabledCalendars(): string[] {
  const storage = getStorage()
  if (!storage) {
    return []
  }

  const raw = storage.getItem(DISABLED_CALENDARS_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    const cleaned = normalizeDisabled(parsed)
    if (cleaned.length !== parsed.length) {
      writeDisabledCalendars(cleaned)
    }
    return cleaned
  } catch {
    storage.removeItem(DISABLED_CALENDARS_KEY)
    return []
  }
}

export function setDisabledCalendars(disabled: string[]): string[] {
  const cleaned = normalizeDisabled(disabled)
  writeDisabledCalendars(cleaned)
  return cleaned
}

export function disableCalendar(id: string): string[] {
  const existing = getDisabledCalendars()
  if (existing.includes(id)) {
    return existing
  }
  const next = [...existing, id]
  writeDisabledCalendars(next)
  return next
}

export function enableCalendar(id: string): string[] {
  const existing = getDisabledCalendars()
  if (!existing.includes(id)) {
    return existing
  }
  const next = existing.filter((entry) => entry !== id)
  writeDisabledCalendars(next)
  return next
}
