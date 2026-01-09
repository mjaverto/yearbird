export type CategoryMatchMode = 'any' | 'all'

/**
 * Unified category - used for both default and user-created categories.
 */
export interface Category {
  id: string
  label: string
  color: string
  keywords: string[]
  matchMode: CategoryMatchMode
  createdAt: number
  updatedAt: number
  isDefault?: boolean // true for categories that originated from defaults
}

/**
 * Input for creating or updating a category.
 */
export interface CategoryInput {
  label: string
  color: string
  keywords: string[]
  matchMode: CategoryMatchMode
}

/**
 * Result from category operations (add/update).
 */
export interface CategoryResult {
  category: Category | null
  error: string | null
}

/**
 * Legacy: CategoryConfig is now an alias for display purposes.
 * Used by ColorLegend and categorize utilities.
 */
export interface CategoryConfig {
  category: string
  color: string
  keywords: string[]
  label: string
  matchMode?: CategoryMatchMode
}

// Legacy type aliases for backward compatibility during migration
export type { Category as CustomCategory }
export type BuiltInCategoryConfig = Category
