import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFilter, clearFilters, getFilters, isEventFiltered, removeFilter } from './filters'

const createCryptoStub = () => {
  let counter = 0
  return {
    randomUUID: () => {
      counter += 1
      return `id-${counter}`
    },
  }
}

describe('filters service', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('crypto', createCryptoStub())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns empty list when nothing stored', () => {
    expect(getFilters()).toEqual([])
  })

  it('adds filters and trims the pattern', () => {
    const filter = addFilter('  Rent Payment  ')

    expect(filter?.pattern).toBe('Rent Payment')
    expect(filter?.id).toBe('id-1')

    const stored = getFilters()
    expect(stored).toHaveLength(1)
    expect(stored[0]?.pattern).toBe('Rent Payment')
  })

  it('removes filters by id', () => {
    const first = addFilter('Rent')
    const second = addFilter('Sync')

    if (!first || !second) {
      throw new Error('Expected filters to be created')
    }

    removeFilter(first.id)

    const remaining = getFilters()
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.id).toBe(second.id)
  })

  it('clears filters', () => {
    addFilter('Rent')
    addFilter('Sync')

    clearFilters()

    expect(getFilters()).toEqual([])
  })

  it('returns false when no filter matches', () => {
    const filter = addFilter('rent')
    const filters = filter ? [filter] : []

    expect(isEventFiltered('Weekly sync', filters)).toBe(false)
  })

  it('matches filters case-insensitively', () => {
    const filter = addFilter('rent')
    const filters = filter ? [filter] : []

    expect(isEventFiltered('Check Rent Payment', filters)).toBe(true)
  })

  it('ignores empty patterns', () => {
    const filter = addFilter('   ')

    expect(filter).toBeNull()
    expect(getFilters()).toEqual([])
  })

  it('deduplicates filters case-insensitively', () => {
    const first = addFilter('Rent')
    const second = addFilter('rent')

    expect(first?.id).toBe('id-1')
    expect(second?.id).toBe('id-1')
    expect(getFilters()).toHaveLength(1)
  })

  it('drops empty patterns from stored data', () => {
    localStorage.setItem(
      'yearbird:filters',
      JSON.stringify([
        { id: '1', pattern: '  ', createdAt: Date.now() },
        { id: '2', pattern: 'rent', createdAt: Date.now() },
      ])
    )

    const filters = getFilters()
    expect(filters).toHaveLength(1)
    expect(filters[0]?.pattern).toBe('rent')
  })

  it('ignores empty patterns during matching', () => {
    const filters = [{ id: '1', pattern: '   ', createdAt: Date.now() }]

    expect(isEventFiltered('Rent Payment', filters)).toBe(false)
  })

  it('drops invalid stored data', () => {
    localStorage.setItem('yearbird:filters', '{not-json')

    expect(getFilters()).toEqual([])
    expect(localStorage.getItem('yearbird:filters')).toBeNull()
  })
})
