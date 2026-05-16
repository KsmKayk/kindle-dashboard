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

export async function getLyrics(title: string, artist: string, album: string): Promise<LyricsData | null> {
  const base = process.env.LRCLIB_API_URL ?? 'https://lrclib.net/api/'
  const url = new URL('get', base)
  url.searchParams.set('track_name', title)
  url.searchParams.set('artist_name', artist)
  url.searchParams.set('album_name', album)

  const res = await fetch(url.toString())
  if (!res.ok) return null

  const data = await res.json()
  const synced = data.syncedLyrics ? parseLrcLibResponse(data.syncedLyrics) : []
  const plain = data.plainLyrics ? data.plainLyrics.split('\n').filter(Boolean) : []

  if (synced.length === 0 && plain.length === 0) return null
  return { synced, plain }
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
  await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}
