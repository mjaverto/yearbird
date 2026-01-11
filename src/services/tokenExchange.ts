/**
 * Token Exchange Service
 *
 * Handles the exchange of authorization codes for access tokens via
 * the Cloudflare Worker. This keeps the client_secret secure while
 * allowing the frontend to use the authorization code flow with PKCE.
 */

import { log } from '../utils/logger'

const WORKER_URL = import.meta.env.VITE_OAUTH_WORKER_URL as string | undefined

interface ExchangeParams {
  code: string
  codeVerifier: string
  redirectUri: string
}

export interface TokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
}

interface ErrorResponse {
  error: string
}

/**
 * Exchange an authorization code for an access token via the OAuth Worker.
 *
 * @param params - The exchange parameters
 * @param params.code - The authorization code from Google
 * @param params.codeVerifier - The PKCE code verifier
 * @param params.redirectUri - The redirect URI used in the auth request
 * @returns The token response from Google
 * @throws Error if the exchange fails
 */
export async function exchangeCodeForToken(params: ExchangeParams): Promise<TokenResponse> {
  if (!WORKER_URL) {
    throw new Error('VITE_OAUTH_WORKER_URL not configured')
  }

  log.debug('Exchanging auth code for token')

  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: params.code,
      code_verifier: params.codeVerifier,
      redirect_uri: params.redirectUri,
    }),
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ error: 'unknown' }))) as ErrorResponse
    log.error('Token exchange failed:', error.error)
    throw new Error(`Token exchange failed: ${error.error}`)
  }

  const data = (await response.json()) as TokenResponse
  log.debug('Token exchange successful')
  return data
}

/**
 * Check if the OAuth Worker URL is configured.
 */
export function hasWorkerUrl(): boolean {
  return Boolean(WORKER_URL)
}
