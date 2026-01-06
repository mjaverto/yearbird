import { beforeEach, describe, expect, it } from 'vitest'
import {
  disableBuiltInCategory,
  enableBuiltInCategory,
  getDisabledBuiltInCategories,
} from './builtInCategories'

const STORAGE_KEY = 'yearbird:disabled-built-in-categories'

describe('builtInCategories service', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty list and clears invalid storage', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')
    expect(getDisabledBuiltInCategories()).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('drops unknown values and deduplicates entries', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['work', 'unknown', 'work']))
    expect(getDisabledBuiltInCategories()).toEqual(['work'])
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(['work']))
  })

  it('disables and re-enables built-in categories', () => {
    expect(disableBuiltInCategory('work')).toEqual(['work'])
    expect(getDisabledBuiltInCategories()).toEqual(['work'])
    expect(enableBuiltInCategory('work')).toEqual([])
    expect(getDisabledBuiltInCategories()).toEqual([])
  })
})
