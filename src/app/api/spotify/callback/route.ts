import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')

  if (error || !code) {
    return new NextResponse(`<html><body><h1>Auth failed: ${error}</h1></body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const clientId = process.env.SPOTIFY_API_CLIENT_ID!
  const clientSecret = process.env.SPOTIFY_API_CLIENT_SECRET!
  const redirectUri = new URL('/api/spotify/callback', request.url).toString()
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!res.ok) {
    return new NextResponse(`<html><body><h1>Token exchange failed: ${res.status}</h1></body></html>`, {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const data = await res.json()
  const refreshToken = data.refresh_token as string

  const html = `<!DOCTYPE html>
<html>
<head><title>Spotify Auth Complete</title></head>
<body style="font-family:monospace;padding:2rem;background:#f0ede8;color:#1a1612">
<h1>Authorization Complete</h1>
<p>Add this to your <code>.env</code> file:</p>
<pre style="background:#1a1612;color:#e8e3d8;padding:1rem;border-radius:8px">SPOTIFY_REFRESH_TOKEN=${refreshToken}</pre>
<p>Then restart the dev server.</p>
</body>
</html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}
