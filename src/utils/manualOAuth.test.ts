import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  buildOAuthRedirectUrl,
  clearHashFromUrl,
  extractErrorFromHash,
  extractTokenFromHash,
  hasOAuthResponse,
} from './manualOAuth'

describe('manualOAuth', () => {
  describe('buildOAuthRedirectUrl', () => {
    it('builds correct OAuth URL with all parameters', () => {
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
