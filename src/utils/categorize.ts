import { CATEGORIES, DEFAULT_CATEGORY } from '../config/categories'
import type { CategoryConfig, CategoryMatchMode, CustomCategory } from '../types/categories'
import type { BuiltInCategory, EventCategory } from '../types/calendar'

const DEFAULT_MATCH_MODE: CategoryMatchMode = 'any'

const toCustomCategoryConfig = (category: CustomCategory): CategoryConfig => ({
  category: category.id,
  color: category.color,
  keywords: category.keywords,
  label: category.label,
  matchMode: category.matchMode,
  isCustom: true,
})

const sortCustomCategories = (customCategories: CustomCategory[]) =>
  [...customCategories].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  )

const filterBuiltInCategories = (disabledBuiltIns: BuiltInCategory[]) => {
  if (disabledBuiltIns.length === 0) {
    return CATEGORIES
  }
  const disabledSet = new Set(disabledBuiltIns)
  return CATEGORIES.filter((category) => !disabledSet.has(category.category))
}

export function getAllCategories(
  customCategories: CustomCategory[] = [],
  disabledBuiltIns: BuiltInCategory[] = []
): CategoryConfig[] {
  const customConfigs = sortCustomCategories(customCategories).map(toCustomCategoryConfig)
  const builtIns = filterBuiltInCategories(disabledBuiltIns)
  return [...builtIns, ...customConfigs, DEFAULT_CATEGORY]
}

export function getCategoryMatchList(
  customCategories: CustomCategory[] = [],
  disabledBuiltIns: BuiltInCategory[] = []
): CategoryConfig[] {
  const customConfigs = sortCustomCategories(customCategories).map(toCustomCategoryConfig)
  const builtIns = filterBuiltInCategories(disabledBuiltIns)
  return [...customConfigs, ...builtIns]
}

const matchesKeywords = (
  lowerText: string,
  keywords: string[],
  matchMode: CategoryMatchMode
) => {
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
 * @param categories - Category configurations to match against (default: all configured categories)
 * @param options - Optional settings for description matching
 * @returns The matched category and its color
 *
 * @example
 * // Basic categorization by title
 * const result = categorizeEvent('Team Meeting')
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
  categories: CategoryConfig[] = getCategoryMatchList(),
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

export function getCategoryConfig(
  category: EventCategory,
  categories: CategoryConfig[] = getAllCategories()
): CategoryConfig {
  return categories.find((config) => config.category === category) ?? DEFAULT_CATEGORY
}
