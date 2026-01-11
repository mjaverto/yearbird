import { clearEventCaches } from './cache'
import { exchangeCodeForToken, type TokenResponse } from './tokenExchange'
import { generateCodeVerifier, generateState } from '../utils/pkce'
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

// Timing constants
const POPUP_DETECTION_TIMEOUT_MS = 1000
const VERIFIER_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

/**
 * PKCE verifier storage with request ID correlation.
 * Using a Map prevents race conditions when multiple auth flows are initiated.
 * Each entry has an expiry time to prevent memory leaks from abandoned flows.
 */
interface VerifierEntry {
  verifier: string
  state: string
  expiresAt: number
}
const pendingVerifiers = new Map<string, VerifierEntry>()

// Track the current pending auth flow's state (for correlating callback)
let currentAuthState: string | null = null

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

// Re-export PKCE functions for backward compatibility
export { generateCodeVerifier } from '../utils/pkce'
export { generateCodeChallenge } from '../utils/pkce'

/**
 * Store a pending verifier with expiration.
 * @internal
 */
function storePendingVerifier(state: string, verifier: string): void {
  // Clean up expired entries
  const now = Date.now()
  for (const [key, entry] of pendingVerifiers.entries()) {
    if (now >= entry.expiresAt) {
      pendingVerifiers.delete(key)
    }
  }

  pendingVerifiers.set(state, {
    verifier,
    state,
    expiresAt: now + VERIFIER_EXPIRY_MS,
  })
}

/**
 * Retrieve and consume a pending verifier by state.
 * @internal
 */
function consumePendingVerifier(state: string): string | null {
  const entry = pendingVerifiers.get(state)
  if (!entry) {
    return null
  }

  pendingVerifiers.delete(state)

  // Check if expired
  if (Date.now() >= entry.expiresAt) {
    return null
  }

  return entry.verifier
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

  // Set flag BEFORE patching to prevent race condition where concurrent calls
  // could both pass the check and double-patch window.open
  hasPatchedOpen = true

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
}

/**
 * Safely checks if a popup window is closed, handling COOP restrictions.
 *
 * Google's OAuth popup sets `Cross-Origin-Opener-Policy: same-origin` which
 * prevents cross-origin access to window properties. When checking `.closed`
 * on such a popup, Chrome logs a warning and may return an unreliable value.
 *
 * This function wraps the check in a try-catch and falls back to assuming
 * the popup is NOT closed (conservative approach - better to try to focus
 * an existing popup than to open duplicates).
 *
 * @param popup - The popup window reference to check
 * @returns true if the popup is definitely closed, false if open or unknown
 */
const isPopupClosed = (popup: Window | null): boolean => {
  if (!popup) {
    return true
  }
  try {
    // This may trigger COOP warning in console, but we handle it gracefully
    return popup.closed
  } catch {
    // COOP policy blocked access - assume popup is still open
    // (conservative: better to focus existing than open duplicate)
    return false
  }
}

const getOpenPopup = () => {
  if (!signInPopup) {
    return null
  }
  if (isPopupClosed(signInPopup)) {
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
  currentAuthState = null
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
 * ## PKCE Limitation with GIS
 *
 * Google Identity Services (GIS) `initCodeClient` does not support passing
 * `code_challenge` and `code_challenge_method` parameters directly. For the
 * popup flow with `postmessage` redirect, GIS handles the OAuth flow internally.
 *
 * While we generate and send a `code_verifier` during token exchange, Google's
 * authorization server cannot verify it without the corresponding `code_challenge`.
 * This means PKCE validation is not enforced by Google for the popup flow.
 *
 * However, the popup flow still has security protections:
 * 1. **Origin verification**: GIS validates the requesting origin
 * 2. **postmessage channel**: Auth code is sent via postMessage to the opener
 * 3. **Short-lived codes**: Authorization codes expire quickly
 *
 * For the redirect flow (TV mode), PKCE is fully implemented and verified.
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
    callback: async (response: google.accounts.oauth2.CodeResponse) => {
      if (response.error) {
        log.error('Auth error:', response.error)
        currentAuthState = null
        errorHandler?.(response.error)
        return
      }

      // Validate state parameter for CSRF protection
      // Note: GIS popup flow may not return state in the response, so we
      // only validate if both are present. The popup flow has other security
      // measures (origin verification, postmessage channel).
      const returnedState = response.state
      if (returnedState && currentAuthState && returnedState !== currentAuthState) {
        log.error('Auth state mismatch - possible CSRF attack')
        currentAuthState = null
        errorHandler?.('state_mismatch')
        return
      }

      // Note: GIS popup flow does NOT support PKCE because initCodeClient
      // doesn't allow passing code_challenge to Google's authorization endpoint.
      // We still generate a verifier for state correlation, but we don't send it
      // to Google during token exchange (they would reject it with "invalid_grant").
      // The popup flow has other security protections (origin verification, postmessage).
      const stateForVerifier = returnedState ?? currentAuthState
      if (stateForVerifier) {
        // Clean up the stored verifier even though we don't use it
        consumePendingVerifier(stateForVerifier)
      }

      try {
        // Exchange code for token via Worker (no code_verifier for popup flow)
        const tokenResponse = await exchangeCodeForToken({
          code: response.code,
          // codeVerifier omitted - GIS popup flow doesn't support PKCE
          redirectUri: 'postmessage',
        })
        currentAuthState = null
        successHandler?.(tokenResponse)
      } catch (error) {
        log.error('Token exchange failed:', error)
        currentAuthState = null
        errorHandler?.('token_exchange_failed')
      }
    },
    error_callback: (error: google.accounts.oauth2.CodeError) => {
      log.error('Auth error callback:', error)
      currentAuthState = null
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
    }, POPUP_DETECTION_TIMEOUT_MS)
  }

  // Generate PKCE code verifier and state
  const codeVerifier = generateCodeVerifier()
  const state = generateState()

  // Store verifier correlated with state for later retrieval
  storePendingVerifier(state, codeVerifier)
  currentAuthState = state

  // Request authorization code
  // Note: GIS initCodeClient doesn't support code_challenge parameter directly.
  // The code_verifier will be sent during token exchange, but Google cannot
  // verify it without the challenge. See initializeAuth docs for details.
  codeClient.requestCode({
    hint: '', // Allow account selection
    state, // CSRF protection
  })

  return 'opened'
}

export function signOut() {
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  if (token && typeof google !== 'undefined' && google.accounts?.oauth2) {
    google.accounts.oauth2.revoke(token, () => {
      log.info('Token revoked')
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
  // Validate token data to prevent storing invalid/malicious tokens
  if (!token || typeof token !== 'string' || token.length < 10) {
    throw new Error('Invalid access token')
  }
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error('Invalid token expiration')
  }

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
    const state = generateState()

    // Store verifier for this request
    storePendingVerifier(state, verifier)

    const client = google.accounts.oauth2.initCodeClient({
      client_id: CLIENT_ID,
      scope: ALL_SCOPES,
      ux_mode: 'popup',
      redirect_uri: 'postmessage',
      callback: async (response: google.accounts.oauth2.CodeResponse) => {
        if (response.error) {
          log.error('Drive scope request failed:', response.error)
          resolve(false)
          return
        }

        // Validate state
        if (response.state !== state) {
          log.error('Drive scope request state mismatch')
          resolve(false)
          return
        }

        const codeVerifier = consumePendingVerifier(state)
        if (!codeVerifier) {
          log.error('No verifier for drive scope request')
          resolve(false)
          return
        }

        try {
          const tokenResponse = await exchangeCodeForToken({
            code: response.code,
            codeVerifier,
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
      error_callback: (error: google.accounts.oauth2.CodeError) => {
        log.error('Drive scope request error:', error)
        resolve(false)
      },
    })

    // Request with consent prompt to ensure the user sees the new scope
    ensureOpenPatched()
    client.requestCode({ prompt: 'consent', state })
  })
}

if (typeof window !== 'undefined') {
  ensureOpenPatched()
}
