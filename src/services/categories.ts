/**
 * Unified Categories Service
 *
 * Manages all categories (both default and user-created) in a single storage.
 * Handles migration from the old split format (disabled-built-in + custom-categories).
 */

import { DEFAULT_CATEGORIES, UNCATEGORIZED_CATEGORY } from '../config/categories'
import type { Category, CategoryInput, CategoryMatchMode, CategoryResult } from '../types/categories'

const CATEGORIES_KEY = 'yearbird:categories'
const CATEGORIES_VERSION = 1
const CUSTOM_CATEGORY_PREFIX = 'custom-'
const DEFAULT_MATCH_MODE: CategoryMatchMode = 'any'
const MAX_LABEL_LENGTH = 32

// Legacy keys for migration
const LEGACY_DISABLED_BUILT_IN_KEY = 'yearbird:disabled-built-in-categories'
const LEGACY_CUSTOM_CATEGORIES_KEY = 'yearbird:custom-categories'

interface StoredCategories {
  version: number
  categories: Category[]
}

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

const createCategoryId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${CUSTOM_CATEGORY_PREFIX}${crypto.randomUUID()}`
  }
  return `${CUSTOM_CATEGORY_PREFIX}${Date.now()}-${Math.random().toString(16).slice(2)}`
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

/**
 * Sanitize and validate a list of categories.
 */
const sanitizeCategories = (categories: Category[]): Category[] => {
  const deduped = new Map<string, Category>()

  for (const entry of categories) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    if (typeof entry.id !== 'string' || !entry.id) {
      continue
    }

    const label = normalizeLabel(entry.label || '')
    const keywords = normalizeKeywords(Array.isArray(entry.keywords) ? entry.keywords : [])
    if (!label || !isValidColor(entry.color)) {
      continue
    }

    // Allow categories with no keywords (for default categories that might be edited)
    const matchMode = normalizeMatchMode(entry.matchMode)
    const createdAt = Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now()
    const updatedAt = Number.isFinite(entry.updatedAt) ? entry.updatedAt : createdAt

    const candidate: Category = {
      id: entry.id,
      label,
      color: entry.color,
      keywords,
      matchMode,
      createdAt,
      updatedAt,
      isDefault: entry.isDefault ?? false,
    }

    // Dedupe by lowercase label - keep the one with later updatedAt
    const normalizedLabel = label.toLowerCase()
    const existing = deduped.get(normalizedLabel)
    if (!existing || candidate.updatedAt > existing.updatedAt) {
      deduped.set(normalizedLabel, candidate)
    }
  }

  return Array.from(deduped.values())
}

/**
 * Write categories to storage.
 */
const writeCategories = (categories: Category[]): void => {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    const payload: StoredCategories = {
      version: CATEGORIES_VERSION,
      categories,
    }
    storage.setItem(CATEGORIES_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage failures
  }
}

/**
 * Read legacy disabled built-in categories.
 */
const readLegacyDisabledBuiltIns = (): string[] => {
  const storage = getStorage()
  if (!storage) {
    return []
  }

  try {
    const raw = storage.getItem(LEGACY_DISABLED_BUILT_IN_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item) => typeof item === 'string')
  } catch {
    return []
  }
}

/**
 * Read legacy custom categories.
 */
const readLegacyCustomCategories = (): Category[] => {
  const storage = getStorage()
  if (!storage) {
    return []
  }

  try {
    const raw = storage.getItem(LEGACY_CUSTOM_CATEGORIES_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    const categories = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.categories)
        ? parsed.categories
        : null
    if (!categories) {
      return []
    }
    return categories
      .filter((cat: unknown) => cat && typeof cat === 'object')
      .map((cat: Record<string, unknown>) => ({
        id: String(cat.id || ''),
        label: String(cat.label || ''),
        color: String(cat.color || ''),
        keywords: Array.isArray(cat.keywords) ? cat.keywords.map(String) : [],
        matchMode: normalizeMatchMode(cat.matchMode as CategoryMatchMode | null),
        createdAt: Number(cat.createdAt) || Date.now(),
        updatedAt: Number(cat.updatedAt) || Date.now(),
        isDefault: false,
      }))
  } catch {
    return []
  }
}

/**
 * Migrate from legacy format to unified format.
 */
const migrateFromLegacy = (): Category[] => {
  const storage = getStorage()
  const now = Date.now()

  // Read legacy data
  const disabledBuiltIns = new Set(readLegacyDisabledBuiltIns())
  const legacyCustom = readLegacyCustomCategories()

  // Build unified list: defaults (minus disabled) + custom
  const categories: Category[] = []

  for (const defaultCat of DEFAULT_CATEGORIES) {
    if (!disabledBuiltIns.has(defaultCat.id)) {
      categories.push({
        ...defaultCat,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // Add custom categories
  for (const custom of legacyCustom) {
    if (custom.id && custom.label && custom.color) {
      categories.push({
        ...custom,
        isDefault: false,
      })
    }
  }

  // Sanitize and write
  const sanitized = sanitizeCategories(categories)
  writeCategories(sanitized)

  // Clean up legacy keys
  if (storage) {
    try {
      storage.removeItem(LEGACY_DISABLED_BUILT_IN_KEY)
      storage.removeItem(LEGACY_CUSTOM_CATEGORIES_KEY)
    } catch {
      // Ignore
    }
  }

  return sanitized
}

/**
 * Initialize with default categories (fresh install).
 */
const initializeDefaults = (): Category[] => {
  const now = Date.now()
  const categories: Category[] = DEFAULT_CATEGORIES.map((cat) => ({
    ...cat,
    createdAt: now,
    updatedAt: now,
  }))
  writeCategories(categories)
  return categories
}

/**
 * Get all user categories (excludes uncategorized).
 */
export function getCategories(): Category[] {
  const storage = getStorage()
  if (!storage) {
    // Return defaults for SSR
    const now = Date.now()
    return DEFAULT_CATEGORIES.map((cat) => ({
      ...cat,
      createdAt: now,
      updatedAt: now,
    }))
  }

  // Check if we have new format
  const raw = storage.getItem(CATEGORIES_KEY)

  if (!raw) {
    // Check for legacy data to migrate
    const hasLegacyDisabled = storage.getItem(LEGACY_DISABLED_BUILT_IN_KEY)
    const hasLegacyCustom = storage.getItem(LEGACY_CUSTOM_CATEGORIES_KEY)

    if (hasLegacyDisabled || hasLegacyCustom) {
      return migrateFromLegacy()
    }

    // Fresh install - initialize with defaults
    return initializeDefaults()
  }

  try {
    const parsed = JSON.parse(raw) as StoredCategories
    if (!parsed || !Array.isArray(parsed.categories)) {
      throw new Error('Invalid categories format')
    }

    const sanitized = sanitizeCategories(parsed.categories)

    // Re-write if sanitization changed anything
    if (sanitized.length !== parsed.categories.length) {
      writeCategories(sanitized)
    }

    return sanitized
  } catch {
    storage.removeItem(CATEGORIES_KEY)
    return initializeDefaults()
  }
}

/**
 * Build a category from input with validation.
 */
const buildCategory = (
  input: CategoryInput,
  existing: Category[],
  id?: string
): CategoryResult => {
  const label = normalizeLabel(input.label)
  if (!label) {
    return { category: null, error: 'Name is required.' }
  }
  if (label.length > MAX_LABEL_LENGTH) {
    return { category: null, error: `Name must be ${MAX_LABEL_LENGTH} characters or fewer.` }
  }

  const keywords = normalizeKeywords(input.keywords)
  if (keywords.length === 0) {
    return { category: null, error: 'Add at least one keyword.' }
  }

  if (!isValidColor(input.color)) {
    return { category: null, error: 'Pick a valid color.' }
  }

  // Check for duplicate labels (excluding current category if editing)
  // Note: existing entries should already be sanitized/trimmed via getCategories()
  const normalizedLabel = label.toLowerCase()
  const duplicate = existing.find(
    (entry) => entry.id !== id && entry.label.toLowerCase() === normalizedLabel
  )
  if (duplicate) {
    return { category: null, error: 'A category with this name already exists.' }
  }

  // Cannot use 'uncategorized' as a name
  if (normalizedLabel === 'uncategorized') {
    return { category: null, error: 'This name is reserved.' }
  }

  const now = Date.now()
  const matchMode = normalizeMatchMode(input.matchMode)
  const existingCat = id ? existing.find((entry) => entry.id === id) : null

  const category: Category = {
    id: id ?? createCategoryId(),
    label,
    color: input.color,
    keywords,
    matchMode,
    createdAt: existingCat?.createdAt ?? now,
    updatedAt: now,
    isDefault: existingCat?.isDefault ?? false,
  }

  return { category, error: null }
}

/**
 * Add a new category.
 */
export function addCategory(input: CategoryInput): CategoryResult {
  const existing = getCategories()
  const result = buildCategory(input, existing)
  if (!result.category) {
    return result
  }

  writeCategories([...existing, result.category])
  return result
}

/**
 * Update an existing category.
 */
export function updateCategory(id: string, input: CategoryInput): CategoryResult {
  const existing = getCategories()
  const current = existing.find((entry) => entry.id === id)
  if (!current) {
    return { category: null, error: 'Category not found.' }
  }

  const result = buildCategory(input, existing, id)
  if (!result.category) {
    return result
  }

  const updated = existing.map((entry) => (entry.id === id ? result.category! : entry))
  writeCategories(updated)
  return result
}

/**
 * Remove a category by ID.
 */
export function removeCategory(id: string): void {
  const existing = getCategories()
  const updated = existing.filter((entry) => entry.id !== id)
  writeCategories(updated)
}

/**
 * Reset all categories to defaults.
 */
export function resetToDefaults(): Category[] {
  const now = Date.now()
  const categories: Category[] = DEFAULT_CATEGORIES.map((cat) => ({
    ...cat,
    createdAt: now,
    updatedAt: now,
  }))
  writeCategories(categories)
  return categories
}

/**
 * Restore a specific default category that was removed.
 */
export function restoreDefault(id: string): CategoryResult {
  const defaultCat = DEFAULT_CATEGORIES.find((cat) => cat.id === id)
  if (!defaultCat) {
    return { category: null, error: 'Not a default category.' }
  }

  const existing = getCategories()

  // Check if already exists
  if (existing.some((cat) => cat.id === id)) {
    return { category: null, error: 'Category already exists.' }
  }

  // Check for label collision
  const normalizedLabel = defaultCat.label.toLowerCase()
  if (existing.some((cat) => cat.label.toLowerCase() === normalizedLabel)) {
    return { category: null, error: 'A category with this name already exists.' }
  }

  const now = Date.now()
  const category: Category = {
    ...defaultCat,
    createdAt: now,
    updatedAt: now,
  }

  writeCategories([...existing, category])
  return { category, error: null }
}

/**
 * Get list of default categories that have been removed.
 */
export function getRemovedDefaults(): Category[] {
  const existing = getCategories()
  const existingIds = new Set(existing.map((cat) => cat.id))
  const now = Date.now()

  return DEFAULT_CATEGORIES.filter((cat) => !existingIds.has(cat.id)).map((cat) => ({
    ...cat,
    createdAt: now,
    updatedAt: now,
  }))
}

/**
 * Export the uncategorized constant for use elsewhere.
 */
export { UNCATEGORIZED_CATEGORY }
