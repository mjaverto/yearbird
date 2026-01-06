export interface GoogleUser {
  email: string
  name: string
  picture: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: GoogleUser | null
  accessToken: string | null
  expiresAt: number | null
}
