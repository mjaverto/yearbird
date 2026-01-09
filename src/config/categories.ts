import type { Category, CategoryConfig } from '../types/categories'

/**
 * Default category definitions - the source of truth for "Reset to defaults".
 * These are the categories that ship with the app.
 */
export const DEFAULT_CATEGORIES: Omit<Category, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'birthdays',
    label: 'Birthdays',
    color: '#F59E0B',
    keywords: ['birthday', 'bday', 'b-day'],
    matchMode: 'any',
    isDefault: true,
  },
  {
    id: 'family',
    label: 'Family',
    color: '#3B82F6',
    keywords: ['family', 'kids', 'kid', 'mom', 'dad', 'anniversary', 'wedding', 'reunion'],
    matchMode: 'any',
    isDefault: true,
  },
  {
    id: 'holidays',
    label: 'Holidays/Trips',
    color: '#F97316',
    keywords: ['flight', 'hotel', 'stay at', 'vacation', 'holiday', 'trip', 'travel', 'airport'],
    matchMode: 'any',
    isDefault: true,
  },
  {
    id: 'races',
    label: 'Races',
    color: '#10B981',
    keywords: ['race', 'marathon', 'run', 'hike', 'summit', 'climb', 'trek', '5k', '10k'],
    matchMode: 'any',
    isDefault: true,
  },
  {
    id: 'work',
    label: 'Work',
    color: '#8B5CF6',
    keywords: ['meeting', 'call', '1:1', 'sync', 'review', 'standup', 'interview', 'retro'],
    matchMode: 'any',
    isDefault: true,
  },
]

/**
 * The uncategorized fallback - always appears last and cannot be removed.
 */
export const UNCATEGORIZED_CATEGORY: Category = {
  id: 'uncategorized',
  label: 'Uncategorized',
  color: '#9CA3AF',
  keywords: [],
  matchMode: 'any',
  createdAt: 0,
  updatedAt: 0,
  isDefault: true,
}

/**
 * Legacy exports for backward compatibility during migration.
 */
export const CATEGORIES = DEFAULT_CATEGORIES.map((cat) => ({
  category: cat.id,
  color: cat.color,
  keywords: cat.keywords,
  label: cat.label,
}))

export const DEFAULT_CATEGORY: CategoryConfig = {
  category: 'uncategorized',
  color: '#9CA3AF',
  keywords: [],
  label: 'Uncategorized',
}
