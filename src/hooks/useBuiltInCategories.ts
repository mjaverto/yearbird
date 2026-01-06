import { useCallback, useState } from 'react'
import {
  disableBuiltInCategory,
  enableBuiltInCategory,
  getDisabledBuiltInCategories,
} from '../services/builtInCategories'
import type { BuiltInCategory } from '../types/calendar'

interface UseBuiltInCategoriesResult {
  disabledBuiltInCategories: BuiltInCategory[]
  disableBuiltInCategory: (category: BuiltInCategory) => void
  enableBuiltInCategory: (category: BuiltInCategory) => void
}

export function useBuiltInCategories(): UseBuiltInCategoriesResult {
  const [disabledBuiltInCategories, setDisabledBuiltInCategories] = useState<
    BuiltInCategory[]
  >(() => getDisabledBuiltInCategories())

  const handleDisable = useCallback((category: BuiltInCategory) => {
    const next = disableBuiltInCategory(category)
    setDisabledBuiltInCategories(next)
  }, [])

  const handleEnable = useCallback((category: BuiltInCategory) => {
    const next = enableBuiltInCategory(category)
    setDisabledBuiltInCategories(next)
  }, [])

  return {
    disabledBuiltInCategories,
    disableBuiltInCategory: handleDisable,
    enableBuiltInCategory: handleEnable,
  }
}
