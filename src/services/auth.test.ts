import { beforeEach, describe, expect, it, vi } from 'vitest'

type GoogleStub = {
  accounts: {
    oauth2: {
      initTokenClient: (options: { client_id: string; scope: string; callback: (response: unknown) => void }) => {
        requestAccessToken: () => void
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
    localStorage.clear()
    globalWithGoogle.google = undefined
  })

  it('reports whether a client id is configured', async () => {
    const auth = await loadAuth()

    expect(auth.hasClientId()).toBe(Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID))
  })

  it('initializes token client when google is ready', async () => {
    const requestAccessToken = vi.fn()
    const initTokenClient = vi.fn(() => ({ requestAccessToken }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initTokenClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    const onSuccess = vi.fn()

    expect(auth.initializeAuth(onSuccess)).toBe(true)
    expect(initTokenClient).toHaveBeenCalled()
  })

  it('stores auth tokens', async () => {
    const auth = await loadAuth()
    const expiresAt = auth.storeAuth('token', 120)

    expect(auth.getStoredAuth()).toEqual({ accessToken: 'token', expiresAt })
  })

  it('clears expired tokens', async () => {
    const auth = await loadAuth()
    const expiresAt = Date.now() - 1000

    localStorage.setItem('yearbird:accessToken', 'token')
    localStorage.setItem('yearbird:expiresAt', expiresAt.toString())

    expect(auth.getStoredAuth()).toBeNull()
    expect(localStorage.getItem('yearbird:accessToken')).toBeNull()
  })

  it('signs in using the token client', async () => {
    const requestAccessToken = vi.fn()
    const initTokenClient = vi.fn(() => ({ requestAccessToken }))
    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initTokenClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})
    auth.signIn()

    expect(requestAccessToken).toHaveBeenCalled()
  })

  it('focuses an existing sign-in popup instead of opening a new one', async () => {
    const popup = { closed: false, focus: vi.fn() } as unknown as Window
    const originalOpen = window.open
    window.open = vi.fn(() => popup)
    const requestAccessToken = vi.fn(() => {
      window.open('https://accounts.google.com', 'yearbird-google-auth')
    })
    const initTokenClient = vi.fn(() => ({ requestAccessToken }))

    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initTokenClient,
          revoke: vi.fn(),
        },
      },
    }

    const auth = await loadAuth()
    auth.initializeAuth(() => {})

    auth.signIn()
    window.open('https://accounts.google.com', 'yearbird-google-auth')
    expect(auth.hasOpenSignInPopup()).toBe(true)

    auth.signIn()

    expect(popup.focus).toHaveBeenCalled()
    window.open = originalOpen
  })

  it('revokes token on sign out', async () => {
    const revoke = vi.fn((_token: string, done: () => void) => done())
    globalWithGoogle.google = {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn(() => ({ requestAccessToken: vi.fn() })),
          revoke,
        },
      },
    }

    const auth = await loadAuth()

    localStorage.setItem('yearbird:accessToken', 'token')
    localStorage.setItem('yearbird:expiresAt', String(Date.now() + 60_000))
    localStorage.setItem('yearbird:events:2025', JSON.stringify({ events: [], timestamp: Date.now() }))
    localStorage.setItem('yearbird:filters', JSON.stringify(['personal']))

    auth.signOut()

    expect(revoke).toHaveBeenCalled()
    expect(localStorage.getItem('yearbird:accessToken')).toBeNull()
    expect(localStorage.getItem('yearbird:events:2025')).toBeNull()
    expect(localStorage.getItem('yearbird:filters')).toBe(JSON.stringify(['personal']))
  })

  it('clears stored auth explicitly', async () => {
    const auth = await loadAuth()

    localStorage.setItem('yearbird:accessToken', 'token')
    localStorage.setItem('yearbird:expiresAt', String(Date.now() + 60_000))
    localStorage.setItem('yearbird:events:2025', JSON.stringify({ timestamp: Date.now(), events: [] }))

    auth.clearStoredAuth()

    expect(localStorage.getItem('yearbird:accessToken')).toBeNull()
    expect(localStorage.getItem('yearbird:events:2025')).toBeNull()
  })
})
