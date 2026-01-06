import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  clearTvModePreference,
  getTvModePreference,
  isTVBrowser,
  setTvModePreference,
} from './tvDetection'

describe('tvDetection', () => {
  describe('isTVBrowser', () => {
    const originalNavigator = globalThis.navigator

    afterEach(() => {
      // Restore original navigator
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        writable: true,
      })
    })

    const testCases = [
      // Android TV / Google TV
      { ua: 'Mozilla/5.0 (Linux; Android 10; BRAVIA 4K GB) AppleWebKit/537.36', expected: true, name: 'Sony Bravia TV' },
      { ua: 'Mozilla/5.0 (Linux; Android 9; SHIELD Android TV)', expected: true, name: 'Nvidia Shield TV' },
      { ua: 'Mozilla/5.0 (Linux; Android 7.1.2; AFT*) AppleWebKit/537.36', expected: true, name: 'Fire TV (AFT*)' },
      { ua: 'Mozilla/5.0 (Linux; Android 9; AFTA)', expected: true, name: 'Fire TV Stick (AFTA)' },
      { ua: 'Mozilla/5.0 (Linux; Android 9; AFTB)', expected: true, name: 'Fire TV Stick (AFTB)' },

      // Smart TV platforms
      { ua: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.5)', expected: true, name: 'Samsung Tizen TV' },
      { ua: 'Mozilla/5.0 (Web0S; Linux/SmartTV)', expected: true, name: 'LG webOS TV (Web0S)' },
      { ua: 'Mozilla/5.0 (webOS.TV-2021)', expected: true, name: 'LG webOS TV (webOS)' },
      { ua: 'Mozilla/5.0 (SmartTV/1.0)', expected: true, name: 'Generic SmartTV' },

      // TV browsers
      { ua: 'TVBro/1.0 (Android TV)', expected: true, name: 'TVBro browser' },
      { ua: 'Puffin TV/1.0', expected: true, name: 'Puffin TV browser' },

      // Gaming consoles
      { ua: 'Mozilla/5.0 (PlayStation 5)', expected: true, name: 'PlayStation 5' },
      { ua: 'Mozilla/5.0 (PlayStation 4)', expected: true, name: 'PlayStation 4' },
      { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox)', expected: true, name: 'Xbox browser' },
      { ua: 'Nintendo/1.0', expected: true, name: 'Nintendo' },

      // Streaming devices
      { ua: 'Roku/DVP-10.5 (10.5.0.4025)', expected: true, name: 'Roku' },
      { ua: 'Mozilla/5.0 (CrKey armv7l 1.5.1) AppleWebKit/537.36', expected: true, name: 'Chromecast' },

      // TV manufacturers
      { ua: 'Mozilla/5.0 (Vizio SmartCast)', expected: true, name: 'Vizio SmartCast' },
      { ua: 'Mozilla/5.0 (Hisense VIDAA)', expected: true, name: 'Hisense TV' },
      { ua: 'Mozilla/5.0 (Philips TV)', expected: true, name: 'Philips TV' },

      // Desktop browsers (should NOT match)
      { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', expected: false, name: 'Chrome Windows' },
      { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', expected: false, name: 'Chrome Mac' },
      { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36', expected: false, name: 'Chrome Linux' },

      // Mobile browsers (should NOT match)
      { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', expected: false, name: 'Safari iOS' },
      { ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36', expected: false, name: 'Chrome Android' },
    ]

    for (const { ua, expected, name } of testCases) {
      it(`returns ${expected} for ${name}`, () => {
        Object.defineProperty(globalThis, 'navigator', {
          value: { userAgent: ua },
          writable: true,
        })
        expect(isTVBrowser()).toBe(expected)
      })
    }

    it('returns false when navigator is undefined', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: undefined,
        writable: true,
      })
      expect(isTVBrowser()).toBe(false)
    })
  })

  describe('TV mode preference', () => {
    const mockStorage: Record<string, string> = {}

    beforeEach(() => {
      // Clear mock storage
      for (const key of Object.keys(mockStorage)) {
        delete mockStorage[key]
      }

      // Mock localStorage
      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key: string) => mockStorage[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          mockStorage[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key]
        }),
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    describe('getTvModePreference', () => {
      it('returns false when not set', () => {
        expect(getTvModePreference()).toBe(false)
      })

      it('returns true when set to "true"', () => {
        mockStorage['yearbird:tvMode'] = 'true'
        expect(getTvModePreference()).toBe(true)
      })

      it('returns false when set to any other value', () => {
        mockStorage['yearbird:tvMode'] = 'false'
        expect(getTvModePreference()).toBe(false)
      })

      it('returns false when localStorage throws', () => {
        vi.stubGlobal('localStorage', {
          getItem: vi.fn(() => {
            throw new Error('Storage access denied')
          }),
        })
        expect(getTvModePreference()).toBe(false)
      })
    })

    describe('setTvModePreference', () => {
      it('sets "true" in localStorage when enabled', () => {
        setTvModePreference(true)
        expect(mockStorage['yearbird:tvMode']).toBe('true')
      })

      it('removes from localStorage when disabled', () => {
        mockStorage['yearbird:tvMode'] = 'true'
        setTvModePreference(false)
        expect(mockStorage['yearbird:tvMode']).toBeUndefined()
      })

      it('does not throw when localStorage throws', () => {
        vi.stubGlobal('localStorage', {
          setItem: vi.fn(() => {
            throw new Error('Storage access denied')
          }),
          removeItem: vi.fn(() => {
            throw new Error('Storage access denied')
          }),
        })
        expect(() => setTvModePreference(true)).not.toThrow()
        expect(() => setTvModePreference(false)).not.toThrow()
      })
    })

    describe('clearTvModePreference', () => {
      it('removes the preference from localStorage', () => {
        mockStorage['yearbird:tvMode'] = 'true'
        clearTvModePreference()
        expect(mockStorage['yearbird:tvMode']).toBeUndefined()
      })
    })
  })
})
