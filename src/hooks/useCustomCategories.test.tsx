import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCustomCategories } from './useCustomCategories'

const createCryptoStub = () => {
  let counter = 0
  return {
    randomUUID: () => {
      counter += 1
      return `id-${counter}`
    },
  }
}

describe('useCustomCategories', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('crypto', createCryptoStub())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads custom categories from storage on mount', async () => {
    localStorage.setItem(
      'yearbird:custom-categories',
      JSON.stringify([
        {
          id: 'custom-1',
          label: 'Trips',
          color: '#111111',
          keywords: ['flight'],
          matchMode: 'any',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ])
    )

    const { result } = renderHook(() => useCustomCategories())

    await waitFor(() => expect(result.current.customCategories).toHaveLength(1))
    expect(result.current.customCategories[0]?.label).toBe('Trips')
  })

  it('adds, updates, and removes custom categories', async () => {
    const { result } = renderHook(() => useCustomCategories())

    act(() => {
      result.current.addCustomCategory({
        label: 'Trips',
        color: '#111111',
        keywords: ['flight', 'hotel'],
        matchMode: 'any',
      })
    })

    await waitFor(() => expect(result.current.customCategories).toHaveLength(1))
    const created = result.current.customCategories[0]
    expect(created?.id).toContain('custom-')

    act(() => {
      result.current.updateCustomCategory(created!.id, {
        label: 'Big Trips',
        color: '#111111',
        keywords: ['flight'],
        matchMode: 'all',
      })
    })

    await waitFor(() =>
      expect(result.current.customCategories[0]?.label).toBe('Big Trips')
    )

    act(() => {
      result.current.removeCustomCategory(created!.id)
    })

    await waitFor(() => expect(result.current.customCategories).toHaveLength(0))
  })

  it('keeps state stable when add or update fails validation', async () => {
    const { result } = renderHook(() => useCustomCategories())

    let addResult = null as ReturnType<typeof result.current.addCustomCategory> | null
    act(() => {
      addResult = result.current.addCustomCategory({
        label: '   ',
        color: '#111111',
        keywords: ['flight'],
        matchMode: 'any',
      })
    })

    expect(addResult?.category).toBeNull()
    expect(addResult?.error).toBeTruthy()
    expect(result.current.customCategories).toHaveLength(0)

    act(() => {
      result.current.addCustomCategory({
        label: 'Trips',
        color: '#111111',
        keywords: ['flight'],
        matchMode: 'any',
      })
    })

    await waitFor(() => expect(result.current.customCategories).toHaveLength(1))
    const created = result.current.customCategories[0]
    expect(created?.label).toBe('Trips')

    let updateResult = null as ReturnType<typeof result.current.updateCustomCategory> | null
    act(() => {
      updateResult = result.current.updateCustomCategory(created!.id, {
        label: '',
        color: '#111111',
        keywords: ['flight'],
        matchMode: 'any',
      })
    })

    expect(updateResult?.category).toBeNull()
    expect(updateResult?.error).toBeTruthy()
    expect(result.current.customCategories[0]?.label).toBe('Trips')
  })
})
