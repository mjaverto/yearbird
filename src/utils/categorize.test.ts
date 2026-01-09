import { describe, expect, it } from 'vitest'
import { categorizeEvent, getAllCategories, getCategoryConfig, getCategoryMatchList } from './categorize'

describe('categorizeEvent', () => {
  it('categorizes birthdays', () => {
    expect(categorizeEvent("John's birthday")).toEqual({
      category: 'birthdays',
      color: '#F59E0B',
    })
  })

  it('categorizes flights as holidays', () => {
    expect(categorizeEvent('Flight to NYC')).toEqual({
      category: 'holidays',
      color: '#F97316',
    })
  })

  it('is case insensitive', () => {
    expect(categorizeEvent('BIRTHDAY PARTY')).toEqual({
      category: 'birthdays',
      color: '#F59E0B',
    })
  })

  it('returns uncategorized for unknown events', () => {
    expect(categorizeEvent('Random event')).toEqual({
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
    const categories = getAllCategories()
    expect(categories.at(-1)?.category).toBe('uncategorized')
    expect(categories).toHaveLength(7)
  })

  it('matches custom categories with AND keywords before defaults', () => {
    const custom = {
      id: 'custom-1',
      label: 'Trips',
      color: '#111111',
      keywords: ['family', 'trip'],
      matchMode: 'all',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const categories = getCategoryMatchList([custom])

    expect(categorizeEvent('Family trip to NYC', categories)).toEqual({
      category: 'custom-1',
      color: '#111111',
    })
  })

  it('matches overlapping custom categories in label order', () => {
    const first = {
      id: 'custom-1',
      label: 'Trips',
      color: '#111111',
      keywords: ['trip'],
      matchMode: 'any',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const second = {
      id: 'custom-2',
      label: 'Family',
      color: '#222222',
      keywords: ['family'],
      matchMode: 'any',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const categories = getCategoryMatchList([first, second])

    expect(categorizeEvent('Family trip to NYC', categories)).toEqual({
      category: 'custom-2',
      color: '#222222',
    })
  })

  it('omits disabled built-in categories from matching', () => {
    const categories = getCategoryMatchList([], ['work'])

    expect(categorizeEvent('Weekly meeting', categories)).toEqual({
      category: 'uncategorized',
      color: '#9CA3AF',
    })
  })

  it('omits disabled built-in categories from the legend list', () => {
    const categories = getAllCategories([], ['work'])
    const labels = categories.map((category) => category.category)

    expect(labels).not.toContain('work')
    expect(labels.at(-1)).toBe('uncategorized')
  })

  describe('description matching', () => {
    it('does not match description when matchDescription is false', () => {
      // Use a title that doesn't match any category
      const result = categorizeEvent('Random event xyz', undefined, {
        description: "John's birthday party planning",
        matchDescription: false,
      })

      expect(result.category).toBe('uncategorized')
    })

    it('does not match description when matchDescription is undefined', () => {
      // Use a title that doesn't match any category
      const result = categorizeEvent('Random event xyz', undefined, {
        description: "John's birthday party planning",
      })

      expect(result.category).toBe('uncategorized')
    })

    it('matches category from description when matchDescription is true', () => {
      const result = categorizeEvent('Team sync', undefined, {
        description: "Celebrating John's birthday at the office",
        matchDescription: true,
      })

      expect(result.category).toBe('birthdays')
    })

    it('prioritizes title match over description match', () => {
      const result = categorizeEvent('Birthday party', undefined, {
        description: 'Weekly team meeting notes',
        matchDescription: true,
      })

      // Title matches 'birthday' first, so should be birthdays, not work
      expect(result.category).toBe('birthdays')
    })

    it('handles empty description gracefully', () => {
      const result = categorizeEvent('Random event', undefined, {
        description: '',
        matchDescription: true,
      })

      expect(result.category).toBe('uncategorized')
    })

    it('handles undefined description gracefully', () => {
      const result = categorizeEvent('Random event', undefined, {
        matchDescription: true,
      })

      expect(result.category).toBe('uncategorized')
    })

    it('is case insensitive for description matching', () => {
      const result = categorizeEvent('Random sync', undefined, {
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
