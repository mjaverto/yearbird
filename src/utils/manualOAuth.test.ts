import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  buildOAuthRedirectUrl,
  clearHashFromUrl,
  extractErrorFromHash,
  extractTokenFromHash,
  hasOAuthResponse,
} from './manualOAuth'

describe('manualOAuth', () => {
  // Mock sessionStorage for state parameter tests
  const mockSessionStorage: Record<string, string> = {}

  beforeEach(() => {
    // Clear mock storage
    for (const key of Object.keys(mockSessionStorage)) {
      delete mockSessionStorage[key]
    }

    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => mockSessionStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockSessionStorage[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete mockSessionStorage[key]
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('buildOAuthRedirectUrl', () => {
    it('builds correct OAuth URL with all parameters including state', () => {
      const url = buildOAuthRedirectUrl(
        'test-client-id',
        'https://example.com/callback',
        'https://www.googleapis.com/auth/calendar.readonly',
      )

      const parsed = new URL(url)
      expect(parsed.origin).toBe('https://accounts.google.com')
      expect(parsed.pathname).toBe('/o/oauth2/v2/auth')
      expect(parsed.searchParams.get('client_id')).toBe('test-client-id')
      expect(parsed.searchParams.get('redirect_uri')).toBe('https://example.com/callback')
      expect(parsed.searchParams.get('response_type')).toBe('token')
      expect(parsed.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar.readonly')
      expect(parsed.searchParams.get('include_granted_scopes')).toBe('true')
      expect(parsed.searchParams.get('prompt')).toBe('select_account')
      // State parameter should be present for CSRF protection
      expect(parsed.searchParams.get('state')).toBeTruthy()
    })

    it('stores state parameter in sessionStorage', () => {
      const url = buildOAuthRedirectUrl(
        'test-client-id',
        'https://example.com/callback',
        'scope',
      )

      const parsed = new URL(url)
      const state = parsed.searchParams.get('state')
      expect(mockSessionStorage['yearbird:oauthState']).toBe(state)
    })

    it('generates unique state for each call', () => {
      const url1 = buildOAuthRedirectUrl('id', 'uri', 'scope')
      const url2 = buildOAuthRedirectUrl('id', 'uri', 'scope')

      const state1 = new URL(url1).searchParams.get('state')
      const state2 = new URL(url2).searchParams.get('state')
      expect(state1).not.toBe(state2)
    })

    it('encodes special characters in parameters', () => {
      const url = buildOAuthRedirectUrl(
        'client&id=test',
        'https://example.com/call back',
        'scope with spaces',
      )

      const parsed = new URL(url)
      expect(parsed.searchParams.get('client_id')).toBe('client&id=test')
      expect(parsed.searchParams.get('redirect_uri')).toBe('https://example.com/call back')
      expect(parsed.searchParams.get('scope')).toBe('scope with spaces')
    })
  })

  describe('extractTokenFromHash', () => {
    const originalWindow = globalThis.window

    beforeEach(() => {
      // Create a mock window with location
      globalThis.window = {
        location: {
          hash: '',
          pathname: '/',
          search: '',
        },
        history: {
          replaceState: vi.fn(),
        },
      } as unknown as Window & typeof globalThis
    })

    afterEach(() => {
      globalThis.window = originalWindow
    })

    it('returns null when hash is empty', () => {
      window.location.hash = ''
      expect(extractTokenFromHash()).toBeNull()
    })

    it('returns null when hash has no access_token', () => {
      window.location.hash = '#expires_in=3600&token_type=Bearer'
      expect(extractTokenFromHash()).toBeNull()
    })

    it('returns null when hash has no expires_in', () => {
      window.location.hash = '#access_token=test-token&token_type=Bearer'
      expect(extractTokenFromHash()).toBeNull()
    })

    it('extracts token data from valid hash', () => {
      window.location.hash = '#access_token=test-token-123&expires_in=3600&token_type=Bearer'
      const result = extractTokenFromHash()
      expect(result).toEqual({
        accessToken: 'test-token-123',
        expiresIn: 3600,
      })
    })

    it('handles URL-encoded tokens', () => {
      window.location.hash = '#access_token=ya29.test%2Btoken&expires_in=3599'
      const result = extractTokenFromHash()
      expect(result?.accessToken).toBe('ya29.test+token')
    })

    it('returns null for non-numeric expires_in', () => {
      window.location.hash = '#access_token=test-token&expires_in=invalid'
      expect(extractTokenFromHash()).toBeNull()
    })

    it('returns null for zero or negative expires_in', () => {
      window.location.hash = '#access_token=test-token&expires_in=0'
      expect(extractTokenFromHash()).toBeNull()

      window.location.hash = '#access_token=test-token&expires_in=-100'
      expect(extractTokenFromHash()).toBeNull()
    })

    it('returns null when window is undefined', () => {
      globalThis.window = undefined as unknown as Window & typeof globalThis
      expect(extractTokenFromHash()).toBeNull()
    })

    it('accepts token when state matches stored state', () => {
      mockSessionStorage['yearbird:oauthState'] = 'test-state-123'
      window.location.hash = '#access_token=test-token&expires_in=3600&state=test-state-123'
      const result = extractTokenFromHash()
      expect(result).toEqual({
        accessToken: 'test-token',
        expiresIn: 3600,
      })
      // State should be consumed (removed from storage)
      expect(mockSessionStorage['yearbird:oauthState']).toBeUndefined()
    })

    it('rejects token when state does not match', () => {
      mockSessionStorage['yearbird:oauthState'] = 'expected-state'
      window.location.hash = '#access_token=test-token&expires_in=3600&state=wrong-state'
      const result = extractTokenFromHash()
      expect(result).toBeNull()
    })

    it('accepts token when no state in hash but stored state exists (legacy flow)', () => {
      mockSessionStorage['yearbird:oauthState'] = 'stored-state'
      window.location.hash = '#access_token=test-token&expires_in=3600'
      const result = extractTokenFromHash()
      // Token accepted - state validation only fails on mismatch, not missing
      expect(result).toEqual({
        accessToken: 'test-token',
        expiresIn: 3600,
      })
    })

    it('accepts token when state in hash but no stored state (cross-tab scenario)', () => {
      // No stored state (cleared or different tab)
      window.location.hash = '#access_token=test-token&expires_in=3600&state=some-state'
      const result = extractTokenFromHash()
      // Token accepted - we can't validate without stored state
      expect(result).toEqual({
        accessToken: 'test-token',
        expiresIn: 3600,
      })
    })
  })

  describe('extractErrorFromHash', () => {
    const originalWindow = globalThis.window

    beforeEach(() => {
      globalThis.window = {
        location: {
          hash: '',
          pathname: '/',
          search: '',
        },
        history: {
          replaceState: vi.fn(),
        },
      } as unknown as Window & typeof globalThis
    })

    afterEach(() => {
      globalThis.window = originalWindow
    })

    it('returns null when hash is empty', () => {
      window.location.hash = ''
      expect(extractErrorFromHash()).toBeNull()
    })

    it('returns null when no error in hash', () => {
      window.location.hash = '#access_token=test&expires_in=3600'
      expect(extractErrorFromHash()).toBeNull()
    })

    it('extracts error without description', () => {
      window.location.hash = '#error=access_denied'
      const result = extractErrorFromHash()
      expect(result).toEqual({
        error: 'access_denied',
        errorDescription: undefined,
      })
    })

    it('extracts error with description', () => {
      window.location.hash = '#error=access_denied&error_description=User%20denied%20access'
      const result = extractErrorFromHash()
      expect(result).toEqual({
        error: 'access_denied',
        errorDescription: 'User denied access',
      })
    })

    it('returns null when window is undefined', () => {
      globalThis.window = undefined as unknown as Window & typeof globalThis
      expect(extractErrorFromHash()).toBeNull()
    })
  })

  describe('clearHashFromUrl', () => {
    const originalWindow = globalThis.window

    beforeEach(() => {
      globalThis.window = {
        location: {
          hash: '#access_token=test',
          pathname: '/app',
          search: '?foo=bar',
        },
        history: {
          replaceState: vi.fn(),
        },
      } as unknown as Window & typeof globalThis
    })

    afterEach(() => {
      globalThis.window = originalWindow
    })

    it('calls replaceState with path and search (no hash)', () => {
      clearHashFromUrl()
      expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/app?foo=bar')
    })

    it('handles empty search', () => {
      window.location.search = ''
      clearHashFromUrl()
      expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/app')
    })

    it('does not throw when window is undefined', () => {
      globalThis.window = undefined as unknown as Window & typeof globalThis
      expect(() => clearHashFromUrl()).not.toThrow()
    })
  })

  describe('hasOAuthResponse', () => {
    const originalWindow = globalThis.window

    beforeEach(() => {
      globalThis.window = {
        location: {
          hash: '',
          pathname: '/',
          search: '',
        },
      } as unknown as Window & typeof globalThis
    })

    afterEach(() => {
      globalThis.window = originalWindow
    })

    it('returns false when hash is empty', () => {
      window.location.hash = ''
      expect(hasOAuthResponse()).toBe(false)
    })

    it('returns true when hash has access_token', () => {
      window.location.hash = '#access_token=test'
      expect(hasOAuthResponse()).toBe(true)
    })

    it('returns true when hash has error', () => {
      window.location.hash = '#error=access_denied'
      expect(hasOAuthResponse()).toBe(true)
    })

    it('returns false for non-OAuth hash', () => {
      window.location.hash = '#section-1'
      expect(hasOAuthResponse()).toBe(false)
    })

    it('returns false when window is undefined', () => {
      globalThis.window = undefined as unknown as Window & typeof globalThis
      expect(hasOAuthResponse()).toBe(false)
    })
  })
})
