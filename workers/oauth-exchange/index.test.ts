/**
 * Unit tests for the OAuth Exchange Cloudflare Worker
 *
 * These tests mock the fetch API and test the worker's request handling logic
 * without requiring the full Cloudflare Workers runtime.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Import the worker module
// Note: We need to import after mocking fetch
const mockEnv = {
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  ALLOWED_ORIGINS: 'https://yearbird.app,http://localhost:5173',
}

// Helper to create mock Request
function createRequest(
  method: string,
  origin: string,
  body?: object
): Request {
  const headers = new Headers({
    Origin: origin,
    'Content-Type': 'application/json',
    'CF-Connecting-IP': '192.168.1.1',
  })

  return new Request('https://oauth-worker.example.com', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('OAuth Exchange Worker', () => {
  let worker: typeof import('./index').default
  let mockGoogleFetch: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()

    // Mock global fetch for Google token endpoint
    mockGoogleFetch = vi.fn()
    vi.stubGlobal('fetch', mockGoogleFetch)

    // Import the worker after mocking
    const module = await import('./index')
    worker = module.default
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('CORS preflight', () => {
    it('returns 200 for valid origin preflight', async () => {
      const request = createRequest('OPTIONS', 'https://yearbird.app')

      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://yearbird.app')
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
    })

    it('returns 403 for invalid origin preflight', async () => {
      const request = createRequest('OPTIONS', 'https://malicious.com')

      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(403)
    })

    it('allows localhost origin', async () => {
      const request = createRequest('OPTIONS', 'http://localhost:5173')

      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
    })
  })

  describe('method validation', () => {
    it('rejects GET requests', async () => {
      const request = createRequest('GET', 'https://yearbird.app')

      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(405)
    })

    it('rejects PUT requests', async () => {
      const request = createRequest('PUT', 'https://yearbird.app')

      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(405)
    })
  })

  describe('origin validation', () => {
    it('rejects requests from non-allowed origins', async () => {
      const request = createRequest('POST', 'https://malicious.com', {
        code: 'test-code',
        code_verifier: 'test-verifier',
        redirect_uri: 'https://yearbird.app/callback',
      })

      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(403)
    })

    it('accepts requests from allowed origins', async () => {
      mockGoogleFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'test-token',
            expires_in: 3600,
            scope: 'calendar.readonly',
            token_type: 'Bearer',
          }),
      })

      const request = createRequest('POST', 'https://yearbird.app', {
        code: 'test-code',
        code_verifier: 'test-verifier',
        redirect_uri: 'https://yearbird.app/callback',
      })

      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(200)
    })
  })

  describe('parameter validation', () => {
    it('returns 400 for missing code', async () => {
      const request = createRequest('POST', 'https://yearbird.app', {
        code_verifier: 'test-verifier',
        redirect_uri: 'https://yearbird.app/callback',
      })

      const response = await worker.fetch(request, mockEnv)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({ error: 'missing_parameters' })
    })

    it('accepts request without code_verifier (GIS popup flow)', async () => {
      // GIS popup flow doesn't support PKCE, so code_verifier is optional
      // Mock successful Google response
      mockGoogleFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'test-access-token',
            expires_in: 3600,
            scope: 'calendar.readonly',
            token_type: 'Bearer',
          }),
      })

      const request = createRequest('POST', 'https://yearbird.app', {
        code: 'test-code',
        redirect_uri: 'postmessage',
      })

      const response = await worker.fetch(request, mockEnv)
      expect(response.status).toBe(200)
    })

    it('returns 400 for missing redirect_uri', async () => {
      const request = createRequest('POST', 'https://yearbird.app', {
        code: 'test-code',
        code_verifier: 'test-verifier',
      })

      const response = await worker.fetch(request, mockEnv)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({ error: 'missing_parameters' })
    })
  })

  describe('redirect_uri validation', () => {
    it('accepts postmessage redirect_uri', async () => {
      mockGoogleFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'test-token',
            expires_in: 3600,
            scope: 'calendar.readonly',
            token_type: 'Bearer',
          }),
      })

      const request = createRequest('POST', 'https://yearbird.app', {
        code: 'test-code',
        code_verifier: 'test-verifier',
        redirect_uri: 'postmessage',
      })

      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(200)
    })

    it('accepts redirect_uri matching allowed origin', async () => {
      mockGoogleFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'test-token',
            expires_in: 3600,
            scope: 'calendar.readonly',
            token_type: 'Bearer',
          }),
      })

      const request = createRequest('POST', 'https://yearbird.app', {
        code: 'test-code',
        code_verifier: 'test-verifier',
        redirect_uri: 'https://yearbird.app/oauth/callback',
      })

      const response = await worker.fetch(request, mockEnv)

      expect(response.status).toBe(200)
    })

    it('rejects redirect_uri not matching allowed origin', async () => {
      const request = createRequest('POST', 'https://yearbird.app', {
        code: 'test-code',
        code_verifier: 'test-verifier',
        redirect_uri: 'https://malicious.com/steal-token',
      })

      const response = await worker.fetch(request, mockEnv)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({ error: 'invalid_redirect_uri' })
    })

    it('rejects redirect_uri with path traversal attempt', async () => {
      const request = createRequest('POST', 'https://yearbird.app', {
        code: 'test-code',
        code_verifier: 'test-verifier',
        redirect_uri: 'https://yearbird.app.malicious.com/callback',
      })

      const response = await worker.fetch(request, mockEnv)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({ error: 'invalid_redirect_uri' })
    })

    it('rejects invalid URL as redirect_uri', async () => {
      const request = createRequest('POST', 'https://yearbird.app', {
        code: 'test-code',
        code_verifier: 'test-verifier',
        redirect_uri: 'not-a-valid-url',
      })

      const response = await worker.fetch(request, mockEnv)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({ error: 'invalid_redirect_uri' })
    })
  })

  describe('token exchange', () => {
    it('exchanges code for token successfully', async () => {
      const mockTokenResponse = {
        access_token: 'ya29.test-access-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        token_type: 'Bearer',
        refresh_token: 'should-not-be-returned',
      }

      mockGoogleFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      })

      const request = createRequest('POST', 'https://yearbird.app', {
        code: 'test-auth-code',
        code_verifier: 'test-verifier-12345',
        redirect_uri: 'postmessage',
      })

      const response = await worker.fetch(request, mockEnv)
      const body = await response.json()

      expect(response.status).toBe(200)
      // Should NOT include refresh_token
      expect(body).toEqual({
        access_token: 'ya29.test-access-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        token_type: 'Bearer',
      })
      expect(body.refresh_token).toBeUndefined()
    })

    it('sends correct parameters to Google', async () => {
      mockGoogleFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'test-token',
            expires_in: 3600,
            scope: 'calendar.readonly',
            token_type: 'Bearer',
          }),
      })

      const request = createRequest('POST', 'https://yearbird.app', {
        code: 'test-auth-code',
        code_verifier: 'test-verifier',
        redirect_uri: 'postmessage',
      })

      await worker.fetch(request, mockEnv)

      expect(mockGoogleFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      )

      // Check the body parameters
      const call = mockGoogleFetch.mock.calls[0]
      const bodyParams = new URLSearchParams(call[1].body)
      expect(bodyParams.get('client_id')).toBe('test-client-id')
      expect(bodyParams.get('client_secret')).toBe('test-client-secret')
      expect(bodyParams.get('code')).toBe('test-auth-code')
      expect(bodyParams.get('code_verifier')).toBe('test-verifier')
      expect(bodyParams.get('redirect_uri')).toBe('postmessage')
      expect(bodyParams.get('grant_type')).toBe('authorization_code')
    })

    it('returns 400 when Google returns an error', async () => {
      mockGoogleFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'invalid_grant' }),
      })

      const request = createRequest('POST', 'https://yearbird.app', {
        code: 'expired-code',
        code_verifier: 'test-verifier',
        redirect_uri: 'postmessage',
      })

      const response = await worker.fetch(request, mockEnv)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({ error: 'token_exchange_failed' })
    })
  })

  describe('rate limiting', () => {
    it('allows requests under rate limit', async () => {
      // Reset module to clear rate limit state from previous tests
      vi.resetModules()
      const freshModule = await import('./index')
      const freshWorker = freshModule.default

      mockGoogleFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'test-token',
            expires_in: 3600,
            scope: 'calendar.readonly',
            token_type: 'Bearer',
          }),
      })
      vi.stubGlobal('fetch', mockGoogleFetch)

      // Helper to create fresh request each time (body can only be consumed once)
      const createFreshRequest = () => {
        const headers = new Headers({
          Origin: 'https://yearbird.app',
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '10.0.0.1', // Different IP
        })
        return new Request('https://oauth-worker.example.com', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            code: 'test-code',
            code_verifier: 'test-verifier',
            redirect_uri: 'postmessage',
          }),
        })
      }

      // Make 10 requests, all should succeed
      for (let i = 0; i < 10; i++) {
        const response = await freshWorker.fetch(createFreshRequest(), mockEnv)
        expect(response.status).toBe(200)
      }
    })

    it('blocks requests exceeding rate limit', async () => {
      // Reset module to clear rate limit state from previous tests
      vi.resetModules()
      const freshModule = await import('./index')
      const freshWorker = freshModule.default

      mockGoogleFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'test-token',
            expires_in: 3600,
            scope: 'calendar.readonly',
            token_type: 'Bearer',
          }),
      })
      vi.stubGlobal('fetch', mockGoogleFetch)

      // Helper to create fresh request each time (body can only be consumed once)
      const createFreshRequest = () => {
        const headers = new Headers({
          Origin: 'https://yearbird.app',
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '10.0.0.2', // Different IP from other rate limit test
        })
        return new Request('https://oauth-worker.example.com', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            code: 'test-code',
            code_verifier: 'test-verifier',
            redirect_uri: 'postmessage',
          }),
        })
      }

      // Make 35 requests (limit is 30)
      let rateLimitedCount = 0
      for (let i = 0; i < 35; i++) {
        const response = await freshWorker.fetch(createFreshRequest(), mockEnv)
        if (response.status === 429) {
          rateLimitedCount++
          const body = await response.json()
          expect(body).toEqual({ error: 'rate_limited' })
        }
      }

      // At least some requests should be rate limited (requests 31-35)
      expect(rateLimitedCount).toBeGreaterThan(0)
    })
  })

  describe('error handling', () => {
    it('returns 400 for invalid JSON body', async () => {
      const headers = new Headers({
        Origin: 'https://yearbird.app',
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.168.1.1',
      })

      const request = new Request('https://oauth-worker.example.com', {
        method: 'POST',
        headers,
        body: 'not valid json',
      })

      const response = await worker.fetch(request, mockEnv)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({ error: 'invalid_request' })
    })

    it('includes CORS headers on error responses', async () => {
      const request = createRequest('POST', 'https://yearbird.app', {
        code: 'test-code',
        // Missing code_verifier and redirect_uri
      })

      const response = await worker.fetch(request, mockEnv)

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://yearbird.app')
    })
  })

  describe('KV rate limiting', () => {
    it('uses KV for rate limiting when available', async () => {
      vi.resetModules()
      const freshModule = await import('./index')
      const freshWorker = freshModule.default

      const mockKvGet = vi.fn().mockResolvedValue('5') // 5 previous requests
      const mockKvPut = vi.fn().mockResolvedValue(undefined)
      const mockKv = {
        get: mockKvGet,
        put: mockKvPut,
      }

      mockGoogleFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'test-token',
            expires_in: 3600,
            scope: 'calendar.readonly',
            token_type: 'Bearer',
          }),
      })
      vi.stubGlobal('fetch', mockGoogleFetch)

      const envWithKv = {
        ...mockEnv,
        RATE_LIMIT: mockKv as unknown as KVNamespace,
      }

      const headers = new Headers({
        Origin: 'https://yearbird.app',
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.168.1.100',
      })

      const request = new Request('https://oauth-worker.example.com', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          code: 'test-code',
          code_verifier: 'test-verifier',
          redirect_uri: 'postmessage',
        }),
      })

      const response = await freshWorker.fetch(request, envWithKv)

      expect(response.status).toBe(200)
      expect(mockKvGet).toHaveBeenCalledWith('rate:192.168.1.100')
      expect(mockKvPut).toHaveBeenCalledWith('rate:192.168.1.100', '6', { expirationTtl: 60 })
    })

    it('blocks requests when KV count exceeds limit', async () => {
      vi.resetModules()
      const freshModule = await import('./index')
      const freshWorker = freshModule.default

      const mockKvGet = vi.fn().mockResolvedValue('30') // At limit
      const mockKvPut = vi.fn().mockResolvedValue(undefined)
      const mockKv = {
        get: mockKvGet,
        put: mockKvPut,
      }

      const envWithKv = {
        ...mockEnv,
        RATE_LIMIT: mockKv as unknown as KVNamespace,
      }

      const headers = new Headers({
        Origin: 'https://yearbird.app',
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.168.1.101',
      })

      const request = new Request('https://oauth-worker.example.com', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          code: 'test-code',
          code_verifier: 'test-verifier',
          redirect_uri: 'postmessage',
        }),
      })

      const response = await freshWorker.fetch(request, envWithKv)
      const body = await response.json()

      expect(response.status).toBe(429)
      expect(body).toEqual({ error: 'rate_limited' })
    })

    it('fails open on KV errors', async () => {
      vi.resetModules()
      const freshModule = await import('./index')
      const freshWorker = freshModule.default

      const mockKvGet = vi.fn().mockRejectedValue(new Error('KV unavailable'))
      const mockKv = {
        get: mockKvGet,
        put: vi.fn(),
      }

      mockGoogleFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'test-token',
            expires_in: 3600,
            scope: 'calendar.readonly',
            token_type: 'Bearer',
          }),
      })
      vi.stubGlobal('fetch', mockGoogleFetch)

      const envWithKv = {
        ...mockEnv,
        RATE_LIMIT: mockKv as unknown as KVNamespace,
      }

      const headers = new Headers({
        Origin: 'https://yearbird.app',
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.168.1.102',
      })

      const request = new Request('https://oauth-worker.example.com', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          code: 'test-code',
          code_verifier: 'test-verifier',
          redirect_uri: 'postmessage',
        }),
      })

      // Should succeed even with KV error (fail open)
      const response = await freshWorker.fetch(request, envWithKv)

      expect(response.status).toBe(200)
    })
  })
})
