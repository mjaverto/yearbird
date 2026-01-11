/**
 * PKCE (Proof Key for Code Exchange) Utilities
 *
 * Implements RFC 7636 for OAuth 2.0 public clients.
 * PKCE prevents authorization code interception attacks by requiring
 * a cryptographically random verifier that must match the challenge.
 *
 * @see https://oauth.net/2/pkce/
 * @see https://datatracker.ietf.org/doc/html/rfc7636
 */

/**
 * Base64URL encode (no padding, URL-safe characters)
 * Per RFC 7636 Appendix A
 */
export function base64URLEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Generate a cryptographically random code verifier.
 *
 * Per RFC 7636 Section 4.1:
 * - Must be between 43-128 characters
 * - Must use unreserved URI characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
 *
 * Using 32 bytes of randomness = 43 characters after base64url encoding.
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64URLEncode(array)
}

/**
 * Generate a code challenge from the verifier using SHA-256.
 *
 * Per RFC 7636 Section 4.2:
 * code_challenge = BASE64URL(SHA256(code_verifier))
 *
 * @param verifier - The code verifier to hash
 * @returns The base64url-encoded SHA-256 hash of the verifier
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return base64URLEncode(new Uint8Array(hash))
}

/**
 * Generate a cryptographically secure random state parameter.
 *
 * Used for CSRF protection in OAuth flows. The state is sent to
 * the authorization server and must be validated when it's returned.
 *
 * @returns A random UUID string
 */
export function generateState(): string {
  // crypto.randomUUID is widely supported in modern browsers
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // Fallback using crypto.getRandomValues (cryptographically secure)
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  // Format as UUID-like string
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}
