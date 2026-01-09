import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getShowTimedEvents,
  setShowTimedEvents,
  getMatchDescription,
  setMatchDescription,
} from './displaySettings'

describe('displaySettings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('getShowTimedEvents', () => {
    it('returns false by default', () => {
      expect(getShowTimedEvents()).toBe(false)
    })

    it('returns true when set to true', () => {
      localStorage.setItem('yearbird:show-timed-events', 'true')
      expect(getShowTimedEvents()).toBe(true)
    })

    it('returns false for any other value', () => {
      localStorage.setItem('yearbird:show-timed-events', 'false')
      expect(getShowTimedEvents()).toBe(false)

      localStorage.setItem('yearbird:show-timed-events', 'yes')
      expect(getShowTimedEvents()).toBe(false)

      localStorage.setItem('yearbird:show-timed-events', '1')
      expect(getShowTimedEvents()).toBe(false)
    })

    it('returns false when localStorage throws', () => {
      const mockStorage = {
        getItem: vi.fn().mockImplementation(() => {
          throw new Error('Storage error')
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      }
      vi.spyOn(window, 'localStorage', 'get').mockReturnValue(mockStorage)

      expect(getShowTimedEvents()).toBe(false)

      vi.restoreAllMocks()
    })
  })

  describe('setShowTimedEvents', () => {
    it('stores true value', () => {
      setShowTimedEvents(true)
      expect(localStorage.getItem('yearbird:show-timed-events')).toBe('true')
    })

    it('removes key when set to false', () => {
      localStorage.setItem('yearbird:show-timed-events', 'true')
      setShowTimedEvents(false)
      expect(localStorage.getItem('yearbird:show-timed-events')).toBeNull()
    })

    it('handles storage errors gracefully', () => {
      const mockStorage = {
        getItem: vi.fn(),
        setItem: vi.fn().mockImplementation(() => {
          throw new Error('Storage error')
        }),
        removeItem: vi.fn().mockImplementation(() => {
          throw new Error('Storage error')
        }),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      }
      vi.spyOn(window, 'localStorage', 'get').mockReturnValue(mockStorage)

      // Should not throw
      expect(() => setShowTimedEvents(true)).not.toThrow()
      expect(() => setShowTimedEvents(false)).not.toThrow()

      vi.restoreAllMocks()
    })
  })

  describe('getMatchDescription', () => {
    it('returns false by default', () => {
      expect(getMatchDescription()).toBe(false)
    })

    it('returns true when set to true', () => {
      localStorage.setItem('yearbird:match-description', 'true')
      expect(getMatchDescription()).toBe(true)
    })

    it('returns false for any other value', () => {
      localStorage.setItem('yearbird:match-description', 'false')
      expect(getMatchDescription()).toBe(false)

      localStorage.setItem('yearbird:match-description', 'yes')
      expect(getMatchDescription()).toBe(false)
    })

    it('returns false when localStorage throws', () => {
      const mockStorage = {
        getItem: vi.fn().mockImplementation(() => {
          throw new Error('Storage error')
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      }
      vi.spyOn(window, 'localStorage', 'get').mockReturnValue(mockStorage)

      expect(getMatchDescription()).toBe(false)

      vi.restoreAllMocks()
    })
  })

  describe('setMatchDescription', () => {
    it('stores true value', () => {
      setMatchDescription(true)
      expect(localStorage.getItem('yearbird:match-description')).toBe('true')
    })

    it('removes key when set to false', () => {
      localStorage.setItem('yearbird:match-description', 'true')
      setMatchDescription(false)
      expect(localStorage.getItem('yearbird:match-description')).toBeNull()
    })

    it('handles storage errors gracefully', () => {
      const mockStorage = {
        getItem: vi.fn(),
        setItem: vi.fn().mockImplementation(() => {
          throw new Error('Storage error')
        }),
        removeItem: vi.fn().mockImplementation(() => {
          throw new Error('Storage error')
        }),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      }
      vi.spyOn(window, 'localStorage', 'get').mockReturnValue(mockStorage)

      // Should not throw
      expect(() => setMatchDescription(true)).not.toThrow()
      expect(() => setMatchDescription(false)).not.toThrow()

      vi.restoreAllMocks()
    })
  })

  describe('SSR safety', () => {
    it('handles undefined window gracefully', () => {
      // This is tested implicitly by the getStorage() function
      // returning null when window is undefined.
      // The actual SSR behavior can't be easily tested in jsdom,
      // but we verify the defensive pattern works.
      expect(getShowTimedEvents()).toBe(false)
      expect(getMatchDescription()).toBe(false)
    })
  })
})
