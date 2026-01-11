import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the logger module so we can spy on log.error across module resets
const mockLogError = vi.fn()
vi.mock('../utils/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLogError,
    debug: vi.fn(),
  },
}))

// Mock the token exchange service
const mockExchangeCodeForToken = vi.fn()
vi.mock('./tokenExchange', () => ({
  exchangeCodeForToken: mockExchangeCodeForToken,
}))

type GoogleStub = {
  accounts: {
    oauth2: {
      initCodeClient: (options: {
        client_id: string
        scope: string
        ux_mode: string
        redirect_uri: string
        callback: (response: { code: string; error?: string }) => void
        error_callback?: (error: { type: string }) => void
      }) => {
        requestCode: (options?: { hint?: string; state?: string; prompt?: string }) => void
      }
      revoke: (token: string, done: () => void) => void
    }
  }
}

const globalWithGoogle = globalThis as typeof globalThis & { google?: GoogleStub }

const loadAuth = async () => {
  vi.resetModules()
  return await import('./auth')
}

describe('auth service', () => {
  beforeEach(() => {
    sessionStorage.clear()
    globalWithGoogle.google = undefined
    mockLogError.mockClear()
    mockExchangeCodeForToken.mockReset()
  })

  it('reports whether a client id is configured', async () => {
    const auth = await loadAuth()

    expect(auth.hasClientId()).toBe(Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID))
  })

  it('initializes code client when google is ready', async () => {
    const requestCode = vi.fn()
    const initCodeClient = vi.fn(() => ({ requestCode }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initCodeClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    const onSuccess = vi.fn()

    expect(auth.initializeAuth(onSuccess)).toBe(true)
    expect(initCodeClient).toHaveBeenCalled()
  })

  it('stores auth tokens', async () => {
    const auth = await loadAuth()
    const expiresAt = auth.storeAuth('token', 120)

    expect(auth.getStoredAuth()).toEqual({ accessToken: 'token', expiresAt })
  })

  it('stores granted scopes when provided', async () => {
    const auth = await loadAuth()
    const testScopes = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.appdata'
    auth.storeAuth('token', 120, testScopes)

    expect(auth.getGrantedScopes()).toBe(testScopes)
    expect(sessionStorage.getItem('yearbird:grantedScopes')).toBe(testScopes)
  })

  it('does not store scopes when not provided', async () => {
    const auth = await loadAuth()
    auth.storeAuth('token', 120)

    expect(auth.getGrantedScopes()).toBeNull()
    expect(sessionStorage.getItem('yearbird:grantedScopes')).toBeNull()
  })

  it('hasDriveScope returns true when drive.appdata scope is granted', async () => {
    const auth = await loadAuth()
    const testScopes = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.appdata'
    auth.storeAuth('token', 120, testScopes)

    expect(auth.hasDriveScope()).toBe(true)
  })

  it('hasDriveScope returns false when only calendar scope is granted', async () => {
    const auth = await loadAuth()
    const testScopes = 'https://www.googleapis.com/auth/calendar.readonly'
    auth.storeAuth('token', 120, testScopes)

    expect(auth.hasDriveScope()).toBe(false)
  })

  it('hasDriveScope returns false when no scopes are stored', async () => {
    const auth = await loadAuth()
    auth.storeAuth('token', 120)

    expect(auth.hasDriveScope()).toBe(false)
  })

  it('clears expired tokens', async () => {
    const auth = await loadAuth()
    const expiresAt = Date.now() - 1000

    sessionStorage.setItem('yearbird:accessToken', 'token')
    sessionStorage.setItem('yearbird:expiresAt', expiresAt.toString())

    expect(auth.getStoredAuth()).toBeNull()
    expect(sessionStorage.getItem('yearbird:accessToken')).toBeNull()
  })

  it('signs in using the code client', async () => {
    const requestCode = vi.fn()
    const initCodeClient = vi.fn(() => ({ requestCode }))
    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initCodeClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})
    await auth.signIn()

    expect(requestCode).toHaveBeenCalled()
  })

  it('focuses an existing sign-in popup instead of opening a new one', async () => {
    const popup = { closed: false, focus: vi.fn() } as unknown as Window
    const originalOpen = window.open
    window.open = vi.fn(() => popup)
    const requestCode = vi.fn(() => {
      window.open('https://accounts.google.com', 'yearbird-google-auth')
    })
    const initCodeClient = vi.fn(() => ({ requestCode }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initCodeClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})

    await auth.signIn()
    window.open('https://accounts.google.com', 'yearbird-google-auth')
    expect(auth.hasOpenSignInPopup()).toBe(true)

    await auth.signIn()

    expect(popup.focus).toHaveBeenCalled()
    window.open = originalOpen
  })

  it('revokes token on sign out', async () => {
    const revoke = vi.fn((_token: string, done: () => void) => done())
    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initCodeClient: vi.fn(() => ({ requestCode: vi.fn() })),
          revoke,
        },
      },
    }

    const auth = await loadAuth()

    sessionStorage.setItem('yearbird:accessToken', 'token')
    sessionStorage.setItem('yearbird:expiresAt', String(Date.now() + 60_000))

    auth.signOut()

    expect(revoke).toHaveBeenCalled()
    expect(sessionStorage.getItem('yearbird:accessToken')).toBeNull()
  })

  it('clears stored auth explicitly including scopes', async () => {
    const auth = await loadAuth()

    sessionStorage.setItem('yearbird:accessToken', 'token')
    sessionStorage.setItem('yearbird:expiresAt', String(Date.now() + 60_000))
    sessionStorage.setItem('yearbird:grantedScopes', 'https://www.googleapis.com/auth/calendar.readonly')

    auth.clearStoredAuth()

    expect(sessionStorage.getItem('yearbird:accessToken')).toBeNull()
    expect(sessionStorage.getItem('yearbird:grantedScopes')).toBeNull()
  })

  it('signIn returns unavailable when not initialized', async () => {
    // No google stub set, so codeClient will be null
    globalWithGoogle.google = undefined

    const auth = await loadAuth()
    const result = await auth.signIn()

    expect(result).toBe('unavailable')
  })

  it('getGrantedScopes handles sessionStorage errors gracefully', async () => {
    const auth = await loadAuth()

    // Mock sessionStorage.getItem to throw an error
    const originalGetItem = sessionStorage.getItem
    sessionStorage.getItem = vi.fn(() => {
      throw new Error('Storage access denied')
    })

    const result = auth.getGrantedScopes()

    expect(result).toBeNull()
    sessionStorage.getItem = originalGetItem
  })

  it('clearSignInPopup clears state correctly', async () => {
    const popup = { closed: false, focus: vi.fn() } as unknown as Window
    const originalOpen = window.open
    window.open = vi.fn(() => popup)
    const requestCode = vi.fn(() => {
      window.open('https://accounts.google.com', 'yearbird-google-auth')
    })
    const initCodeClient = vi.fn(() => ({ requestCode }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initCodeClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})
    await auth.signIn()

    // Popup should now be tracked
    expect(auth.hasOpenSignInPopup()).toBe(true)

    // Clear the popup state
    auth.clearSignInPopup()

    // Should no longer track the popup
    expect(auth.hasOpenSignInPopup()).toBe(false)

    window.open = originalOpen
  })

  it('hasOpenSignInPopup returns false when popup has been closed', async () => {
    const popup = { closed: false, focus: vi.fn() } as unknown as Window & { closed: boolean }
    const originalOpen = window.open
    window.open = vi.fn(() => popup)
    const requestCode = vi.fn(() => {
      window.open('https://accounts.google.com', 'yearbird-google-auth')
    })
    const initCodeClient = vi.fn(() => ({ requestCode }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initCodeClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})
    await auth.signIn()

    // Popup should be tracked
    expect(auth.hasOpenSignInPopup()).toBe(true)

    // Simulate popup being closed
    popup.closed = true

    // Should now return false
    expect(auth.hasOpenSignInPopup()).toBe(false)

    window.open = originalOpen
  })

  it('window.open patch does not capture non-auth popups', async () => {
    const popup = { closed: false, focus: vi.fn() } as unknown as Window
    const originalOpen = window.open
    window.open = vi.fn(() => popup)
    const requestCode = vi.fn(() => {
      // First, open a non-Google popup (should not be captured)
      window.open('https://example.com', 'other-popup')
    })
    const initCodeClient = vi.fn(() => ({ requestCode }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initCodeClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})
    await auth.signIn()

    // Non-Google popup should not be captured as sign-in popup
    auth.clearSignInPopup()
    expect(auth.hasOpenSignInPopup()).toBe(false)

    window.open = originalOpen
  })

  describe('requestDriveScope', () => {
    it('returns false when CLIENT_ID is missing', async () => {
      globalWithGoogle.google = undefined

      const auth = await loadAuth()
      const result = await auth.requestDriveScope()

      expect(result).toBe(false)
    })

    it('returns false when Google is not ready', async () => {
      globalWithGoogle.google = undefined

      const auth = await loadAuth()
      const result = await auth.requestDriveScope()

      expect(result).toBe(false)
    })

    it('returns true when drive scope is granted successfully', async () => {
      let capturedCallback: ((response: { code: string; error?: string }) => void) | null = null
      const requestCode = vi.fn()
      const initCodeClient = vi.fn(
        (options: { callback: (response: { code: string; error?: string }) => void }) => {
          capturedCallback = options.callback
          return { requestCode }
        }
      )

      globalWithGoogle.google = {
        accounts: {
          oauth2: {
            initCodeClient,
            revoke: vi.fn(),
          },
        },
      }

      // Mock successful token exchange
      mockExchangeCodeForToken.mockResolvedValue({
        access_token: 'new-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.appdata',
      })

      const auth = await loadAuth()
      const resultPromise = auth.requestDriveScope()

      // Simulate successful code response
      expect(capturedCallback).not.toBeNull()
      capturedCallback!({ code: 'test-code' })

      const result = await resultPromise
      expect(result).toBe(true)
    })

    it('returns false when response contains error', async () => {
      let capturedCallback: ((response: { code: string; error?: string }) => void) | null = null
      const requestCode = vi.fn()
      const initCodeClient = vi.fn(
        (options: { callback: (response: { code: string; error?: string }) => void }) => {
          capturedCallback = options.callback
          return { requestCode }
        }
      )

      globalWithGoogle.google = {
        accounts: {
          oauth2: {
            initCodeClient,
            revoke: vi.fn(),
          },
        },
      }

      const auth = await loadAuth()
      const resultPromise = auth.requestDriveScope()

      // Simulate error response
      expect(capturedCallback).not.toBeNull()
      capturedCallback!({ code: '', error: 'access_denied' })

      const result = await resultPromise
      expect(result).toBe(false)
      expect(mockLogError).toHaveBeenCalledWith('Drive scope request failed:', 'access_denied')
    })

    it('returns false when error_callback is invoked', async () => {
      let capturedErrorCallback: ((error: { type: string }) => void) | null = null
      const requestCode = vi.fn()
      const initCodeClient = vi.fn(
        (options: {
          callback: (response: { code: string; error?: string }) => void
          error_callback: (error: { type: string }) => void
        }) => {
          capturedErrorCallback = options.error_callback
          return { requestCode }
        }
      )

      globalWithGoogle.google = {
        accounts: {
          oauth2: {
            initCodeClient,
            revoke: vi.fn(),
          },
        },
      }

      const auth = await loadAuth()
      const resultPromise = auth.requestDriveScope()

      // Simulate error callback (e.g., popup closed)
      expect(capturedErrorCallback).not.toBeNull()
      capturedErrorCallback!({ type: 'popup_closed' })

      const result = await resultPromise
      expect(result).toBe(false)
      expect(mockLogError).toHaveBeenCalledWith('Drive scope request error:', { type: 'popup_closed' })
    })

    it('calls successHandler when set and scope granted', async () => {
      const requestCode = vi.fn()
      const initCodeClient = vi.fn(() => {
        return { requestCode }
      })

      globalWithGoogle.google = {
        accounts: {
          oauth2: {
            initCodeClient,
            revoke: vi.fn(),
          },
        },
      }

      const mockResponse = {
        access_token: 'new-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.appdata',
      }
      mockExchangeCodeForToken.mockResolvedValue(mockResponse)

      const auth = await loadAuth()
      const successHandler = vi.fn()
      auth.initializeAuth(successHandler)

      const resultPromise = auth.requestDriveScope()

      // Find the callback from requestDriveScope (the second call to initCodeClient)
      const calls = initCodeClient.mock.calls
      const driveRequestCall = calls[calls.length - 1]
      const driveCallback = driveRequestCall[0].callback as (response: {
        code: string
        error?: string
      }) => void
      driveCallback({ code: 'test-code' })

      const result = await resultPromise
      expect(result).toBe(true)
      expect(successHandler).toHaveBeenCalledWith(mockResponse)
    })

    it('returns false when drive scope is not in response', async () => {
      const requestCode = vi.fn()
      const initCodeClient = vi.fn(() => {
        return { requestCode }
      })

      globalWithGoogle.google = {
        accounts: {
          oauth2: {
            initCodeClient,
            revoke: vi.fn(),
          },
        },
      }

      // Mock response where user only granted calendar scope (declined drive)
      mockExchangeCodeForToken.mockResolvedValue({
        access_token: 'new-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
      })

      const auth = await loadAuth()
      const resultPromise = auth.requestDriveScope()

      // Find the callback from requestDriveScope
      const calls = initCodeClient.mock.calls
      const driveRequestCall = calls[calls.length - 1]
      const driveCallback = driveRequestCall[0].callback as (response: {
        code: string
        error?: string
      }) => void

      driveCallback({ code: 'test-code' })

      const result = await resultPromise
      expect(result).toBe(false)
    })
  })
})
