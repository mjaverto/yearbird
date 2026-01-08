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

function AuthProbe() {
  const { isAuthenticated, isReady, isSigningIn, authNotice, signIn, signOut } = useAuth()

  return (
    <div>
      <span data-testid="auth">{String(isAuthenticated)}</span>
      <span data-testid="ready">{String(isReady)}</span>
      <span data-testid="signing">{String(isSigningIn)}</span>
      <span data-testid="notice">{authNotice ?? ''}</span>
      <button onClick={signIn}>Sign in</button>
      <button onClick={signOut}>Sign out</button>
    </div>
  )
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(hasClientId).mockReturnValue(true)
    vi.mocked(hasOpenSignInPopup).mockReturnValue(false)
    vi.mocked(signInService).mockReturnValue('opened')
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
})
