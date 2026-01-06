import { CATEGORIES, DEFAULT_CATEGORY } from '../config/categories'
import type { CategoryMatchMode, CustomCategory } from '../types/categories'
import type { CustomCategoryId } from '../types/calendar'

export interface CustomCategoryInput {
  label: string
  color: string
  keywords: string[]
  matchMode: CategoryMatchMode
}

export interface CustomCategoryResult {
  category: CustomCategory | null
  error: string | null
}

const CUSTOM_CATEGORIES_KEY = 'yearbird:custom-categories'
const CUSTOM_CATEGORY_PREFIX = 'custom-'
const CUSTOM_CATEGORIES_VERSION = 1
const DEFAULT_MATCH_MODE: CategoryMatchMode = 'any'
const MAX_LABEL_LENGTH = 32

type StoredCustomCategories = {
  version: number
  categories: CustomCategory[]
}

const BUILT_IN_LABELS = new Set(
  [...CATEGORIES, DEFAULT_CATEGORY].map((category) => category.label.toLowerCase())
)

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

const createCustomCategoryId = (): CustomCategoryId => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${CUSTOM_CATEGORY_PREFIX}${crypto.randomUUID()}` as CustomCategoryId
  }
  return `${CUSTOM_CATEGORY_PREFIX}${Date.now()}-${Math.random().toString(16).slice(2)}` as CustomCategoryId
}

const normalizeLabel = (label: string) => label.trim()

const normalizeMatchMode = (mode: CategoryMatchMode | null | undefined): CategoryMatchMode =>
  mode === 'all' ? 'all' : DEFAULT_MATCH_MODE

const normalizeKeywords = (keywords: string[]): string[] => {
  const cleaned: string[] = []
  const seen = new Set<string>()

  for (const keyword of keywords) {
    const trimmed = keyword.trim()
    if (!trimmed) {
      continue
    }
    const normalized = trimmed.toLowerCase()
    if (seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    cleaned.push(trimmed)
  }

  return cleaned
}

const isValidColor = (color: string): boolean => /^#[0-9a-fA-F]{6}$/.test(color)

const isCustomCategoryId = (value: string): value is CustomCategoryId =>
  value.startsWith(CUSTOM_CATEGORY_PREFIX)

const sanitizeCustomCategories = (categories: CustomCategory[]): CustomCategory[] => {
  const deduped = new Map<string, CustomCategory>()
  for (const entry of categories) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    if (typeof entry.id !== 'string' || !isCustomCategoryId(entry.id)) {
      continue
    }

    const label = normalizeLabel(entry.label)
    const keywords = normalizeKeywords(Array.isArray(entry.keywords) ? entry.keywords : [])
    if (!label || keywords.length === 0 || !isValidColor(entry.color)) {
      continue
    }

    const matchMode = normalizeMatchMode(entry.matchMode)
    const createdAt = Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now()
    const updatedAt = Number.isFinite(entry.updatedAt) ? entry.updatedAt : createdAt
    const normalizedLabel = label.toLowerCase()
    if (BUILT_IN_LABELS.has(normalizedLabel)) {
      continue
    }

    const candidate: CustomCategory = {
      id: entry.id,
      label,
      color: entry.color,
      keywords,
      matchMode,
      createdAt,
      updatedAt,
    }

    const existing = deduped.get(normalizedLabel)
    if (!existing || candidate.updatedAt > existing.updatedAt) {
      deduped.set(normalizedLabel, candidate)
    }
  }

  return Array.from(deduped.values())
}

const writeCustomCategories = (categories: CustomCategory[]) => {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    if (categories.length === 0) {
      storage.removeItem(CUSTOM_CATEGORIES_KEY)
      return
    }

    const payload: StoredCustomCategories = {
      version: CUSTOM_CATEGORIES_VERSION,
      categories,
    }
    storage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage failures.
  }
}

export function getCustomCategories(): CustomCategory[] {
  const storage = getStorage()
  if (!storage) {
    return []
  }

  const raw = storage.getItem(CUSTOM_CATEGORIES_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as StoredCustomCategories | CustomCategory[]
    const categories = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.categories)
        ? parsed.categories
        : null
    if (!categories) {
      throw new Error('Custom categories is not a valid payload')
    }

    const sanitized = sanitizeCustomCategories(categories)
    if (sanitized.length !== categories.length || Array.isArray(parsed)) {
      writeCustomCategories(sanitized)
    }

    return sanitized
  } catch {
    storage.removeItem(CUSTOM_CATEGORIES_KEY)
    return []
  }
}

const buildCustomCategory = (
  input: CustomCategoryInput,
  existing: CustomCategory[],
  id?: CustomCategoryId
): CustomCategoryResult => {
  const label = normalizeLabel(input.label)
  if (!label) {
    return { category: null, error: 'Name is required.' }
  }
  if (label.length > MAX_LABEL_LENGTH) {
    return { category: null, error: `Name must be ${MAX_LABEL_LENGTH} characters or fewer.` }
  }

  const normalizedLabel = label.toLowerCase()
  if (BUILT_IN_LABELS.has(normalizedLabel)) {
    return { category: null, error: 'Name already exists as a default category.' }
  }

  const keywords = normalizeKeywords(input.keywords)
  if (keywords.length === 0) {
    return { category: null, error: 'Add at least one keyword.' }
  }

  if (!isValidColor(input.color)) {
    return { category: null, error: 'Pick a valid color.' }
  }

  const duplicate = existing.find(
    (entry) => entry.id !== id && entry.label.trim().toLowerCase() === normalizedLabel
  )
  if (duplicate) {
    return { category: null, error: 'Name already exists.' }
  }

  const now = Date.now()
  const matchMode = normalizeMatchMode(input.matchMode)
  const category: CustomCategory = {
    id: id ?? createCustomCategoryId(),
    label,
    color: input.color,
    keywords,
    matchMode,
    createdAt: id
      ? existing.find((entry) => entry.id === id)?.createdAt ?? now
      : now,
    updatedAt: now,
  }

  return { category, error: null }
}

export function addCustomCategory(input: CustomCategoryInput): CustomCategoryResult {
  const existing = getCustomCategories()
  const result = buildCustomCategory(input, existing)
  if (!result.category) {
    return result
  }

  writeCustomCategories([...existing, result.category])
  return result
}

export function updateCustomCategory(
  id: CustomCategoryId,
  input: CustomCategoryInput
): CustomCategoryResult {
  const existing = getCustomCategories()
  const current = existing.find((entry) => entry.id === id)
  if (!current) {
    return { category: null, error: 'Category no longer exists.' }
  }
  const result = buildCustomCategory(input, existing, id)
  if (!result.category) {
    return result
  }

  const updated = existing.map((entry) => (entry.id === id ? result.category! : entry))
  writeCustomCategories(updated)
  return result
}

export function removeCustomCategory(id: CustomCategoryId): void {
  const existing = getCustomCategories()
  const updated = existing.filter((entry) => entry.id !== id)
  writeCustomCategories(updated)
}
