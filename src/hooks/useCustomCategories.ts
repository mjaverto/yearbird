import { useCallback, useState } from 'react'
import {
  addCustomCategory,
  getCustomCategories,
  removeCustomCategory,
  updateCustomCategory,
  type CustomCategoryInput,
  type CustomCategoryResult,
} from '../services/customCategories'
import type { CustomCategoryId } from '../types/calendar'
import type { CustomCategory } from '../types/categories'

interface UseCustomCategoriesResult {
  customCategories: CustomCategory[]
  addCustomCategory: (input: CustomCategoryInput) => CustomCategoryResult
  updateCustomCategory: (id: CustomCategoryId, input: CustomCategoryInput) => CustomCategoryResult
  removeCustomCategory: (id: CustomCategoryId) => void
}

export function useCustomCategories(): UseCustomCategoriesResult {
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(() =>
    getCustomCategories()
  )

  const handleAdd = useCallback((input: CustomCategoryInput) => {
    const result = addCustomCategory(input)
    if (result.category) {
      setCustomCategories((prev) => [...prev, result.category!])
    }
    return result
  }, [])

  const handleUpdate = useCallback((id: CustomCategoryId, input: CustomCategoryInput) => {
    const result = updateCustomCategory(id, input)
    if (result.category) {
      setCustomCategories((prev) =>
        prev.map((entry) => (entry.id === id ? result.category! : entry))
      )
    }
    return result
  }, [])

  const handleRemove = useCallback((id: CustomCategoryId) => {
    removeCustomCategory(id)
    setCustomCategories((prev) => prev.filter((entry) => entry.id !== id))
  }, [])

  return {
    customCategories,
    addCustomCategory: handleAdd,
    updateCustomCategory: handleUpdate,
    removeCustomCategory: handleRemove,
  }
}
