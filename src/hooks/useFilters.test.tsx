import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { YearbirdEvent } from '../types/calendar'
import { useFilters } from './useFilters'

const createCryptoStub = () => {
  let counter = 0
  return {
    randomUUID: () => {
      counter += 1
      return `id-${counter}`
    },
  }
}

const sampleEvents: YearbirdEvent[] = [
  {
    id: '1',
    title: 'Rent Payment',
    startDate: '2026-01-01',
    endDate: '2026-01-02',
    isAllDay: true,
    isMultiDay: true,
    durationDays: 2,
    googleLink: '',
    category: 'uncategorized',
    color: '#9CA3AF',
  },
  {
    id: '2',
    title: 'Team Retreat',
    startDate: '2026-01-10',
    endDate: '2026-01-12',
    isAllDay: true,
    isMultiDay: true,
    durationDays: 3,
    googleLink: '',
    category: 'uncategorized',
    color: '#9CA3AF',
  },
]

describe('useFilters', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('crypto', createCryptoStub())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads filters from storage on mount', async () => {
    localStorage.setItem(
      'yearbird:filters',
      JSON.stringify([
        {
          id: 'stored-1',
          pattern: 'rent',
          createdAt: Date.now(),
        },
      ])
    )

    const { result } = renderHook(() => useFilters())

    await waitFor(() => expect(result.current.filters).toHaveLength(1))
    expect(result.current.filters[0]?.id).toBe('stored-1')
  })

  it('adds filters and filters events', async () => {
    const { result } = renderHook(() => useFilters())

    act(() => {
      result.current.addFilter('rent')
    })

    await waitFor(() => expect(result.current.filters).toHaveLength(1))

    const filtered = result.current.filterEvents(sampleEvents)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.id).toBe('2')
  })

  it('returns original events when no filters exist', () => {
    const { result } = renderHook(() => useFilters())

    const filtered = result.current.filterEvents(sampleEvents)
    expect(filtered).toEqual(sampleEvents)
  })

  it('removes filters by id', async () => {
    const { result } = renderHook(() => useFilters())

    act(() => {
      result.current.addFilter('rent')
    })

    await waitFor(() => expect(result.current.filters).toHaveLength(1))

    act(() => {
      result.current.removeFilter(result.current.filters[0]?.id ?? '')
    })

    await waitFor(() => expect(result.current.filters).toHaveLength(0))
  })

  it('ignores empty filters', async () => {
    const { result } = renderHook(() => useFilters())

    act(() => {
      result.current.addFilter('   ')
    })

    await waitFor(() => expect(result.current.filters).toHaveLength(0))
  })

  it('deduplicates filters case-insensitively', async () => {
    const { result } = renderHook(() => useFilters())

    act(() => {
      result.current.addFilter('Rent')
      result.current.addFilter('rent')
    })

    await waitFor(() => expect(result.current.filters).toHaveLength(1))
  })
})
