import type { SpotifyPlayback, LyricsData, LyricLine } from '@/types'

const ACCOUNTS_BASE = 'https://accounts.spotify.com'
const API_BASE = 'https://api.spotify.com/v1'

export function parseLrcLibResponse(syncedLyrics: string): LyricLine[] {
  const lines: LyricLine[] = []
  const pattern = /^\[(\d{2}):(\d{2})\.(\d{2})\]\s*(.+)$/
  for (const line of syncedLyrics.split('\n')) {
    const match = line.match(pattern)
    if (!match) continue
    const minutes = parseInt(match[1], 10)
    const seconds = parseInt(match[2], 10)
    const centiseconds = parseInt(match[3], 10)
    const time = minutes * 60 + seconds + centiseconds / 100
    const text = match[4].trim()
    if (text) lines.push({ time, text })
  }
  return lines
}

// Behind a reverse proxy request.url is the internal address (http://0.0.0.0:3000),
// so build the public callback URL from the Host / X-Forwarded-Proto headers.
export function spotifyRedirectUri(request: Request): string {
  const url = new URL(request.url)
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return `${proto}://${host}/api/spotify/callback`
}

export function formatFallback(artistName: string): string {
  return artistName.split(/[\s-]+/).slice(0, 2).join('\n').toUpperCase()
}

export async function getAccessToken(): Promise<string> {
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN
  if (!refreshToken) throw new Error('SPOTIFY_REFRESH_TOKEN not set. Visit /api/spotify/auth to authorize.')

  const clientId = process.env.SPOTIFY_API_CLIENT_ID!
  const clientSecret = process.env.SPOTIFY_API_CLIENT_SECRET!
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(`${ACCOUNTS_BASE}/api/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  const data = await res.json()
  return data.access_token as string
}

export async function getCurrentlyPlaying(accessToken: string): Promise<SpotifyPlayback> {
  const res = await fetch(`${API_BASE}/me/player/currently-playing`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (res.status === 204) return { isPlaying: false, track: null }
  if (!res.ok) throw new Error(`Spotify API error: ${res.status}`)

  const data = await res.json()
  if (!data?.item) return { isPlaying: false, track: null }

  const item = data.item
  const images: Array<{ url: string }> = item.album?.images ?? []
  const coverUrl = images.find((img) => img)?.url ?? null

  return {
    isPlaying: data.is_playing,
    track: {
      title: item.name,
      artist: item.artists.map((a: { name: string }) => a.name).join(', '),
      album: item.album?.name ?? '',
      durationMs: item.duration_ms,
      progressMs: data.progress_ms ?? 0,
      coverUrl,
      fallback: formatFallback(item.artists[0]?.name ?? 'MUSIC'),
      id: item.id,
    },
  }
}

interface LrcLibRecord {
  duration?: number
  syncedLyrics?: string | null
  plainLyrics?: string | null
}

function toLyricsData(record: LrcLibRecord): LyricsData | null {
  const synced = record.syncedLyrics ? parseLrcLibResponse(record.syncedLyrics) : []
  const plain = record.plainLyrics ? record.plainLyrics.split('\n').filter(Boolean) : []
  if (synced.length === 0 && plain.length === 0) return null
  return { synced, plain }
}

// Among search results, prefer ones whose length matches the track, then synced lyrics.
export function pickLrcLibResult(results: LrcLibRecord[], durationMs?: number): LrcLibRecord | null {
  const withLyrics = results.filter((r) => r.syncedLyrics || r.plainLyrics)
  const matching = durationMs
    ? withLyrics.filter((r) => r.duration == null || Math.abs(r.duration - durationMs / 1000) <= 3)
    : withLyrics
  return matching.find((r) => r.syncedLyrics) ?? matching[0] ?? null
}

export async function getLyrics(
  title: string,
  artist: string,
  album: string,
  durationMs?: number
): Promise<LyricsData | null> {
  const base = process.env.LRCLIB_API_URL ?? 'https://lrclib.net/api/'

  const exact = new URL('get', base)
  exact.searchParams.set('track_name', title)
  exact.searchParams.set('artist_name', artist)
  exact.searchParams.set('album_name', album)
  const res = await fetch(exact.toString())
  if (res.ok) {
    const lyrics = toLyricsData(await res.json())
    if (lyrics) return lyrics
  }

  // Spotify joins every artist ("A, B, C") while LRCLIB lists the main one, so the
  // exact lookup misses collaborations: search by title and first artist instead.
  const search = new URL('search', base)
  search.searchParams.set('track_name', title)
  search.searchParams.set('artist_name', artist.split(', ')[0])
  const searchRes = await fetch(search.toString())
  if (!searchRes.ok) return null
  const best = pickLrcLibResult(await searchRes.json(), durationMs)
  return best ? toLyricsData(best) : null
}

export async function controlPlayback(
  action: 'play' | 'pause' | 'next' | 'previous',
  accessToken: string
): Promise<void> {
  const endpoints: Record<string, { method: string; path: string }> = {
    play: { method: 'PUT', path: '/me/player/play' },
    pause: { method: 'PUT', path: '/me/player/pause' },
    next: { method: 'POST', path: '/me/player/next' },
    previous: { method: 'POST', path: '/me/player/previous' },
  }
  const { method, path } = endpoints[action]
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new SpotifyControlError(res.status)
}

export class SpotifyControlError extends Error {
  constructor(readonly status: number) {
    super(
      status === 403 ? 'Spotify Premium is required to control playback'
        : status === 404 ? 'No active Spotify device - start playing on a device first'
          : `Spotify playback control failed (${status})`
    )
  }
}
