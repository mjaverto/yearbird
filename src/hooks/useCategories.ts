import { useCallback, useMemo, useState } from 'react'
import { DEFAULT_CATEGORIES } from '../config/categories'
import {
  addCategory,
  getCategories,
  removeCategory,
  resetToDefaults,
  restoreDefault,
  UNCATEGORIZED_CATEGORY,
  updateCategory,
} from '../services/categories'
import { scheduleSyncToCloud } from '../services/syncManager'
import type { Category, CategoryInput, CategoryResult } from '../types/categories'

interface UseCategoriesResult {
  /** User categories (excludes uncategorized) */
  categories: Category[]
  /** All categories including uncategorized (for display) */
  allCategories: Category[]
  /** Default categories that have been removed (available to restore) */
  removedDefaults: Category[]
  /** Add a new category */
  addCategory: (input: CategoryInput) => CategoryResult
  /** Update an existing category */
  updateCategory: (id: string, input: CategoryInput) => CategoryResult
  /** Remove a category */
  removeCategory: (id: string) => void
  /** Restore a removed default category */
  restoreDefault: (id: string) => CategoryResult
  /** Reset all categories to defaults */
  resetToDefaults: () => void
}

export function useCategories(): UseCategoriesResult {
  const [categories, setCategories] = useState<Category[]>(() => getCategories())

  const handleAdd = useCallback((input: CategoryInput) => {
    const result = addCategory(input)
    if (result.category) {
      setCategories((prev) => [...prev, result.category!])
      scheduleSyncToCloud()
    }
    return result
  }, [])

  const handleUpdate = useCallback((id: string, input: CategoryInput) => {
    const result = updateCategory(id, input)
    if (result.category) {
      setCategories((prev) => prev.map((entry) => (entry.id === id ? result.category! : entry)))
      scheduleSyncToCloud()
    }
    return result
  }, [])

  const handleRemove = useCallback((id: string) => {
    removeCategory(id)
    setCategories((prev) => prev.filter((entry) => entry.id !== id))
    scheduleSyncToCloud()
  }, [])

  const handleRestoreDefault = useCallback((id: string) => {
    const result = restoreDefault(id)
    if (result.category) {
      setCategories((prev) => [...prev, result.category!])
      scheduleSyncToCloud()
    }
    return result
  }, [])

  const handleResetToDefaults = useCallback(() => {
    const defaults = resetToDefaults()
    setCategories(defaults)
    scheduleSyncToCloud()
  }, [])

  // Compute removed defaults from React state (not localStorage) to avoid race conditions
  // Use stable timestamp (0) since these are display-only placeholders -
  // actual timestamps are set when category is restored via restoreDefault()
  const removedDefaults = useMemo(() => {
    const existingIds = new Set(categories.map((cat) => cat.id))
    return DEFAULT_CATEGORIES.filter((cat) => !existingIds.has(cat.id)).map((cat) => ({
      ...cat,
      createdAt: 0,
      updatedAt: 0,
    }))
  }, [categories])

  const allCategories = useMemo(
    () => [...categories, UNCATEGORIZED_CATEGORY],
    [categories]
  )

  return {
    categories,
    allCategories,
    removedDefaults,
    addCategory: handleAdd,
    updateCategory: handleUpdate,
    removeCategory: handleRemove,
    restoreDefault: handleRestoreDefault,
    resetToDefaults: handleResetToDefaults,
  }
}
