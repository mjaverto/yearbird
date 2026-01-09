import { beforeEach, describe, expect, it } from 'vitest'
import { categorizeEvent, getAllCategories, getCategoryConfig, getCategoryMatchList } from './categorize'
import type { Category  } from '../types/categories'

// Helper to create test categories
const createCategory = (
  id: string,
  label: string,
  keywords: string[],
  color = '#111111',
  matchMode: 'any' | 'all' = 'any'
): Category => ({
  id,
  label,
  color,
  keywords,
  matchMode,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isDefault: !id.startsWith('custom-'),
})

// Default categories for testing
const defaultCategories: Category[] = [
  createCategory('birthdays', 'Birthdays', ['birthday', 'bday', 'b-day'], '#F59E0B'),
  createCategory('family', 'Family', ['family', 'kids', 'kid', 'mom', 'dad'], '#3B82F6'),
  createCategory('holidays', 'Holidays/Trips', ['flight', 'hotel', 'vacation', 'trip', 'travel'], '#F97316'),
  createCategory('races', 'Races', ['race', 'marathon', 'run', 'hike'], '#10B981'),
  createCategory('work', 'Work', ['meeting', 'call', '1:1', 'sync', 'review', 'standup'], '#8B5CF6'),
]

describe('categorizeEvent', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('categorizes birthdays', () => {
    const matchList = getCategoryMatchList(defaultCategories)
    expect(categorizeEvent("John's birthday", matchList)).toEqual({
      category: 'birthdays',
      color: '#F59E0B',
    })
  })

  it('categorizes flights as holidays', () => {
    const matchList = getCategoryMatchList(defaultCategories)
    expect(categorizeEvent('Flight to NYC', matchList)).toEqual({
      category: 'holidays',
      color: '#F97316',
    })
  })

  it('is case insensitive', () => {
    const matchList = getCategoryMatchList(defaultCategories)
    expect(categorizeEvent('BIRTHDAY PARTY', matchList)).toEqual({
      category: 'birthdays',
      color: '#F59E0B',
    })
  })

  it('returns uncategorized for unknown events', () => {
    const matchList = getCategoryMatchList(defaultCategories)
    expect(categorizeEvent('Random event', matchList)).toEqual({
      category: 'uncategorized',
      color: '#9CA3AF',
    })
  })

  it('returns the default config when missing from the list', () => {
    expect(getCategoryConfig('uncategorized')).toMatchObject({
      category: 'uncategorized',
      color: '#9CA3AF',
    })
  })

  it('returns all categories with uncategorized last', () => {
    const categories = getAllCategories(defaultCategories)
    expect(categories.at(-1)?.category).toBe('uncategorized')
    expect(categories).toHaveLength(6) // 5 defaults + uncategorized
  })

  it('matches categories with AND keywords', () => {
    const custom = createCategory('custom-1', 'Trips', ['family', 'trip'], '#111111', 'all')
    const matchList = getCategoryMatchList([custom])

    expect(categorizeEvent('Family trip to NYC', matchList)).toEqual({
      category: 'custom-1',
      color: '#111111',
    })

    // Should NOT match if only one keyword is present
    expect(categorizeEvent('Family gathering', matchList)).toEqual({
      category: 'uncategorized',
      color: '#9CA3AF',
    })
  })

  it('matches overlapping categories in alphabetical order', () => {
    const trips = createCategory('custom-1', 'Trips', ['trip'], '#111111')
    const family = createCategory('custom-2', 'Family', ['family'], '#222222')
    const matchList = getCategoryMatchList([trips, family])

    // "Family" comes before "Trips" alphabetically, so it matches first
    expect(categorizeEvent('Family trip to NYC', matchList)).toEqual({
      category: 'custom-2',
      color: '#222222',
    })
  })

  it('returns empty match list with no categories', () => {
    const matchList = getCategoryMatchList([])
    expect(matchList).toHaveLength(0)

    expect(categorizeEvent('Weekly meeting', matchList)).toEqual({
      category: 'uncategorized',
      color: '#9CA3AF',
    })
  })

  it('does not include removed categories in matching', () => {
    // Only include some defaults (simulating removed categories)
    const withoutWork = defaultCategories.filter((c) => c.id !== 'work')
    const matchList = getCategoryMatchList(withoutWork)

    expect(categorizeEvent('Weekly meeting', matchList)).toEqual({
      category: 'uncategorized',
      color: '#9CA3AF',
    })
  })

  it('does not include removed categories in legend', () => {
    const withoutWork = defaultCategories.filter((c) => c.id !== 'work')
    const categories = getAllCategories(withoutWork)
    const ids = categories.map((c) => c.category)

    expect(ids).not.toContain('work')
    expect(ids.at(-1)).toBe('uncategorized')
  })

  it('sorts categories alphabetically by label', () => {
    const a = createCategory('cat-a', 'Zebra', ['z'])
    const b = createCategory('cat-b', 'Apple', ['a'])
    const c = createCategory('cat-c', 'Mango', ['m'])

    const matchList = getCategoryMatchList([a, b, c])
    expect(matchList.map((c) => c.label)).toEqual(['Apple', 'Mango', 'Zebra'])
  })

  describe('description matching', () => {
    it('does not match description when matchDescription is false', () => {
      const matchList = getCategoryMatchList(defaultCategories)
      // Use a title that doesn't match any category
      const result = categorizeEvent('Random event xyz', matchList, {
        description: "John's birthday party planning",
        matchDescription: false,
      })

      expect(result.category).toBe('uncategorized')
    })

    it('does not match description when matchDescription is undefined', () => {
      const matchList = getCategoryMatchList(defaultCategories)
      // Use a title that doesn't match any category
      const result = categorizeEvent('Random event xyz', matchList, {
        description: "John's birthday party planning",
      })

      expect(result.category).toBe('uncategorized')
    })

    it('matches category from description when matchDescription is true', () => {
      const matchList = getCategoryMatchList(defaultCategories)
      const result = categorizeEvent('Team sync', matchList, {
        description: "Celebrating John's birthday at the office",
        matchDescription: true,
      })

      expect(result.category).toBe('birthdays')
    })

    it('prioritizes title match over description match', () => {
      const matchList = getCategoryMatchList(defaultCategories)
      const result = categorizeEvent('Birthday party', matchList, {
        description: 'Weekly team meeting notes',
        matchDescription: true,
      })

      // Title matches 'birthday' first, so should be birthdays, not work
      expect(result.category).toBe('birthdays')
    })

    it('handles empty description gracefully', () => {
      const matchList = getCategoryMatchList(defaultCategories)
      const result = categorizeEvent('Random event', matchList, {
        description: '',
        matchDescription: true,
      })

      expect(result.category).toBe('uncategorized')
    })

    it('handles undefined description gracefully', () => {
      const matchList = getCategoryMatchList(defaultCategories)
      const result = categorizeEvent('Random event', matchList, {
        matchDescription: true,
      })

      expect(result.category).toBe('uncategorized')
    })

    it('is case insensitive for description matching', () => {
      const matchList = getCategoryMatchList(defaultCategories)
      const result = categorizeEvent('Random sync', matchList, {
        description: 'BIRTHDAY CELEBRATION',
        matchDescription: true,
      })

      expect(result.category).toBe('birthdays')
    })

    it('works with custom categories and description matching', () => {
      const custom = {
        id: 'custom-1',
        label: 'Celebrations',
        color: '#FF0000',
        keywords: ['celebrate', 'party'],
        matchMode: 'any' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const categories = getCategoryMatchList([custom])

      const result = categorizeEvent('Weekly sync', categories, {
        description: 'Celebrate the team wins!',
        matchDescription: true,
      })

      expect(result.category).toBe('custom-1')
      expect(result.color).toBe('#FF0000')
    })

    it('respects matchMode in description matching', () => {
      const custom = {
        id: 'custom-1',
        label: 'Yoga Classes',
        color: '#00FF00',
        keywords: ['yoga', 'studio'],
        matchMode: 'all' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const categories = getCategoryMatchList([custom])

      // Description has 'yoga' but not 'studio' - should NOT match with 'all' mode
      const result1 = categorizeEvent('Random xyz', categories, {
        description: 'Yoga session at home',
        matchDescription: true,
      })
      expect(result1.category).toBe('uncategorized')

      // Description has both 'yoga' and 'studio' - should match
      const result2 = categorizeEvent('Random xyz', categories, {
        description: 'Yoga at the studio downtown',
        matchDescription: true,
      })
      expect(result2.category).toBe('custom-1')
    })
  })
})
