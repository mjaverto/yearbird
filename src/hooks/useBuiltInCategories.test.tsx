import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useBuiltInCategories } from './useBuiltInCategories'

const STORAGE_KEY = 'yearbird:disabled-built-in-categories'

describe('useBuiltInCategories', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loads disabled built-in categories from storage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['work']))

    const { result } = renderHook(() => useBuiltInCategories())

    expect(result.current.disabledBuiltInCategories).toEqual(['work'])
  })

  it('disables and re-enables categories', () => {
    const { result } = renderHook(() => useBuiltInCategories())

    act(() => {
      result.current.disableBuiltInCategory('work')
    })
    expect(result.current.disabledBuiltInCategories).toEqual(['work'])

    act(() => {
      result.current.enableBuiltInCategory('work')
    })
    expect(result.current.disabledBuiltInCategories).toEqual([])
  })
})
