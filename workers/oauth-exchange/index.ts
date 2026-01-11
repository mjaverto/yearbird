/**
 * Cloudflare Worker for OAuth Token Exchange
 *
 * Handles the authorization code → access token exchange for Google OAuth.
 * This worker keeps the client_secret secure on the server side while
 * allowing the frontend to use the authorization code flow with PKCE.
 *
 * The worker is stateless - it only handles the OAuth handshake.
 * User calendar data never touches this server.
 */

interface Env {
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  ALLOWED_ORIGINS: string // comma-separated, e.g., "https://yearbird.app,http://localhost:5173"
  RATE_LIMIT?: KVNamespace // Optional for backwards compatibility during migration
}

interface TokenRequest {
  code: string
  code_verifier: string
  redirect_uri: string
}

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  refresh_token?: string
  error?: string
  error_description?: string
}

// Rate limiting constants
const RATE_LIMIT_WINDOW_SECONDS = 60 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30 // max requests per IP per minute

// Fallback in-memory rate limiting (used when KV is not configured)
const requestCounts = new Map<string, { count: number; resetAt: number }>()

/**
 * Check if an IP is rate limited using KV storage.
 * Falls back to in-memory Map if KV is not configured.
 */
async function isRateLimited(ip: string, kv?: KVNamespace): Promise<boolean> {
  // Use KV if available for persistent rate limiting
  if (kv) {
    return isRateLimitedKV(ip, kv)
  }

  // Fallback to in-memory (resets on Worker restart)
  return isRateLimitedInMemory(ip)
}

/**
 * Rate limiting using Cloudflare KV.
 * KV provides persistence across Worker restarts and edge locations.
 */
async function isRateLimitedKV(ip: string, kv: KVNamespace): Promise<boolean> {
  const key = `rate:${ip}`

  try {
    const stored = await kv.get(key)
    let count = 1

    if (stored) {
      count = parseInt(stored, 10) + 1
    }

    if (count > RATE_LIMIT_MAX_REQUESTS) {
      return true
    }

    // Store with TTL equal to the rate limit window
    await kv.put(key, count.toString(), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS })
    return false
  } catch (error) {
    // On KV error, fail open (allow the request) but log
    console.error('KV rate limit error:', error)
    return false
  }
}

/**
 * Fallback in-memory rate limiting.
 * Note: This resets on Worker restart - use KV for production.
 */
function isRateLimitedInMemory(ip: string): boolean {
  const now = Date.now()
  const entry = requestCounts.get(ip)

  if (!entry || now >= entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000 })
    return false
  }

  entry.count++
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return true
  }

  return false
}

// Clean up old in-memory entries periodically (simple garbage collection)
function cleanupRateLimitEntries(): void {
  const now = Date.now()
  for (const [ip, entry] of requestCounts.entries()) {
    if (now >= entry.resetAt) {
      requestCounts.delete(ip)
    }
  }

  // Prevent memory growth from too many entries
  if (requestCounts.size > 10000) {
    requestCounts.clear()
  }
}

const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
})

/**
 * Validates redirect_uri using proper URL parsing to prevent bypass attacks.
 * Only allows exact origin matches or the special 'postmessage' value for GIS popup flow.
 */
function isValidRedirectUri(redirectUri: string, allowedOrigins: string[]): boolean {
  // Special value for GIS popup flow
  if (redirectUri === 'postmessage') {
    return true
  }

  try {
    const redirectUrl = new URL(redirectUri)
    return allowedOrigins.some((origin) => {
      try {
        const allowedUrl = new URL(origin)
        // Compare full origins (protocol + host + port)
        return redirectUrl.origin === allowedUrl.origin
      } catch {
        return false
      }
    })
  } catch {
    // Invalid URL
    return false
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? ''
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())

    // CORS preflight
    if (request.method === 'OPTIONS') {
      if (!allowedOrigins.includes(origin)) {
        return new Response('Forbidden', { status: 403 })
      }
      return new Response(null, {
        headers: {
          ...corsHeaders(origin),
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    // Validate origin
    if (!allowedOrigins.includes(origin)) {
      return new Response('Forbidden', { status: 403 })
    }

    // Rate limiting (uses KV if available, falls back to in-memory)
    const clientIP = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    if (await isRateLimited(clientIP, env.RATE_LIMIT)) {
      return Response.json(
        { error: 'rate_limited' },
        { status: 429, headers: corsHeaders(origin) },
      )
    }

    // Periodic cleanup of in-memory rate limit entries (only needed without KV)
    if (!env.RATE_LIMIT && Math.random() < 0.1) {
      cleanupRateLimitEntries()
    }

    try {
      const body = (await request.json()) as TokenRequest
      const { code, code_verifier, redirect_uri } = body

      if (!code || !code_verifier || !redirect_uri) {
        return Response.json(
          { error: 'missing_parameters' },
          { status: 400, headers: corsHeaders(origin) },
        )
      }

      // SECURITY: Validate redirect_uri against allowlist using proper URL parsing
      if (!isValidRedirectUri(redirect_uri, allowedOrigins)) {
        return Response.json(
          { error: 'invalid_redirect_uri' },
          { status: 400, headers: corsHeaders(origin) },
        )
      }

      // Exchange code for token with Google
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          code,
          code_verifier,
          redirect_uri,
          grant_type: 'authorization_code',
        }),
      })

      const tokenData = (await tokenResponse.json()) as GoogleTokenResponse

      if (!tokenResponse.ok || tokenData.error) {
        // Log error details for debugging (will be visible in wrangler tail)
        console.error('Token exchange failed:', tokenData.error, tokenData.error_description)
        return Response.json(
          { error: 'token_exchange_failed' },
          { status: 400, headers: corsHeaders(origin) },
        )
      }

      // Only return what the client needs (exclude refresh_token if present)
      return Response.json(
        {
          access_token: tokenData.access_token,
          expires_in: tokenData.expires_in,
          scope: tokenData.scope,
          token_type: tokenData.token_type,
        },
        { headers: corsHeaders(origin) },
      )
    } catch (error) {
      // Don't log error details that might contain sensitive data
      console.error('Token exchange error occurred')
      return Response.json(
        { error: 'invalid_request' },
        { status: 400, headers: corsHeaders(origin) },
      )
    }
  },
}
