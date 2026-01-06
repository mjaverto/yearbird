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
  lowerTitle: string,
  keywords: string[],
  matchMode: CategoryMatchMode
) => {
  if (keywords.length === 0) {
    return false
  }

  if (matchMode === 'all') {
    return keywords.every((keyword) => lowerTitle.includes(keyword.toLowerCase()))
  }

  return keywords.some((keyword) => lowerTitle.includes(keyword.toLowerCase()))
}

export function categorizeEvent(
  title: string,
  categories: CategoryConfig[] = getCategoryMatchList()
): { category: EventCategory; color: string } {
  const lowerTitle = title.toLowerCase()

  for (const config of categories) {
    const matchMode = config.matchMode ?? DEFAULT_MATCH_MODE
    if (matchesKeywords(lowerTitle, config.keywords, matchMode)) {
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
