import type { BuiltInCategory, CustomCategoryId, EventCategory } from './calendar'

export type CategoryMatchMode = 'any' | 'all'

export interface CategoryConfig {
  category: EventCategory
  color: string
  keywords: string[]
  label: string
  matchMode?: CategoryMatchMode
  isCustom?: boolean
}

export type BuiltInCategoryConfig = Omit<CategoryConfig, 'category'> & {
  category: BuiltInCategory
}

export interface CustomCategory {
  id: CustomCategoryId
  label: string
  color: string
  keywords: string[]
  matchMode: CategoryMatchMode
  createdAt: number
  updatedAt: number
}
