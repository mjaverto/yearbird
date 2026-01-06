import type { BuiltInCategoryConfig, CategoryConfig } from '../types/categories'

export const CATEGORIES: BuiltInCategoryConfig[] = [
  {
    category: 'birthdays',
    color: '#F59E0B',
    keywords: ['birthday', 'bday', 'b-day'],
    label: 'Birthdays',
  },
  {
    category: 'family',
    color: '#3B82F6',
    keywords: ['family', 'kids', 'kid', 'mom', 'dad', 'anniversary', 'wedding', 'reunion'],
    label: 'Family',
  },
  {
    category: 'holidays',
    color: '#F97316',
    keywords: ['flight', 'hotel', 'stay at', 'vacation', 'holiday', 'trip', 'travel', 'airport'],
    label: 'Holidays/Trips',
  },
  {
    category: 'adventures',
    color: '#EF4444',
    keywords: ['reservation', 'concert', 'show', 'museum', 'theater', 'theatre', 'game', 'match'],
    label: 'Mini Adventures',
  },
  {
    category: 'races',
    color: '#10B981',
    keywords: ['race', 'marathon', 'run', 'hike', 'summit', 'climb', 'trek', '5k', '10k'],
    label: 'Races/Adventures',
  },
  {
    category: 'work',
    color: '#8B5CF6',
    keywords: ['meeting', 'call', '1:1', 'sync', 'review', 'standup', 'interview', 'retro'],
    label: 'Work',
  },
]

export const DEFAULT_CATEGORY: CategoryConfig = {
  category: 'uncategorized',
  color: '#9CA3AF',
  keywords: [],
  label: 'Uncategorized',
}
