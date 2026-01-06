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
})
