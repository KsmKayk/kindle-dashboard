import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const clientId = process.env.SPOTIFY_API_CLIENT_ID!
  const redirectUri = new URL('/api/spotify/callback', request.url).toString()

  const scopes = [
    'user-read-currently-playing',
    'user-read-playback-state',
    'user-modify-playback-state',
  ].join(' ')

  const authUrl = new URL('https://accounts.spotify.com/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('redirect_uri', redirectUri)

  return NextResponse.redirect(authUrl.toString())
}
