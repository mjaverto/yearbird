/**
 * Manual OAuth Utility for TV Mode
 *
 * Implements Google OAuth 2.0 implicit flow for environments where
 * Google Identity Services (GIS) library cannot load (e.g., TV browsers).
 *
 * This uses redirect-based OAuth instead of popup-based GIS flow.
 *
 * @see https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

export interface TokenData {
  accessToken: string
  expiresIn: number
}

export interface OAuthError {
  error: string
  errorDescription?: string
}

/**
 * Builds the Google OAuth authorization URL for implicit flow.
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
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token', // Implicit flow - returns token in URL hash
    scope,
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
 * in the URL hash like: #access_token=xxx&expires_in=3600&token_type=Bearer
 *
 * @returns Token data if present, null otherwise
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

  if (!accessToken || !expiresInRaw) {
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
