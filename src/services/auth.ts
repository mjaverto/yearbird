import { clearEventCaches } from './cache'
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

let tokenClient: google.accounts.oauth2.TokenClient | null = null
let successHandler: ((response: google.accounts.oauth2.TokenResponse) => void) | null = null
let signInPopup: Window | null = null
let hasPatchedOpen = false
let isAuthPopupPending = false
let pendingPopupResetTimeout: number | null = null

type SignInStatus = 'opened' | 'focused' | 'unavailable'

const isGoogleReady = () => typeof google !== 'undefined' && Boolean(google.accounts?.oauth2)
const POPUP_URL_HINT = 'accounts.google.com'

/**
 * Monkey-patches `window.open` to capture references to Google OAuth popups.
 *
 * ## Why This Exists
 *
 * Google Identity Services (GIS) creates OAuth consent popups internally via
 * `tokenClient.requestAccessToken()`. The GIS library does not expose any API
 * to obtain a reference to this popup window. Without that reference, we cannot:
 *
 * 1. **Detect if the popup is still open** - Users may click "Sign In" multiple
 *    times, and we need to focus the existing popup rather than spawn duplicates.
 * 2. **Focus an existing popup** - When the user clicks sign-in again while a
 *    popup is already open, we want to bring it to the front for better UX.
 * 3. **Track popup lifecycle** - Know when the popup closes (user completed or
 *    cancelled auth) to update UI state accordingly.
 *
 * ## What This Does
 *
 * This function intercepts all `window.open()` calls by replacing it with a
 * wrapper function. The wrapper:
 *
 * 1. Calls the original `window.open()` with all original arguments
 * 2. Checks if this call is likely a Google OAuth popup by either:
 *    - The `isAuthPopupPending` flag being set (we just called `requestAccessToken`)
 *    - The URL containing 'accounts.google.com'
 * 3. If it's an OAuth popup, stores the window reference in `signInPopup`
 * 4. Returns the popup reference (preserving original behavior)
 *
 * The patch is applied once and guarded by `hasPatchedOpen` to prevent
 * double-patching.
 *
 * ## Risks and Fragility
 *
 * **This is a fragile hack.** It works today but could break due to:
 *
 * - **GIS library changes**: If Google changes how/when they call `window.open`,
 *   our detection logic may miss the popup or capture the wrong window.
 * - **Browser security updates**: Future browser versions might restrict or
 *   change `window.open` behavior in ways that break our patch.
 * - **Third-party conflicts**: Other libraries that also patch `window.open`
 *   could interfere (order of patching matters).
 * - **URL pattern changes**: If Google changes their OAuth URLs to not include
 *   'accounts.google.com', the URL-based detection will fail.
 * - **Popup blockers**: Some popup blockers might wrap `window.open` themselves,
 *   potentially breaking the chain.
 *
 * ## Alternatives Considered
 *
 * 1. **GIS Callback-only approach**: Just use GIS callbacks without popup
 *    tracking. Downside: Poor UX when users spam the sign-in button (multiple
 *    popups spawn).
 *
 * 2. **Custom OAuth flow**: Implement our own OAuth popup/redirect flow instead
 *    of using GIS. Downside: More code, more security surface, lose GIS's
 *    built-in handling of edge cases.
 *
 * 3. **Redirect flow instead of popup**: Use `ux_mode: 'redirect'` in GIS.
 *    Downside: Worse UX (full page navigation), more complex state management
 *    across page loads.
 *
 * 4. **Debounce sign-in button**: Just disable the button for N seconds after
 *    click. Downside: Doesn't help if popup is hidden behind other windows;
 *    arbitrary timeout is bad UX.
 *
 * The monkey-patch approach was chosen as the least-bad option that provides
 * good UX with minimal code complexity. If it breaks in the future, falling
 * back to approach #1 (no popup tracking) is acceptable - users might see
 * duplicate popups occasionally, but auth will still work.
 *
 * @internal
 * @see signIn - Sets `isAuthPopupPending` before calling `requestAccessToken`
 * @see getOpenPopup - Checks if the captured popup is still open
 * @see hasOpenSignInPopup - Public API to check popup status
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
  if (pendingPopupResetTimeout !== null) {
    window.clearTimeout(pendingPopupResetTimeout)
    pendingPopupResetTimeout = null
  }
}

export function hasClientId() {
  return Boolean(CLIENT_ID)
}

export function initializeAuth(onSuccess: (response: google.accounts.oauth2.TokenResponse) => void) {
  successHandler = onSuccess
  if (tokenClient) {
    return true
  }
  if (!CLIENT_ID) {
    log.warn('Missing VITE_GOOGLE_CLIENT_ID')
    return false
  }
  if (!isGoogleReady()) {
    return false
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: ALL_SCOPES, // Request calendar + drive.appdata upfront for Cloud Sync
    callback: onSuccess,
  })
  return true
}

export function signIn() {
  if (!tokenClient && successHandler) {
    initializeAuth(successHandler)
  }
  if (!tokenClient) {
    log.warn('Google Identity Services not ready')
    return 'unavailable' satisfies SignInStatus
  }

  const existingPopup = getOpenPopup()
  if (existingPopup) {
    existingPopup.focus()
    return 'focused' satisfies SignInStatus
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
  tokenClient.requestAccessToken()
  return 'opened' satisfies SignInStatus
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
export function requestDriveScope(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!CLIENT_ID) {
      log.warn('Missing VITE_GOOGLE_CLIENT_ID')
      resolve(false)
      return
    }

    if (!isGoogleReady()) {
      log.warn('Google Identity Services not ready')
      resolve(false)
      return
    }

    // Create a new token client with both scopes
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: ALL_SCOPES,
      callback: (response) => {
        if (response.error) {
          log.error('Drive scope request failed:', response.error)
          resolve(false)
          return
        }

        // Store the new token with updated scopes
        storeAuth(response.access_token, response.expires_in, response.scope)

        // Notify the main auth handler if set
        if (successHandler) {
          successHandler(response)
        }

        // Check if Drive scope was actually granted
        const granted = response.scope.includes(DRIVE_APPDATA_SCOPE)
        resolve(granted)
      },
      error_callback: (error) => {
        log.error('Drive scope request error:', error)
        resolve(false)
      },
    })

    // Request with consent prompt to ensure the user sees the new scope
    ensureOpenPatched()
    client.requestAccessToken({ prompt: 'consent' })
  })
}

if (typeof window !== 'undefined') {
  ensureOpenPatched()
}
