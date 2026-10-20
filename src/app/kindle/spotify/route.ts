import { getSpotifyNowOrLast, getCachedLyrics } from '@/lib/server-cache'
import { renderKindleSpotifyPage, parseRefreshSeconds } from '@/lib/kindle-spotify-render'
import type { LyricsData } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Zero-JavaScript Spotify player for the Kindle browser: ?r= sets the seconds between reloads
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const interval = parseRefreshSeconds(searchParams.get('r'))

  const playback = await getSpotifyNowOrLast()
  let lyrics: LyricsData | null = null
  if (playback?.track) {
    try {
      lyrics = await getCachedLyrics(playback.track)
    } catch (err) {
      console.error('[kindle/spotify] lyrics lookup failed', err)
    }
  }

  const html = renderKindleSpotifyPage(playback, lyrics, interval, searchParams.get('error'))
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
