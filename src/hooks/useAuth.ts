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
  ALL_SCOPES,
} from '../services/auth'
import { exchangeCodeForToken, type TokenResponse } from '../services/tokenExchange'
import type { AuthState } from '../types/auth'
import { isFixtureMode } from '../utils/env'
import {
  buildOAuthRedirectUrl,
  clearHashFromUrl,
  clearQueryFromUrl,
  consumeCodeVerifier,
  extractCodeFromUrl,
  extractErrorFromHash,
  extractErrorFromUrl,
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
  pendingCodeExchange: { code: string; redirectUri: string } | null
}

const getInitialAuthState = (fixtureMode: boolean): InitialAuthResult => {
  if (fixtureMode) {
    return {
      authState: FIXTURE_STATE,
      isReady: true,
      authNotice: null,
      handledOAuthCallback: false,
      pendingCodeExchange: null,
    }
  }

  // Check for OAuth error in URL query (auth code flow) or hash (legacy implicit flow)
  const oauthErrorQuery = extractErrorFromUrl()
  const oauthErrorHash = extractErrorFromHash()
  const oauthError = oauthErrorQuery ?? oauthErrorHash

  if (oauthError) {
    if (oauthErrorQuery) clearQueryFromUrl()
    if (oauthErrorHash) clearHashFromUrl()
    return {
      authState: EMPTY_STATE,
      isReady: true,
      authNotice:
        oauthError.error === 'access_denied'
          ? 'Sign-in cancelled. Try again when ready.'
          : `Sign-in failed: ${oauthError.errorDescription ?? oauthError.error}`,
      handledOAuthCallback: true,
      pendingCodeExchange: null,
    }
  }

  // Check for authorization code in URL query (auth code flow)
  const codeData = extractCodeFromUrl()
  if (codeData) {
    const redirectUri = window.location.origin + window.location.pathname
    clearQueryFromUrl()
    return {
      authState: EMPTY_STATE, // Will be updated after code exchange
      isReady: false,
      authNotice: null,
      handledOAuthCallback: true,
      pendingCodeExchange: { code: codeData.code, redirectUri },
    }
  }

  // Check for OAuth token in URL hash (legacy implicit flow - kept for backwards compat)
  const tokenData = extractTokenFromHash()
  if (tokenData) {
    const expiresAt = storeAuth(tokenData.accessToken, tokenData.expiresIn, tokenData.scope)
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
      pendingCodeExchange: null,
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
      pendingCodeExchange: null,
    }
  }

  return {
    authState: EMPTY_STATE,
    isReady: false,
    authNotice: null,
    handledOAuthCallback: false,
    pendingCodeExchange: null,
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

  // Handle pending authorization code exchange (TV mode redirect flow)
  useEffect(() => {
    if (fixtureMode || !initialResult.pendingCodeExchange) {
      return
    }

    const { code, redirectUri } = initialResult.pendingCodeExchange
    const codeVerifier = consumeCodeVerifier()

    if (!codeVerifier) {
      setAuthNotice('Sign-in failed: Missing code verifier. Please try again.')
      setIsReady(true)
      return
    }

    // Exchange the authorization code for tokens
    exchangeCodeForToken({
      code,
      codeVerifier,
      redirectUri,
    })
      .then((tokenResponse) => {
        const expiresAt = storeAuth(
          tokenResponse.access_token,
          tokenResponse.expires_in,
          tokenResponse.scope,
        )
        setAuthState({
          isAuthenticated: true,
          user: null,
          accessToken: tokenResponse.access_token,
          expiresAt,
        })
        setIsReady(true)
        setAuthNotice(null)
      })
      .catch((error) => {
        console.error('Token exchange failed:', error)
        setAuthNotice('Sign-in failed. Please try again.')
        setIsReady(true)
      })
  }, [fixtureMode, initialResult.pendingCodeExchange])

  useEffect(() => {
    if (fixtureMode) {
      return
    }

    const handleTokenResponse = (response: TokenResponse) => {
      const expiresAt = storeAuth(response.access_token, response.expires_in, response.scope)
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

    const handleAuthError = (error: string) => {
      clearStoredAuth()
      clearSignInPopup()
      setAuthState(EMPTY_STATE)
      setIsSigningIn(false)
      if (error === 'popup_closed') {
        // User closed popup - not an error worth showing
        return
      }
      setAuthNotice('Sign-in failed. Try again.')
    }

    let intervalId: number | undefined
    const tryInitialize = () => {
      if (!hasClientId()) {
        setAuthNotice('Missing Google client ID. Check .env.local.')
        return true
      }

      const ready = initializeAuth(handleTokenResponse, handleAuthError)
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

  const handleSignIn = useCallback(async () => {
    if (fixtureMode) {
      return
    }

    if (!isReady) {
      return
    }
    setAuthNotice(null)
    const status = await signIn()
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
  const handleTvSignIn = useCallback(async () => {
    if (fixtureMode) {
      return
    }

    if (!CLIENT_ID) {
      setAuthNotice('Missing Google client ID. Check .env.local.')
      return
    }

    setAuthNotice(null)
    const redirectUri = window.location.origin + window.location.pathname
    const url = await buildOAuthRedirectUrl(CLIENT_ID, redirectUri, ALL_SCOPES)
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
