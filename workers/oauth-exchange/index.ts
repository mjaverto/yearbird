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

const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
})

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

    try {
      const body = (await request.json()) as TokenRequest
      const { code, code_verifier, redirect_uri } = body

      if (!code || !code_verifier || !redirect_uri) {
        return Response.json(
          { error: 'missing_parameters' },
          { status: 400, headers: corsHeaders(origin) },
        )
      }

      // SECURITY: Validate redirect_uri against allowlist
      // 'postmessage' is a special value for GIS popup flow
      const isValidRedirectUri =
        redirect_uri === 'postmessage' ||
        allowedOrigins.some((o) => redirect_uri.startsWith(o))

      if (!isValidRedirectUri) {
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
        // Don't leak detailed Google errors to client
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
      console.error('Token exchange error:', error)
      return Response.json(
        { error: 'invalid_request' },
        { status: 400, headers: corsHeaders(origin) },
      )
    }
  },
}
