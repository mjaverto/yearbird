import { DEFAULT_CATEGORY } from '../config/categories'
import { UNCATEGORIZED_CATEGORY } from '../services/categories'
import type { Category, CategoryConfig, CategoryMatchMode } from '../types/categories'
import type { EventCategory } from '../types/calendar'

const DEFAULT_MATCH_MODE: CategoryMatchMode = 'any'

/**
 * Convert a Category to CategoryConfig for display and matching.
 */
const toCategoryConfig = (category: Category): CategoryConfig => ({
  category: category.id,
  color: category.color,
  keywords: category.keywords,
  label: category.label,
  matchMode: category.matchMode,
})

/**
 * Sort categories alphabetically by label.
 */
const sortCategories = (categories: Category[]): Category[] =>
  [...categories].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  )

/**
 * Get all categories for display (legend, etc.), including uncategorized at the end.
 */
export function getAllCategories(categories: Category[] = []): CategoryConfig[] {
  const sorted = sortCategories(categories).map(toCategoryConfig)
  return [...sorted, toCategoryConfig(UNCATEGORIZED_CATEGORY)]
}

/**
 * Get categories for event matching (excludes uncategorized).
 * Categories are sorted alphabetically by label for consistent priority.
 */
export function getCategoryMatchList(categories: Category[] = []): CategoryConfig[] {
  return sortCategories(categories).map(toCategoryConfig)
}

/**
 * Check if a title matches the keywords based on the match mode.
 */
const matchesKeywords = (
  lowerText: string,
  keywords: string[],
  matchMode: CategoryMatchMode
): boolean => {
  if (keywords.length === 0) {
    return false
  }

  if (matchMode === 'all') {
    return keywords.every((keyword) => lowerText.includes(keyword.toLowerCase()))
  }

  return keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()))
}

/**
 * Options for event categorization.
 */
export interface CategorizeOptions {
  /** The event description to optionally match against */
  description?: string
  /** Whether to also search the description for category keywords */
  matchDescription?: boolean
}

/**
 * Categorizes an event based on its title and optionally its description.
 *
 * Matches event text against category keyword patterns. Title matches take
 * priority over description matches. Returns the first matching category
 * or defaults to 'other' if no match is found.
 *
 * @param title - The event title to categorize
 * @param categories - Category configurations to match against
 * @param options - Optional settings for description matching
 * @returns The matched category and its color
 *
 * @example
 * // Basic categorization by title
 * const result = categorizeEvent('Team Meeting', categories)
 *
 * @example
 * // With description matching enabled
 * const result = categorizeEvent('Quarterly Review', categories, {
 *   description: 'Discuss project milestones and team goals',
 *   matchDescription: true,
 * })
 */
export function categorizeEvent(
  title: string,
  categories: CategoryConfig[] = [],
  options?: CategorizeOptions
): { category: EventCategory; color: string } {
  const lowerTitle = title.toLowerCase()
  const lowerDescription =
    options?.matchDescription && options?.description
      ? options.description.toLowerCase()
      : ''

  for (const config of categories) {
    const matchMode = config.matchMode ?? DEFAULT_MATCH_MODE
    // Check title first
    if (matchesKeywords(lowerTitle, config.keywords, matchMode)) {
      return {
        category: config.category,
        color: config.color,
      }
    }
    // Check description if enabled and available
    if (lowerDescription && matchesKeywords(lowerDescription, config.keywords, matchMode)) {
      return {
        category: config.category,
        color: config.color,
      }
    }
  }

  return {
    category: DEFAULT_CATEGORY.category,
    color: DEFAULT_CATEGORY.color,
  }
}

/**
 * Get the configuration for a specific category by ID.
 */
export function getCategoryConfig(
  category: EventCategory,
  categories: CategoryConfig[] = []
): CategoryConfig {
  return categories.find((config) => config.category === category) ?? DEFAULT_CATEGORY
}
