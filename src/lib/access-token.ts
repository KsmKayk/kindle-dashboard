// Optional shared secret for the Spotify routes (KINDLE_API_TOKEN). Anyone who
// knows the server's URL could otherwise read the playback and control it.
// Unset = open, as before.

export const TOKEN_COOKIE = 'kindle_token'
export const TOKEN_PARAM = 'token'

export function requiredToken(): string | null {
  return process.env.KINDLE_API_TOKEN || null
}

// Constant-time comparison, so response timing doesn't leak the token
function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export interface TokenSources {
  authorization: string | null
  query: string | null
  cookie: string | null
}

export type AccessResult = 'open' | 'header' | 'query' | 'cookie' | 'denied'

// Which source carried a valid token ('open' when no token is configured)
export function checkAccess(sources: TokenSources, token = requiredToken()): AccessResult {
  if (!token) return 'open'
  const bearer = sources.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (bearer && sameToken(bearer, token)) return 'header'
  if (sources.query && sameToken(sources.query, token)) return 'query'
  if (sources.cookie && sameToken(sources.cookie, token)) return 'cookie'
  return 'denied'
}
