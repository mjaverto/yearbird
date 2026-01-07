import { clearEventCaches } from './cache'

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
    console.warn('Missing VITE_GOOGLE_CLIENT_ID')
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
    console.warn('Google Identity Services not ready')
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
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (token && typeof google !== 'undefined' && google.accounts?.oauth2) {
    google.accounts.oauth2.revoke(token, () => {
      console.info('Token revoked')
    })
  }
  clearStoredAuth()
}

export function getStoredAuth(): { accessToken: string; expiresAt: number } | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
  const expiresAtRaw = localStorage.getItem(EXPIRES_AT_KEY)

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
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
  localStorage.setItem(EXPIRES_AT_KEY, expiresAt.toString())
  if (scopes) {
    localStorage.setItem(GRANTED_SCOPES_KEY, scopes)
  }
  return expiresAt
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(EXPIRES_AT_KEY)
    localStorage.removeItem(GRANTED_SCOPES_KEY)
  } catch {
    // Ignore storage access issues (private mode, quota, etc.)
  }

  clearEventCaches()
}

/**
 * Get the granted scopes from the last OAuth response.
 * Returns null if no scopes are stored.
 */
export function getGrantedScopes(): string | null {
  try {
    return localStorage.getItem(GRANTED_SCOPES_KEY)
  } catch {
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
      console.warn('Missing VITE_GOOGLE_CLIENT_ID')
      resolve(false)
      return
    }

    if (!isGoogleReady()) {
      console.warn('Google Identity Services not ready')
      resolve(false)
      return
    }

    // Create a new token client with both scopes
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: ALL_SCOPES,
      callback: (response) => {
        if (response.error) {
          console.error('Drive scope request failed:', response.error)
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
        console.error('Drive scope request error:', error)
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
