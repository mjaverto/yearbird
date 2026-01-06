/**
 * Manual OAuth Utility for TV Mode
 *
 * Implements Google OAuth 2.0 implicit flow for environments where
 * Google Identity Services (GIS) library cannot load (e.g., TV browsers).
 *
 * This uses redirect-based OAuth instead of popup-based GIS flow.
 *
 * SECURITY NOTE: The implicit flow returns tokens in URL fragments, which
 * are less secure than authorization code flow. Tokens may briefly appear
 * in browser history before being cleared. This is an acceptable tradeoff
 * for TV browsers where GIS cannot load, but authorization code flow with
 * PKCE would be preferable if server-side token exchange were available.
 *
 * @see https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const OAUTH_STATE_KEY = 'yearbird:oauthState'

export interface TokenData {
  accessToken: string
  expiresIn: number
}

export interface OAuthError {
  error: string
  errorDescription?: string
}

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
  } catch {
    // sessionStorage may be unavailable
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
  } catch {
    return null
  }
}

/**
 * Builds the Google OAuth authorization URL for implicit flow.
 *
 * Generates and stores a random state parameter for CSRF protection.
 * The state must be validated when extracting the token on callback.
 *
 * @param clientId - Google OAuth client ID
 * @param redirectUri - URI to redirect back to after authorization
 * @param scope - OAuth scope(s) to request
 * @returns The full authorization URL to redirect the user to
 */
export function buildOAuthRedirectUrl(
  clientId: string,
  redirectUri: string,
  scope: string,
): string {
  const state = generateState()
  storeOAuthState(state)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token', // Implicit flow - returns token in URL hash
    scope,
    state, // CSRF protection - must be validated on callback
    include_granted_scopes: 'true',
    // Prompt user to select account (useful if they have multiple Google accounts)
    prompt: 'select_account',
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

/**
 * Extracts the OAuth token from the URL hash fragment.
 *
 * After a successful OAuth redirect, Google returns the access token
 * in the URL hash like: #access_token=xxx&expires_in=3600&token_type=Bearer&state=xxx
 *
 * Validates the state parameter against the stored value to prevent CSRF attacks.
 * Returns null if state validation fails.
 *
 * @returns Token data if present and valid, null otherwise
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

  if (!accessToken || !expiresInRaw) {
    return null
  }

  // Validate state parameter to prevent CSRF attacks
  const storedState = consumeOAuthState()
  if (returnedState && storedState && returnedState !== storedState) {
    // State mismatch - possible CSRF attack, reject the token
    console.warn('OAuth state mismatch - possible CSRF attack')
    return null
  }

  const expiresIn = Number.parseInt(expiresInRaw, 10)
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    return null
  }

  return { accessToken, expiresIn }
}

/**
 * Extracts OAuth error information from the URL hash fragment.
 *
 * If the user denies access or an error occurs, Google returns
 * error information in the hash like: #error=access_denied&error_description=...
 *
 * @returns Error data if present, null otherwise
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
 * Clears the URL hash fragment without triggering a page reload.
 *
 * This should be called after extracting the token to clean up
 * the URL and prevent the token from being visible in the browser history.
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

/**
 * Checks if the current URL hash contains OAuth response data.
 *
 * @returns true if hash contains access_token or error parameters
 */
export function hasOAuthResponse(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const hash = window.location.hash.slice(1)
  if (!hash) {
    return false
  }

  const params = new URLSearchParams(hash)
  return params.has('access_token') || params.has('error')
}
