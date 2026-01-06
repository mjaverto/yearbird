import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addCustomCategory,
  getCustomCategories,
  removeCustomCategory,
  updateCustomCategory,
} from './customCategories'

const createCryptoStub = () => ({
  randomUUID: () => 'id-1',
})

describe('customCategories service', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('crypto', createCryptoStub())
  })

  it('returns empty list and clears invalid storage', () => {
    localStorage.setItem('yearbird:custom-categories', '{not-json')
    expect(getCustomCategories()).toEqual([])
    expect(localStorage.getItem('yearbird:custom-categories')).toBeNull()
  })

  it('validates required fields', () => {
    expect(
      addCustomCategory({
        label: '   ',
        color: '#111111',
        keywords: ['trip'],
        matchMode: 'any',
      }).error
    ).toBe('Name is required.')

    expect(
      addCustomCategory({
        label: 'Work',
        color: '#111111',
        keywords: ['trip'],
        matchMode: 'any',
      }).error
    ).toBe('Name already exists as a default category.')

    expect(
      addCustomCategory({
        label: 'Trips',
        color: 'blue',
        keywords: ['trip'],
        matchMode: 'any',
      }).error
    ).toBe('Pick a valid color.')

    expect(
      addCustomCategory({
        label: 'Trips',
        color: '#111111',
        keywords: ['   '],
        matchMode: 'any',
      }).error
    ).toBe('Add at least one keyword.')
  })

  it('deduplicates keywords and prevents duplicate labels', () => {
    const first = addCustomCategory({
      label: 'Trips',
      color: '#111111',
      keywords: ['Flight', 'flight', 'hotel'],
      matchMode: 'any',
    }).category

    expect(first?.keywords).toEqual(['Flight', 'hotel'])

    const duplicate = addCustomCategory({
      label: ' trips ',
      color: '#111111',
      keywords: ['trip'],
      matchMode: 'any',
    })

    expect(duplicate.error).toBe('Name already exists.')
  })

  it('updates and removes categories', () => {
    const created = addCustomCategory({
      label: 'Trips',
      color: '#111111',
      keywords: ['trip'],
      matchMode: 'any',
    }).category

    if (!created) {
      throw new Error('Expected custom category')
    }

    const updated = updateCustomCategory(created.id, {
      label: 'Big Trips',
      color: '#222222',
      keywords: ['trip', 'family'],
      matchMode: 'all',
    })

    expect(updated.category?.label).toBe('Big Trips')
    expect(updated.category?.matchMode).toBe('all')

    removeCustomCategory(created.id)
    expect(getCustomCategories()).toHaveLength(0)
  })

  it('returns error when updating missing category', () => {
    const result = updateCustomCategory('custom-missing', {
      label: 'Trips',
      color: '#111111',
      keywords: ['trip'],
      matchMode: 'any',
    })

    expect(result.error).toBe('Category no longer exists.')
  })

  it('reads versioned storage payloads', () => {
    localStorage.setItem(
      'yearbird:custom-categories',
      JSON.stringify({
        version: 1,
        categories: [
          {
            id: 'custom-1',
            label: 'Trips',
            color: '#111111',
            keywords: ['trip'],
            matchMode: 'any',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      })
    )

    const categories = getCustomCategories()
    expect(categories).toHaveLength(1)
    expect(categories[0]?.id).toBe('custom-1')
  })

  it('migrates legacy array storage to versioned payloads', () => {
    localStorage.setItem(
      'yearbird:custom-categories',
      JSON.stringify([
        {
          id: 'custom-1',
          label: 'Trips',
          color: '#111111',
          keywords: ['trip'],
          matchMode: 'any',
          createdAt: 1,
          updatedAt: 1,
        },
      ])
    )

    const categories = getCustomCategories()
    expect(categories).toHaveLength(1)
    const stored = JSON.parse(localStorage.getItem('yearbird:custom-categories') ?? '{}')
    expect(stored.version).toBe(1)
    expect(stored.categories).toHaveLength(1)
  })

  it('keeps most recent entry when labels collide in storage', () => {
    const older = {
      id: 'custom-old',
      label: 'Trips',
      color: '#111111',
      keywords: ['trip'],
      matchMode: 'any',
      createdAt: 1,
      updatedAt: 1,
    }
    const newer = {
      id: 'custom-new',
      label: 'Trips',
      color: '#222222',
      keywords: ['trip', 'family'],
      matchMode: 'any',
      createdAt: 1,
      updatedAt: 2,
    }

    localStorage.setItem('yearbird:custom-categories', JSON.stringify([older, newer]))
    const categories = getCustomCategories()

    expect(categories).toHaveLength(1)
    expect(categories[0]?.id).toBe('custom-new')
  })

  it('drops built-in labels from storage', () => {
    localStorage.setItem(
      'yearbird:custom-categories',
      JSON.stringify([
        {
          id: 'custom-1',
          label: 'Work',
          color: '#111111',
          keywords: ['trip'],
          matchMode: 'any',
          createdAt: 1,
          updatedAt: 1,
        },
      ])
    )

    expect(getCustomCategories()).toEqual([])
  })
})
