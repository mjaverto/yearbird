declare namespace google.accounts.oauth2 {
  interface TokenClient {
    requestAccessToken(options?: RequestAccessTokenOptions): void
  }

  interface RequestAccessTokenOptions {
    /** Prompts the user for consent. Use 'consent' to force re-consent for incremental scopes. */
    prompt?: '' | 'none' | 'consent' | 'select_account'
    /** Hint for email address to pre-fill */
    hint?: string
    /** State parameter for OAuth flow */
    state?: string
  }

  interface TokenClientConfig {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    /** Error callback for access denied or popup closed */
    error_callback?: (error: TokenError) => void
  }

  interface TokenResponse {
    access_token: string
    expires_in: number
    scope: string
    token_type: string
    error?: string
    error_description?: string
    error_uri?: string
  }

  interface TokenError {
    type: 'popup_failed_to_open' | 'popup_closed' | 'unknown'
    message?: string
  }

  function initTokenClient(config: TokenClientConfig): TokenClient
  function revoke(token: string, callback: () => void): void
  function hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean
  function hasGrantedAnyScope(response: TokenResponse, ...scopes: string[]): boolean
}
