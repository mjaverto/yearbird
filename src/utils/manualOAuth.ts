/**
 * Manual OAuth Utility for TV Mode
 *
 * Implements Google OAuth 2.0 authorization code flow with PKCE for environments
 * where Google Identity Services (GIS) library cannot load (e.g., TV browsers).
 *
 * This uses redirect-based OAuth instead of popup-based GIS flow.
 *
 * SECURITY: Uses authorization code flow with PKCE instead of the deprecated
 * implicit flow. Tokens are exchanged server-side via our Cloudflare Worker,
 * keeping the client_secret secure and avoiding tokens in URL fragments.
 *
 * @see https://developers.google.com/identity/protocols/oauth2/web-server
 * @see https://oauth.net/2/pkce/
 */

import { log } from './logger'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const OAUTH_STATE_KEY = 'yearbird:oauthState'
const CODE_VERIFIER_KEY = 'yearbird:codeVerifier'

export interface AuthCodeData {
  code: string
  state: string
}

export interface OAuthError {
  error: string
  errorDescription?: string
}

// ============================================================================
// PKCE Helpers (duplicated from auth.ts to avoid circular dependency)
// ============================================================================

/**
 * Base64URL encode (no padding, URL-safe characters)
 * @internal
 */
function base64URLEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Generate cryptographically random code_verifier (43-128 chars, URL-safe)
 * Using 32 bytes = 43 characters after base64url encoding
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64URLEncode(array)
}

/**
 * Generate code_challenge from verifier using SHA-256
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return base64URLEncode(new Uint8Array(hash))
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Generates a cryptographically random state parameter for CSRF protection.
 * Falls back to Math.random if crypto API unavailable.
 */
function generateState(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older browsers
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * Stores the OAuth state parameter in sessionStorage for validation on callback.
 */
function storeOAuthState(state: string): void {
  try {
    sessionStorage.setItem(OAUTH_STATE_KEY, state)
  } catch (error) {
    log.debug('Storage access error storing OAuth state:', error)
  }
}

/**
 * Retrieves and clears the stored OAuth state parameter.
 * Returns null if not found or storage unavailable.
 */
function consumeOAuthState(): string | null {
  try {
    const state = sessionStorage.getItem(OAUTH_STATE_KEY)
    sessionStorage.removeItem(OAUTH_STATE_KEY)
    return state
  } catch (error) {
    log.debug('Storage access error consuming OAuth state:', error)
    return null
  }
}

/**
 * Stores the PKCE code verifier in sessionStorage (survives redirect).
 */
function storeCodeVerifier(verifier: string): void {
  try {
    sessionStorage.setItem(CODE_VERIFIER_KEY, verifier)
  } catch (error) {
    log.debug('Storage access error storing code verifier:', error)
  }
}

/**
 * Retrieves and clears the stored PKCE code verifier.
 * Returns null if not found or storage unavailable.
 */
export function consumeCodeVerifier(): string | null {
  try {
    const verifier = sessionStorage.getItem(CODE_VERIFIER_KEY)
    sessionStorage.removeItem(CODE_VERIFIER_KEY)
    return verifier
  } catch (error) {
    log.debug('Storage access error consuming code verifier:', error)
    return null
  }
}

// ============================================================================
// OAuth URL Building
// ============================================================================

/**
 * Builds the Google OAuth authorization URL for authorization code flow with PKCE.
 *
 * Generates and stores:
 * - Random state parameter for CSRF protection
 * - PKCE code verifier (stored in sessionStorage to survive redirect)
 *
 * @param clientId - Google OAuth client ID
 * @param redirectUri - URI to redirect back to after authorization
 * @param scope - OAuth scope(s) to request
 * @returns The full authorization URL to redirect the user to
 */
export async function buildOAuthRedirectUrl(
  clientId: string,
  redirectUri: string,
  scope: string,
): Promise<string> {
  const state = generateState()
  storeOAuthState(state)

  // PKCE: Generate and store verifier before redirect
  const codeVerifier = generateCodeVerifier()
  storeCodeVerifier(codeVerifier)
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code', // Authorization code flow (not implicit)
    scope,
    state, // CSRF protection - must be validated on callback
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    include_granted_scopes: 'true',
    // Prompt user to select account (useful if they have multiple Google accounts)
    prompt: 'select_account',
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

/**
 * Extracts the authorization code from the URL query parameters.
 *
 * After a successful OAuth redirect, Google returns the authorization code
 * in the URL query string like: ?code=xxx&state=xxx
 *
 * Validates the state parameter against the stored value to prevent CSRF attacks.
 * Returns null if state validation fails.
 *
 * @returns Auth code data if present and valid, null otherwise
 */
export function extractCodeFromUrl(): AuthCodeData | null {
  if (typeof window === 'undefined') {
    return null
  }

  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const returnedState = params.get('state')

  if (!code) {
    return null
  }

  // Validate state parameter to prevent CSRF attacks
  const storedState = consumeOAuthState()
  if (returnedState && storedState && returnedState !== storedState) {
    // State mismatch - possible CSRF attack, reject the code
    log.warn('OAuth state mismatch - possible CSRF attack')
    return null
  }

  return { code, state: returnedState ?? '' }
}

/**
 * Extracts OAuth error information from the URL query parameters.
 *
 * If the user denies access or an error occurs, Google returns
 * error information in the query string like: ?error=access_denied&error_description=...
 *
 * @returns Error data if present, null otherwise
 */
export function extractErrorFromUrl(): OAuthError | null {
  if (typeof window === 'undefined') {
    return null
  }

  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')

  if (!error) {
    return null
  }

  return {
    error,
    errorDescription: params.get('error_description') ?? undefined,
  }
}

/**
 * Clears the URL query parameters without triggering a page reload.
 *
 * This should be called after extracting the code to clean up
 * the URL and prevent the code from being visible in the browser history.
 */
export function clearQueryFromUrl(): void {
  if (typeof window === 'undefined') {
    return
  }

  // Use replaceState to avoid adding to browser history
  window.history.replaceState(
    {},
    '',
    window.location.pathname + window.location.hash,
  )
}

/**
 * Checks if the current URL contains OAuth response data.
 *
 * @returns true if URL contains code or error parameters
 */
export function hasOAuthResponse(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const params = new URLSearchParams(window.location.search)
  return params.has('code') || params.has('error')
}

// ============================================================================
// Legacy Implicit Flow Support (deprecated, kept for backwards compatibility)
// ============================================================================

export interface TokenData {
  accessToken: string
  expiresIn: number
  scope?: string
}

/**
 * @deprecated Use extractCodeFromUrl() instead. Implicit flow is deprecated.
 * Extracts the OAuth token from the URL hash fragment.
 */
export function extractTokenFromHash(): TokenData | null {
  if (typeof window === 'undefined') {
    return null
  }

  const hash = window.location.hash.slice(1) // Remove leading #
  if (!hash) {
    return null
  }

  const params = new URLSearchParams(hash)
  const accessToken = params.get('access_token')
  const expiresInRaw = params.get('expires_in')
  const returnedState = params.get('state')
  const scope = params.get('scope')

  if (!accessToken || !expiresInRaw) {
    return null
  }

  // Validate state parameter to prevent CSRF attacks
  const storedState = consumeOAuthState()
  if (returnedState && storedState && returnedState !== storedState) {
    log.warn('OAuth state mismatch - possible CSRF attack')
    return null
  }

  const expiresIn = Number.parseInt(expiresInRaw, 10)
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    return null
  }

  return { accessToken, expiresIn, scope: scope ?? undefined }
}

/**
 * @deprecated Use extractErrorFromUrl() instead. Implicit flow is deprecated.
 * Extracts OAuth error information from the URL hash fragment.
 */
export function extractErrorFromHash(): OAuthError | null {
  if (typeof window === 'undefined') {
    return null
  }

  const hash = window.location.hash.slice(1)
  if (!hash) {
    return null
  }

  const params = new URLSearchParams(hash)
  const error = params.get('error')

  if (!error) {
    return null
  }

  return {
    error,
    errorDescription: params.get('error_description') ?? undefined,
  }
}

/**
 * @deprecated Use clearQueryFromUrl() instead.
 * Clears the URL hash fragment without triggering a page reload.
 */
export function clearHashFromUrl(): void {
  if (typeof window === 'undefined') {
    return
  }

  // Use replaceState to avoid adding to browser history
  window.history.replaceState(
    {},
    '',
    window.location.pathname + window.location.search,
  )
}
