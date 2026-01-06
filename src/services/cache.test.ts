import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllCaches,
  clearCachedEvents,
  clearEventCaches,
  getCachedEvents,
  getCacheTimestamp,
  setCachedEvents,
} from './cache'
import type { YearbirdEvent } from '../types/calendar'

describe('cache service', () => {
  const events: YearbirdEvent[] = [
    {
      id: '1',
      title: 'Trip',
      startDate: '2026-01-01',
      endDate: '2026-01-03',
      isAllDay: true,
      isMultiDay: true,
      durationDays: 2,
      googleLink: '',
      category: 'uncategorized',
      color: '#9CA3AF',
    },
  ]

  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns cached events within ttl', () => {
    setCachedEvents(2026, events)

    expect(getCachedEvents(2026)).toEqual(events)
    expect(getCacheTimestamp(2026)).toEqual(new Date('2026-01-01T00:00:00.000Z'))
  })

  it('expires cached events after ttl', () => {
    setCachedEvents(2026, events)

    vi.setSystemTime(new Date('2026-01-02T00:00:01.000Z'))

    expect(getCachedEvents(2026)).toBeNull()
    expect(localStorage.getItem('yearbird:events:2026')).toBeNull()
  })

  it('clears only yearbird caches', () => {
    setCachedEvents(2026, events)
    localStorage.setItem('other:key', '1')

    clearAllCaches()

    expect(localStorage.getItem('yearbird:events:2026')).toBeNull()
    expect(localStorage.getItem('other:key')).toBe('1')
  })

  it('clears only event caches', () => {
    setCachedEvents(2026, events)
    localStorage.setItem('yearbird:filters', JSON.stringify(['personal']))

    clearEventCaches()

    expect(localStorage.getItem('yearbird:events:2026')).toBeNull()
    expect(localStorage.getItem('yearbird:filters')).toBe(JSON.stringify(['personal']))
  })

  it('drops invalid cached payloads', () => {
    localStorage.setItem('yearbird:events:2026', '{not-json')

    expect(getCachedEvents(2026)).toBeNull()
    expect(localStorage.getItem('yearbird:events:2026')).toBeNull()
    expect(getCacheTimestamp(2026)).toBeNull()
  })

  it('cleans old caches when storage is full', () => {
    const originalSetItem = Storage.prototype.setItem
    const state = { thrown: false }
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key: string, value: string) {
      if (key === 'yearbird:events:2026' && !state.thrown) {
        state.thrown = true
        throw new Error('quota')
      }
      return originalSetItem.call(this, key, value)
    })

    localStorage.setItem(
      'yearbird:events:2020',
      JSON.stringify({ events: [], timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000 })
    )

    setCachedEvents(2026, events)

    expect(localStorage.getItem('yearbird:events:2020')).toBeNull()
    expect(localStorage.getItem('yearbird:events:2026')).not.toBeNull()
  })

  it('handles missing localStorage gracefully', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked')
      },
    })

    expect(getCachedEvents(2026)).toBeNull()
    expect(getCacheTimestamp(2026)).toBeNull()
    expect(() => setCachedEvents(2026, events)).not.toThrow()
    expect(() => clearCachedEvents(2026)).not.toThrow()
    expect(() => clearAllCaches()).not.toThrow()
    expect(() => clearEventCaches()).not.toThrow()

    if (original) {
      Object.defineProperty(window, 'localStorage', original)
    }
  })
})
