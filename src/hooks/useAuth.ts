import { useCallback, useEffect, useState } from 'react'
import {
  clearSignInPopup,
  clearStoredAuth,
  getStoredAuth,
  hasOpenSignInPopup,
  hasClientId,
  initializeAuth,
  signIn,
  signOut,
  storeAuth,
  CLIENT_ID,
  SCOPES,
} from '../services/auth'
import type { AuthState } from '../types/auth'
import { isFixtureMode } from '../utils/env'
import {
  buildOAuthRedirectUrl,
  clearHashFromUrl,
  extractErrorFromHash,
  extractTokenFromHash,
} from '../utils/manualOAuth'
import {
  getTvModePreference,
  isTVBrowser,
  setTvModePreference,
} from '../utils/tvDetection'

const EMPTY_STATE: AuthState = {
  isAuthenticated: false,
  user: null,
  accessToken: null,
  expiresAt: null,
}

const MAX_INIT_ATTEMPTS = 25
const INIT_POLL_INTERVAL_MS = 200
const FIXTURE_ACCESS_TOKEN = 'fixture-token'
const FIXTURE_STATE: AuthState = {
  isAuthenticated: true,
  user: null,
  accessToken: FIXTURE_ACCESS_TOKEN,
  expiresAt: null,
}

interface InitialAuthResult {
  authState: AuthState
  isReady: boolean
  authNotice: string | null
  handledOAuthCallback: boolean
}

const getInitialAuthState = (fixtureMode: boolean): InitialAuthResult => {
  if (fixtureMode) {
    return {
      authState: FIXTURE_STATE,
      isReady: true,
      authNotice: null,
      handledOAuthCallback: false,
    }
  }

  // Check for OAuth error in URL hash (redirect flow callback)
  const oauthError = extractErrorFromHash()
  if (oauthError) {
    clearHashFromUrl()
    return {
      authState: EMPTY_STATE,
      isReady: true,
      authNotice:
        oauthError.error === 'access_denied'
          ? 'Sign-in cancelled. Try again when ready.'
          : `Sign-in failed: ${oauthError.errorDescription ?? oauthError.error}`,
      handledOAuthCallback: true,
    }
  }

  // Check for OAuth token in URL hash (redirect flow callback)
  const tokenData = extractTokenFromHash()
  if (tokenData) {
    const expiresAt = storeAuth(tokenData.accessToken, tokenData.expiresIn)
    clearHashFromUrl()
    return {
      authState: {
        isAuthenticated: true,
        user: null,
        accessToken: tokenData.accessToken,
        expiresAt,
      },
      isReady: true,
      authNotice: null,
      handledOAuthCallback: true,
    }
  }

  // Check for stored auth
  const stored = getStoredAuth()
  if (stored) {
    return {
      authState: {
        isAuthenticated: true,
        user: null,
        accessToken: stored.accessToken,
        expiresAt: stored.expiresAt,
      },
      isReady: false,
      authNotice: null,
      handledOAuthCallback: false,
    }
  }

  return {
    authState: EMPTY_STATE,
    isReady: false,
    authNotice: null,
    handledOAuthCallback: false,
  }
}

export function useAuth() {
  const fixtureMode = isFixtureMode()

  // Initialize all auth state from a single source to handle OAuth callbacks
  const [initialResult] = useState(() => getInitialAuthState(fixtureMode))
  const [authState, setAuthState] = useState<AuthState>(initialResult.authState)
  const [isReady, setIsReady] = useState(initialResult.isReady || fixtureMode)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [authNotice, setAuthNotice] = useState<string | null>(initialResult.authNotice)

  // TV Mode: Use redirect-based OAuth when GIS library fails to load
  const [useTvMode, setUseTvMode] = useState(() => getTvModePreference())

  // Track if GIS is unavailable (typed flag instead of string matching)
  const [isGisUnavailable, setIsGisUnavailable] = useState(false)

  useEffect(() => {
    if (fixtureMode) {
      return
    }

    const handleTokenResponse = (response: google.accounts.oauth2.TokenResponse) => {
      if (response.error) {
        clearStoredAuth()
        clearSignInPopup()
        setAuthState(EMPTY_STATE)
        setIsSigningIn(false)
        setAuthNotice('Sign-in failed. Try again.')
        return
      }

      const expiresAt = storeAuth(response.access_token, response.expires_in)
      clearSignInPopup()
      setAuthState({
        isAuthenticated: true,
        user: null,
        accessToken: response.access_token,
        expiresAt,
      })
      setIsSigningIn(false)
      setAuthNotice(null)
    }

    let intervalId: number | undefined
    const tryInitialize = () => {
      if (!hasClientId()) {
        setAuthNotice('Missing Google client ID. Check .env.local.')
        return true
      }

      const ready = initializeAuth(handleTokenResponse)
      if (ready) {
        setIsReady(true)
        setAuthNotice(null)
      }
      return ready
    }

    const timeoutId = window.setTimeout(() => {
      if (tryInitialize()) {
        return
      }

      let attempts = 0
      intervalId = window.setInterval(() => {
        attempts += 1
        if (tryInitialize()) {
          if (intervalId) {
            window.clearInterval(intervalId)
          }
          return
        }

        if (attempts >= MAX_INIT_ATTEMPTS) {
          if (intervalId) {
            window.clearInterval(intervalId)
          }
          setIsGisUnavailable(true)
          setAuthNotice('Google sign-in unavailable. Refresh to try again.')
          // Auto-enable TV mode on TV browsers when GIS fails
          if (isTVBrowser()) {
            setUseTvMode(true)
            setTvModePreference(true)
          }
        }
      }, INIT_POLL_INTERVAL_MS)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      if (intervalId) {
        window.clearInterval(intervalId)
      }
    }
  }, [fixtureMode])

  useEffect(() => {
    if (fixtureMode) {
      return
    }

    if (!isSigningIn) {
      return
    }

    const intervalId = window.setInterval(() => {
      if (!hasOpenSignInPopup()) {
        setIsSigningIn(false)
      }
    }, 300)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [fixtureMode, isSigningIn])

  useEffect(() => {
    if (fixtureMode) {
      return
    }

    if (!authState.expiresAt) {
      return
    }
    const remainingMs = authState.expiresAt - Date.now()
    const timeoutId = window.setTimeout(() => {
      clearStoredAuth()
      setAuthState(EMPTY_STATE)
      setAuthNotice('Session expired. Sign in again.')
    }, Math.max(0, remainingMs))

    return () => window.clearTimeout(timeoutId)
  }, [authState.expiresAt, fixtureMode])

  const handleSignIn = useCallback(() => {
    if (fixtureMode) {
      return
    }

    if (!isReady) {
      return
    }
    setAuthNotice(null)
    const status = signIn()
    if (status === 'unavailable') {
      setIsSigningIn(false)
      setIsGisUnavailable(true)
      setAuthNotice('Google sign-in unavailable. Refresh to try again.')
      return
    }
    setIsSigningIn(true)
  }, [fixtureMode, isReady])

  const handleSignOut = useCallback(() => {
    if (fixtureMode) {
      return
    }

    signOut()
    clearSignInPopup()
    setAuthState(EMPTY_STATE)
    setIsSigningIn(false)
    setAuthNotice(null)
  }, [fixtureMode])

  // TV Mode sign-in: redirect to Google OAuth (no popup)
  const handleTvSignIn = useCallback(() => {
    if (fixtureMode) {
      return
    }

    if (!CLIENT_ID) {
      setAuthNotice('Missing Google client ID. Check .env.local.')
      return
    }

    setAuthNotice(null)
    const redirectUri = window.location.origin + window.location.pathname
    const url = buildOAuthRedirectUrl(CLIENT_ID, redirectUri, SCOPES)
    window.location.href = url
  }, [fixtureMode])

  // Toggle TV mode on/off with persistence
  const handleToggleTvMode = useCallback(
    (enabled: boolean) => {
      if (fixtureMode) {
        return
      }

      setUseTvMode(enabled)
      setTvModePreference(enabled)

      // If enabling TV mode and GIS was unavailable, clear the notice
      if (enabled && isGisUnavailable) {
        setAuthNotice(null)
        setIsReady(true)
      }
    },
    [isGisUnavailable, fixtureMode],
  )

  return {
    ...authState,
    isReady,
    isSigningIn,
    authNotice,
    signIn: handleSignIn,
    signOut: handleSignOut,
    // TV Mode
    useTvMode,
    isGisUnavailable,
    tvSignIn: handleTvSignIn,
    toggleTvMode: handleToggleTvMode,
  }
}
