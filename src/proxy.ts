import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkAccess, TOKEN_COOKIE, TOKEN_PARAM } from '@/lib/access-token'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

// Requires KINDLE_API_TOKEN on the Spotify routes (see src/lib/access-token.ts).
// A token given as ?token= is also saved in a cookie, so a browser only needs it
// once: the /spotify player's own fetches and the Kindle page's forms then pass.
export function proxy(request: NextRequest) {
  const access = checkAccess({
    authorization: request.headers.get('authorization'),
    query: request.nextUrl.searchParams.get(TOKEN_PARAM),
    cookie: request.cookies.get(TOKEN_COOKIE)?.value ?? null,
  })

  if (access === 'denied') {
    const message = 'Access token required: add ?token=YOUR_TOKEN to the URL (KINDLE_API_TOKEN)'
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: message }, { status: 401 })
    }
    return new NextResponse(message, { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  const response = NextResponse.next()
  if (access === 'query') {
    response.cookies.set(TOKEN_COOKIE, request.nextUrl.searchParams.get(TOKEN_PARAM)!, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.headers.get('x-forwarded-proto') === 'https',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    })
  }
  return response
}

// The Spotify API, the players and the OAuth start. The OAuth callback stays open:
// Spotify redirects to it, and it only works with a code from /api/spotify/auth.
// (Must be a literal: Next reads it at build time.)
export const config = {
  matcher: [
    '/api/spotify',
    '/api/spotify/lyrics',
    '/api/spotify/control',
    '/api/spotify/auth',
    '/spotify',
    '/kindle/spotify',
    '/kindle/spotify/control',
  ],
}
