declare namespace google.accounts.oauth2 {
  // ============================================================================
  // Token Client (Implicit Flow - deprecated)
  // ============================================================================

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

  // ============================================================================
  // Code Client (Authorization Code Flow with PKCE)
  // ============================================================================

  interface CodeClient {
    requestCode(options?: RequestCodeOptions): void
  }

  interface RequestCodeOptions {
    /** Prompts the user for consent. Use 'consent' to force re-consent for incremental scopes. */
    prompt?: '' | 'none' | 'consent' | 'select_account'
    /** Hint for email address to pre-fill */
    hint?: string
    /** State parameter for CSRF protection */
    state?: string
  }

  interface CodeClientConfig {
    client_id: string
    scope: string
    /** UX mode: 'popup' or 'redirect' */
    ux_mode?: 'popup' | 'redirect'
    /** Redirect URI - use 'postmessage' for popup mode */
    redirect_uri?: string
    /** Callback when authorization code is received */
    callback: (response: CodeResponse) => void
    /** Error callback for access denied or popup closed */
    error_callback?: (error: CodeError) => void
    /** Enable PKCE flow */
    select_account?: boolean
  }

  interface CodeResponse {
    /** The authorization code to exchange for tokens */
    code: string
    /** The scope that was granted */
    scope: string
    /** Error code if authorization failed */
    error?: string
    /** Error description */
    error_description?: string
    /** State parameter echoed back */
    state?: string
  }

  interface CodeError {
    type: 'popup_failed_to_open' | 'popup_closed' | 'unknown'
    message?: string
  }

  function initCodeClient(config: CodeClientConfig): CodeClient
}
