import { CATEGORIES } from '../config/categories'
import type { BuiltInCategory } from '../types/calendar'

const DISABLED_BUILT_IN_KEY = 'yearbird:disabled-built-in-categories'
const BUILT_IN_SET = new Set<BuiltInCategory>(CATEGORIES.map((category) => category.category))

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

const sanitizeDisabled = (value: unknown): BuiltInCategory[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const validEntries = value.filter(
    (entry): entry is BuiltInCategory =>
      typeof entry === 'string' && BUILT_IN_SET.has(entry as BuiltInCategory)
  )

  return [...new Set(validEntries)]
}

const writeDisabledBuiltIns = (disabled: BuiltInCategory[]) => {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    if (disabled.length === 0) {
      storage.removeItem(DISABLED_BUILT_IN_KEY)
      return
    }
    storage.setItem(DISABLED_BUILT_IN_KEY, JSON.stringify(disabled))
  } catch {
    // Ignore storage failures.
  }
}

export function getDisabledBuiltInCategories(): BuiltInCategory[] {
  const storage = getStorage()
  if (!storage) {
    return []
  }

  const raw = storage.getItem(DISABLED_BUILT_IN_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    const cleaned = sanitizeDisabled(parsed)
    if (cleaned.length !== parsed.length) {
      writeDisabledBuiltIns(cleaned)
    }
    return cleaned
  } catch {
    storage.removeItem(DISABLED_BUILT_IN_KEY)
    return []
  }
}

export function disableBuiltInCategory(category: BuiltInCategory): BuiltInCategory[] {
  const existing = getDisabledBuiltInCategories()
  if (existing.includes(category)) {
    return existing
  }
  const next = [...existing, category]
  writeDisabledBuiltIns(next)
  return next
}

export function enableBuiltInCategory(category: BuiltInCategory): BuiltInCategory[] {
  const existing = getDisabledBuiltInCategories()
  if (!existing.includes(category)) {
    return existing
  }
  const next = existing.filter((entry) => entry !== category)
  writeDisabledBuiltIns(next)
  return next
}
