import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from './useAuth'

vi.mock('../services/auth', () => ({
  clearSignInPopup: vi.fn(),
  clearStoredAuth: vi.fn(),
  getStoredAuth: vi.fn(),
  hasOpenSignInPopup: vi.fn(),
  hasClientId: vi.fn(),
  initializeAuth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  storeAuth: vi.fn(),
  CLIENT_ID: 'test-client-id',
  SCOPES: 'test-scope-1 test-scope-2',
}))

vi.mock('../utils/tvDetection', () => ({
  getTvModePreference: vi.fn(),
  isTVBrowser: vi.fn(),
  setTvModePreference: vi.fn(),
}))

vi.mock('../utils/manualOAuth', () => ({
  buildOAuthRedirectUrl: vi.fn(),
  clearHashFromUrl: vi.fn(),
  extractErrorFromHash: vi.fn(),
  extractTokenFromHash: vi.fn(),
}))

import {
  clearSignInPopup,
  clearStoredAuth,
  getStoredAuth,
  hasOpenSignInPopup,
  hasClientId,
  initializeAuth,
  signIn as signInService,
  signOut as signOutService,
  storeAuth,
} from '../services/auth'

import {
  getTvModePreference,
  isTVBrowser,
  setTvModePreference,
} from '../utils/tvDetection'

import {
  buildOAuthRedirectUrl,
  clearHashFromUrl,
  extractErrorFromHash,
  extractTokenFromHash,
} from '../utils/manualOAuth'

function AuthProbe() {
  const {
    isAuthenticated,
    isReady,
    isSigningIn,
    authNotice,
    signIn,
    signOut,
    useTvMode,
    isGisUnavailable,
    tvSignIn,
    toggleTvMode,
  } = useAuth()

  return (
    <div>
      <span data-testid="auth">{String(isAuthenticated)}</span>
      <span data-testid="ready">{String(isReady)}</span>
      <span data-testid="signing">{String(isSigningIn)}</span>
      <span data-testid="notice">{authNotice ?? ''}</span>
      <span data-testid="tvMode">{String(useTvMode)}</span>
      <span data-testid="gisUnavailable">{String(isGisUnavailable)}</span>
      <button onClick={signIn}>Sign in</button>
      <button onClick={signOut}>Sign out</button>
      <button onClick={tvSignIn}>TV Sign in</button>
      <button onClick={() => toggleTvMode(true)}>Enable TV Mode</button>
      <button onClick={() => toggleTvMode(false)}>Disable TV Mode</button>
    </div>
  )
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(hasClientId).mockReturnValue(true)
    vi.mocked(hasOpenSignInPopup).mockReturnValue(false)
    vi.mocked(signInService).mockReturnValue('opened')
    // TV detection mocks - default to false/disabled
    vi.mocked(getTvModePreference).mockReturnValue(false)
    vi.mocked(isTVBrowser).mockReturnValue(false)
    // Manual OAuth mocks - default to no hash data
    vi.mocked(extractErrorFromHash).mockReturnValue(null)
    vi.mocked(extractTokenFromHash).mockReturnValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hydrates from stored auth and marks ready', async () => {
    vi.mocked(getStoredAuth).mockReturnValue({ accessToken: 'token', expiresAt: Date.now() + 60_000 })
    vi.mocked(initializeAuth).mockReturnValue(true)

    render(<AuthProbe />)

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'))
    expect(screen.getByTestId('auth').textContent).toBe('true')
  })

  it('handles auth errors from token response', async () => {
    let tokenCallback: ((response: google.accounts.oauth2.TokenResponse) => void) | undefined
    vi.mocked(getStoredAuth).mockReturnValue(null)
    vi.mocked(initializeAuth).mockImplementation((callback) => {
      tokenCallback = callback
      return true
    })

    render(<AuthProbe />)

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'))

    act(() => {
      tokenCallback?.({ error: 'access_denied' } as google.accounts.oauth2.TokenResponse)
    })

    await waitFor(() => expect(screen.getByTestId('notice').textContent).toBe('Sign-in failed. Try again.'))
    expect(clearStoredAuth).toHaveBeenCalled()
    expect(clearSignInPopup).toHaveBeenCalled()
    expect(screen.getByTestId('auth').textContent).toBe('false')
  })

  it('clears state on sign out', async () => {
    vi.mocked(getStoredAuth).mockReturnValue({ accessToken: 'token', expiresAt: Date.now() + 60_000 })
    vi.mocked(initializeAuth).mockReturnValue(true)

    render(<AuthProbe />)

    await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('true'))
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(signOutService).toHaveBeenCalled()
    expect(clearSignInPopup).toHaveBeenCalled()
    expect(screen.getByTestId('auth').textContent).toBe('false')
  })

  it('signs in when ready', async () => {
    vi.mocked(getStoredAuth).mockReturnValue(null)
    vi.mocked(initializeAuth).mockReturnValue(true)

    render(<AuthProbe />)

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'))
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(signInService).toHaveBeenCalled()
  })

  it('clears signing-in state when popup closes while focused', async () => {
    vi.useFakeTimers()
    vi.mocked(getStoredAuth).mockReturnValue(null)
    vi.mocked(initializeAuth).mockReturnValue(true)
    vi.mocked(hasOpenSignInPopup).mockReturnValue(true)

    render(<AuthProbe />)

    act(() => {
      vi.runOnlyPendingTimers()
    })
    expect(screen.getByTestId('ready').textContent).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByTestId('signing').textContent).toBe('true')

    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(screen.getByTestId('signing').textContent).toBe('true')

    vi.mocked(hasOpenSignInPopup).mockReturnValue(false)

    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(screen.getByTestId('signing').textContent).toBe('false')
  })

  it('reports missing client id', async () => {
    vi.mocked(getStoredAuth).mockReturnValue(null)
    vi.mocked(hasClientId).mockReturnValue(false)

    render(<AuthProbe />)

    await waitFor(() => expect(screen.getByTestId('notice').textContent).toBe('Missing Google client ID. Check .env.local.'))
  })

  it('stores auth on success with scope', async () => {
    let tokenCallback: ((response: google.accounts.oauth2.TokenResponse) => void) | undefined
    vi.mocked(getStoredAuth).mockReturnValue(null)
    vi.mocked(initializeAuth).mockImplementation((callback) => {
      tokenCallback = callback
      return true
    })
    vi.mocked(storeAuth).mockReturnValue(Date.now() + 120_000)

    render(<AuthProbe />)

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'))

    const testScope = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.appdata'
    act(() => {
      tokenCallback?.({ access_token: 'token', expires_in: 120, scope: testScope } as google.accounts.oauth2.TokenResponse)
    })

    await waitFor(() => expect(storeAuth).toHaveBeenCalledWith('token', 120, testScope))
    expect(clearSignInPopup).toHaveBeenCalled()
    expect(screen.getByTestId('auth').textContent).toBe('true')
  })

  it('notifies when initialization never becomes ready', () => {
    vi.useFakeTimers()
    vi.mocked(getStoredAuth).mockReturnValue(null)
    vi.mocked(initializeAuth).mockReturnValue(false)

    render(<AuthProbe />)

    act(() => {
      vi.advanceTimersByTime(0)
      vi.advanceTimersByTime(25 * 200)
    })

    expect(screen.getByTestId('notice').textContent).toBe('Google sign-in unavailable. Refresh to try again.')

    vi.useRealTimers()
  })

  it('expires sessions based on stored expiry', () => {
    vi.useFakeTimers()
    const now = Date.now()
    vi.setSystemTime(now)
    vi.mocked(getStoredAuth).mockReturnValue({ accessToken: 'token', expiresAt: now + 1000 })
    vi.mocked(initializeAuth).mockReturnValue(true)

    render(<AuthProbe />)

    act(() => {
      vi.advanceTimersByTime(0)
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByTestId('notice').textContent).toBe('Session expired. Sign in again.')
    expect(clearStoredAuth).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('does nothing when signIn called before ready', async () => {
    vi.mocked(getStoredAuth).mockReturnValue(null)
    vi.mocked(initializeAuth).mockReturnValue(false)

    render(<AuthProbe />)

    // Not ready yet
    expect(screen.getByTestId('ready').textContent).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    // signIn should not be called when not ready
    expect(signInService).not.toHaveBeenCalled()
    expect(screen.getByTestId('signing').textContent).toBe('false')
  })

  it('sets isGisUnavailable when signIn returns unavailable', async () => {
    vi.mocked(getStoredAuth).mockReturnValue(null)
    vi.mocked(initializeAuth).mockReturnValue(true)
    vi.mocked(signInService).mockReturnValue('unavailable')

    render(<AuthProbe />)

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'))

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByTestId('gisUnavailable').textContent).toBe('true')
    expect(screen.getByTestId('notice').textContent).toBe('Google sign-in unavailable. Refresh to try again.')
    expect(screen.getByTestId('signing').textContent).toBe('false')
  })

  it('redirects to OAuth URL when tvSignIn is called', async () => {
    const mockLocation = { href: '', origin: 'https://example.com', pathname: '/app' }
    const originalLocation = window.location
    Object.defineProperty(window, 'location', { value: mockLocation, writable: true })

    vi.mocked(getStoredAuth).mockReturnValue(null)
    vi.mocked(initializeAuth).mockReturnValue(true)
    vi.mocked(buildOAuthRedirectUrl).mockReturnValue('https://accounts.google.com/oauth?test=1')

    render(<AuthProbe />)

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'))

    fireEvent.click(screen.getByRole('button', { name: 'TV Sign in' }))

    expect(buildOAuthRedirectUrl).toHaveBeenCalledWith(
      'test-client-id',
      'https://example.com/app',
      'test-scope-1 test-scope-2'
    )
    expect(mockLocation.href).toBe('https://accounts.google.com/oauth?test=1')

    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
  })

  it('toggles TV mode on and persists preference', async () => {
    vi.mocked(getStoredAuth).mockReturnValue(null)
    vi.mocked(initializeAuth).mockReturnValue(true)

    render(<AuthProbe />)

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'))

    expect(screen.getByTestId('tvMode').textContent).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'Enable TV Mode' }))

    expect(screen.getByTestId('tvMode').textContent).toBe('true')
    expect(setTvModePreference).toHaveBeenCalledWith(true)
  })

  it('toggles TV mode off and persists preference', async () => {
    vi.mocked(getTvModePreference).mockReturnValue(true)
    vi.mocked(getStoredAuth).mockReturnValue(null)
    vi.mocked(initializeAuth).mockReturnValue(true)

    render(<AuthProbe />)

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'))

    expect(screen.getByTestId('tvMode').textContent).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Disable TV Mode' }))

    expect(screen.getByTestId('tvMode').textContent).toBe('false')
    expect(setTvModePreference).toHaveBeenCalledWith(false)
  })

  it('clears notice and sets ready when enabling TV mode with GIS unavailable', async () => {
    vi.useFakeTimers()
    vi.mocked(getStoredAuth).mockReturnValue(null)
    vi.mocked(initializeAuth).mockReturnValue(false)

    render(<AuthProbe />)

    // Trigger GIS unavailable by exhausting init attempts
    act(() => {
      vi.advanceTimersByTime(0)
      vi.advanceTimersByTime(25 * 200)
    })

    expect(screen.getByTestId('gisUnavailable').textContent).toBe('true')
    expect(screen.getByTestId('notice').textContent).toBe('Google sign-in unavailable. Refresh to try again.')

    // Enable TV mode
    fireEvent.click(screen.getByRole('button', { name: 'Enable TV Mode' }))

    expect(screen.getByTestId('notice').textContent).toBe('')
    expect(screen.getByTestId('ready').textContent).toBe('true')

    vi.useRealTimers()
  })

  it('handles OAuth error in URL hash with access_denied', () => {
    vi.mocked(extractErrorFromHash).mockReturnValue({ error: 'access_denied' })
    vi.mocked(getStoredAuth).mockReturnValue(null)
    vi.mocked(initializeAuth).mockReturnValue(true)

    render(<AuthProbe />)

    expect(screen.getByTestId('notice').textContent).toBe('Sign-in cancelled. Try again when ready.')
    expect(screen.getByTestId('auth').textContent).toBe('false')
    expect(screen.getByTestId('ready').textContent).toBe('true')
    expect(clearHashFromUrl).toHaveBeenCalled()
  })

  it('handles OAuth error in URL hash with custom error description', () => {
    vi.mocked(extractErrorFromHash).mockReturnValue({
      error: 'server_error',
      errorDescription: 'Something went wrong',
    })
    vi.mocked(getStoredAuth).mockReturnValue(null)
    vi.mocked(initializeAuth).mockReturnValue(true)

    render(<AuthProbe />)

    expect(screen.getByTestId('notice').textContent).toBe('Sign-in failed: Something went wrong')
    expect(screen.getByTestId('auth').textContent).toBe('false')
    expect(clearHashFromUrl).toHaveBeenCalled()
  })

  it('handles OAuth token in URL hash and authenticates', () => {
    const expiresAt = Date.now() + 3600_000
    vi.mocked(extractTokenFromHash).mockReturnValue({
      accessToken: 'hash-token',
      expiresIn: 3600,
      scope: 'test-scope',
    })
    vi.mocked(storeAuth).mockReturnValue(expiresAt)
    vi.mocked(getStoredAuth).mockReturnValue(null)
    vi.mocked(initializeAuth).mockReturnValue(true)

    render(<AuthProbe />)

    expect(storeAuth).toHaveBeenCalledWith('hash-token', 3600, 'test-scope')
    expect(screen.getByTestId('auth').textContent).toBe('true')
    expect(screen.getByTestId('ready').textContent).toBe('true')
    expect(screen.getByTestId('notice').textContent).toBe('')
    expect(clearHashFromUrl).toHaveBeenCalled()
  })

  it('auto-enables TV mode on TV browsers when GIS fails', () => {
    vi.useFakeTimers()
    vi.mocked(getStoredAuth).mockReturnValue(null)
    vi.mocked(initializeAuth).mockReturnValue(false)
    vi.mocked(isTVBrowser).mockReturnValue(true)

    render(<AuthProbe />)

    // Trigger GIS unavailable by exhausting init attempts
    act(() => {
      vi.advanceTimersByTime(0)
      vi.advanceTimersByTime(25 * 200)
    })

    expect(screen.getByTestId('tvMode').textContent).toBe('true')
    expect(setTvModePreference).toHaveBeenCalledWith(true)

    vi.useRealTimers()
  })
})
