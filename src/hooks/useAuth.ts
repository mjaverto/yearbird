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
} from '../services/auth'
import type { AuthState } from '../types/auth'
import { isFixtureMode } from '../utils/env'

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

const getInitialAuthState = (fixtureMode: boolean): AuthState => {
  if (fixtureMode) {
    return FIXTURE_STATE
  }

  const stored = getStoredAuth()
  if (!stored) {
    return EMPTY_STATE
  }

  return {
    isAuthenticated: true,
    user: null,
    accessToken: stored.accessToken,
    expiresAt: stored.expiresAt,
  }
}

export function useAuth() {
  const fixtureMode = isFixtureMode()
  const [authState, setAuthState] = useState<AuthState>(() => getInitialAuthState(fixtureMode))
  const [isReady, setIsReady] = useState(fixtureMode)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [authNotice, setAuthNotice] = useState<string | null>(null)

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
          setAuthNotice('Google sign-in unavailable. Refresh to try again.')
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

  return {
    ...authState,
    isReady,
    isSigningIn,
    authNotice,
    signIn: handleSignIn,
    signOut: handleSignOut,
  }
}
