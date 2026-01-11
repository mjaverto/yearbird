import { clearEventCaches } from './cache'
import { exchangeCodeForToken, type TokenResponse } from './tokenExchange'
import { log } from '../utils/logger'

/** Google OAuth client ID from environment */
export const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

/** OAuth scope for read-only calendar access */
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

/** OAuth scope for app-private Google Drive storage */
export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'

/** Combined scopes for calendar + cloud sync */
export const ALL_SCOPES = `${CALENDAR_SCOPE} ${DRIVE_APPDATA_SCOPE}`

/** @deprecated Use CALENDAR_SCOPE instead */
export const SCOPES = CALENDAR_SCOPE

/**
 * Token storage keys.
 *
 * We use sessionStorage instead of localStorage for OAuth tokens because:
 * 1. **XSS mitigation**: sessionStorage is cleared when the tab closes, limiting
 *    the exposure window if an attacker injects malicious JavaScript.
 * 2. **Session isolation**: Each tab gets its own token, preventing cross-tab
 *    interference and making the security model simpler.
 * 3. **Automatic cleanup**: No stale tokens left behind after browser restart.
 *
 * Trade-off: Users must re-authenticate when opening a new tab. This is acceptable
 * for a calendar viewer where re-auth is quick (Google often has active session).
 */
const ACCESS_TOKEN_KEY = 'yearbird:accessToken'
const EXPIRES_AT_KEY = 'yearbird:expiresAt'
const GRANTED_SCOPES_KEY = 'yearbird:grantedScopes'

// PKCE code verifier is stored in memory for popup flow (no redirect)
let currentCodeVerifier: string | null = null

let codeClient: google.accounts.oauth2.CodeClient | null = null
let successHandler: ((response: TokenResponse) => void) | null = null
let errorHandler: ((error: string) => void) | null = null
let signInPopup: Window | null = null
let hasPatchedOpen = false
let isAuthPopupPending = false
let pendingPopupResetTimeout: number | null = null

type SignInStatus = 'opened' | 'focused' | 'unavailable'

const isGoogleReady = () => typeof google !== 'undefined' && Boolean(google.accounts?.oauth2)
const POPUP_URL_HINT = 'accounts.google.com'

// ============================================================================
// PKCE Helpers
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
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64URLEncode(array)
}

/**
 * Generate code_challenge from verifier using SHA-256
 * This is sent to Google; the verifier is sent to our Worker
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return base64URLEncode(new Uint8Array(hash))
}

// ============================================================================
// Popup Tracking
// ============================================================================

/**
 * Monkey-patches `window.open` to capture references to Google OAuth popups.
 *
 * ## Why This Exists
 *
 * Google Identity Services (GIS) creates OAuth consent popups internally via
 * `codeClient.requestCode()`. The GIS library does not expose any API
 * to obtain a reference to this popup window. Without that reference, we cannot:
 *
 * 1. **Detect if the popup is still open** - Users may click "Sign In" multiple
 *    times, and we need to focus the existing popup rather than spawn duplicates.
 * 2. **Focus an existing popup** - When the user clicks sign-in again while a
 *    popup is already open, we want to bring it to the front for better UX.
 * 3. **Track popup lifecycle** - Know when the popup closes (user completed or
 *    cancelled auth) to update UI state accordingly.
 *
 * @internal
 */
const ensureOpenPatched = () => {
  if (hasPatchedOpen || typeof window === 'undefined' || typeof window.open !== 'function') {
    return
  }

  const originalOpen = window.open
  window.open = (...args) => {
    const popup = originalOpen.apply(window, args as Parameters<typeof window.open>)
    const url = args[0]
    const urlString = typeof url === 'string' ? url : url?.toString()
    if (isAuthPopupPending || urlString?.includes(POPUP_URL_HINT)) {
      signInPopup = popup
      isAuthPopupPending = false
      if (pendingPopupResetTimeout !== null) {
        window.clearTimeout(pendingPopupResetTimeout)
        pendingPopupResetTimeout = null
      }
    }
    return popup
  }
  hasPatchedOpen = true
}

const getOpenPopup = () => {
  if (!signInPopup) {
    return null
  }
  if (signInPopup.closed) {
    signInPopup = null
    return null
  }
  return signInPopup
}

export function hasOpenSignInPopup() {
  return Boolean(getOpenPopup())
}

export function clearSignInPopup() {
  signInPopup = null
  isAuthPopupPending = false
  currentCodeVerifier = null
  if (pendingPopupResetTimeout !== null) {
    window.clearTimeout(pendingPopupResetTimeout)
    pendingPopupResetTimeout = null
  }
}

export function hasClientId() {
  return Boolean(CLIENT_ID)
}

// ============================================================================
// Auth Initialization
// ============================================================================

/**
 * Initialize the Google OAuth code client for authorization code flow with PKCE.
 *
 * @param onSuccess - Callback when token exchange succeeds
 * @param onError - Callback when auth fails
 * @returns true if initialization succeeded
 */
export function initializeAuth(
  onSuccess: (response: TokenResponse) => void,
  onError?: (error: string) => void,
) {
  successHandler = onSuccess
  errorHandler = onError ?? null

  if (codeClient) {
    return true
  }
  if (!CLIENT_ID) {
    log.warn('Missing VITE_GOOGLE_CLIENT_ID')
    return false
  }
  if (!isGoogleReady()) {
    return false
  }

  codeClient = google.accounts.oauth2.initCodeClient({
    client_id: CLIENT_ID,
    scope: ALL_SCOPES,
    ux_mode: 'popup',
    redirect_uri: 'postmessage', // Required for popup mode
    callback: async (response) => {
      if (response.error) {
        log.error('Auth error:', response.error)
        currentCodeVerifier = null
        errorHandler?.(response.error)
        return
      }

      if (!currentCodeVerifier) {
        log.error('No code verifier available')
        errorHandler?.('no_code_verifier')
        return
      }

      try {
        // Exchange code for token via Worker
        const tokenResponse = await exchangeCodeForToken({
          code: response.code,
          codeVerifier: currentCodeVerifier,
          redirectUri: 'postmessage',
        })
        currentCodeVerifier = null
        successHandler?.(tokenResponse)
      } catch (error) {
        log.error('Token exchange failed:', error)
        currentCodeVerifier = null
        errorHandler?.('token_exchange_failed')
      }
    },
    error_callback: (error) => {
      log.error('Auth error callback:', error)
      currentCodeVerifier = null
      errorHandler?.(error.type)
    },
  })

  return true
}

// ============================================================================
// Sign In / Sign Out
// ============================================================================

/**
 * Initiate sign-in flow using authorization code with PKCE.
 */
export async function signIn(): Promise<SignInStatus> {
  if (!codeClient && successHandler) {
    initializeAuth(successHandler, errorHandler ?? undefined)
  }
  if (!codeClient) {
    log.warn('Google Identity Services not ready')
    return 'unavailable'
  }

  const existingPopup = getOpenPopup()
  if (existingPopup) {
    existingPopup.focus()
    return 'focused'
  }

  ensureOpenPatched()
  if (typeof window !== 'undefined') {
    isAuthPopupPending = true
    if (pendingPopupResetTimeout !== null) {
      window.clearTimeout(pendingPopupResetTimeout)
    }
    pendingPopupResetTimeout = window.setTimeout(() => {
      isAuthPopupPending = false
      pendingPopupResetTimeout = null
    }, 1000)
  }

  // Generate PKCE code verifier for the token exchange
  // Note: For GIS popup flow with 'postmessage' redirect_uri, we don't need to send
  // code_challenge upfront. The code_verifier is sent during token exchange via our Worker.
  currentCodeVerifier = generateCodeVerifier()

  // Request authorization code
  codeClient.requestCode({
    hint: '', // Allow account selection
    state: crypto.randomUUID(), // CSRF protection
  })

  return 'opened'
}

export function signOut() {
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  if (token && typeof google !== 'undefined' && google.accounts?.oauth2) {
    google.accounts.oauth2.revoke(token, () => {
      console.info('Token revoked')
    })
  }
  clearStoredAuth()
}

// ============================================================================
// Token Storage
// ============================================================================

export function getStoredAuth(): { accessToken: string; expiresAt: number } | null {
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  const expiresAtRaw = sessionStorage.getItem(EXPIRES_AT_KEY)

  if (!accessToken || !expiresAtRaw) {
    return null
  }

  const expiresAt = Number.parseInt(expiresAtRaw, 10)
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
    clearStoredAuth()
    return null
  }

  return { accessToken, expiresAt }
}

export function storeAuth(token: string, expiresIn: number, scopes?: string) {
  const expiresAt = Date.now() + expiresIn * 1000
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
  sessionStorage.setItem(EXPIRES_AT_KEY, expiresAt.toString())
  if (scopes) {
    sessionStorage.setItem(GRANTED_SCOPES_KEY, scopes)
  }
  return expiresAt
}

export function clearStoredAuth() {
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(EXPIRES_AT_KEY)
    sessionStorage.removeItem(GRANTED_SCOPES_KEY)
  } catch (error) {
    log.debug('Storage access error clearing auth:', error)
  }

  clearEventCaches()
}

/**
 * Get the granted scopes from the last OAuth response.
 * Returns null if no scopes are stored.
 */
export function getGrantedScopes(): string | null {
  try {
    return sessionStorage.getItem(GRANTED_SCOPES_KEY)
  } catch (error) {
    log.debug('Storage access error reading scopes:', error)
    return null
  }
}

/**
 * Check if the user has granted the Drive appdata scope.
 */
export function hasDriveScope(): boolean {
  const scopes = getGrantedScopes()
  if (!scopes) {
    return false
  }
  return scopes.includes(DRIVE_APPDATA_SCOPE)
}

/**
 * Request additional Drive scope for cloud sync.
 * This will show a consent popup to the user.
 * Returns a promise that resolves to true if consent was granted.
 */
export async function requestDriveScope(): Promise<boolean> {
  if (!CLIENT_ID) {
    log.warn('Missing VITE_GOOGLE_CLIENT_ID')
    return false
  }

  if (!isGoogleReady()) {
    log.warn('Google Identity Services not ready')
    return false
  }

  return new Promise((resolve) => {
    const verifier = generateCodeVerifier()

    const client = google.accounts.oauth2.initCodeClient({
      client_id: CLIENT_ID,
      scope: ALL_SCOPES,
      ux_mode: 'popup',
      redirect_uri: 'postmessage',
      callback: async (response) => {
        if (response.error) {
          log.error('Drive scope request failed:', response.error)
          resolve(false)
          return
        }

        try {
          const tokenResponse = await exchangeCodeForToken({
            code: response.code,
            codeVerifier: verifier,
            redirectUri: 'postmessage',
          })

          // Store the new token with updated scopes
          storeAuth(tokenResponse.access_token, tokenResponse.expires_in, tokenResponse.scope)

          // Notify the main auth handler if set
          if (successHandler) {
            successHandler(tokenResponse)
          }

          // Check if Drive scope was actually granted
          const granted = tokenResponse.scope.includes(DRIVE_APPDATA_SCOPE)
          resolve(granted)
        } catch (error) {
          log.error('Token exchange failed during Drive scope request:', error)
          resolve(false)
        }
      },
      error_callback: (error) => {
        log.error('Drive scope request error:', error)
        resolve(false)
      },
    })

    // Request with consent prompt to ensure the user sees the new scope
    ensureOpenPatched()

    // Generate challenge for PKCE (used in token exchange)
    generateCodeChallenge(verifier).then(() => {
      client.requestCode({ prompt: 'consent' })
    })
  })
}

if (typeof window !== 'undefined') {
  ensureOpenPatched()
}
