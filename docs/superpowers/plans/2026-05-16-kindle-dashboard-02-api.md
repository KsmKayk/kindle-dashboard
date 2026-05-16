# Kindle Dashboard — Plan 02: API Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all server-side API routes and lib functions: image grayscale proxy, Steam, League of Legends, and Spotify (including OAuth, playback control, and lyrics).

**Architecture:** Next.js App Router Route Handlers. Lib functions are pure async functions that call external APIs — thin wrappers that make mocking in tests simple. Route handlers call lib functions and return JSON (or binary for images).

**Tech Stack:** Next.js 14 Route Handlers, Sharp (image processing), native `fetch`, Jest + ts-jest for lib tests.

**Prerequisite:** Plan 01 complete. Types in `src/types/` exist.

---

### Task 1: Image Grayscale Proxy

**Files:**
- Create: `src/lib/image.ts`
- Create: `src/__tests__/lib/image.test.ts`
- Create: `src/app/api/image-proxy/route.ts`

The proxy fetches a remote image and converts it to grayscale using Sharp. Only images from approved CDN domains are allowed (SSRF protection).

- [ ] **Step 1: Write failing test**

Create `src/__tests__/lib/image.test.ts`:

```typescript
import { fetchAndGrayscale, isAllowedImageUrl } from '@/lib/image'

global.fetch = jest.fn()

describe('isAllowedImageUrl', () => {
  it('allows Steam CDN', () => {
    expect(isAllowedImageUrl('https://cdn.cloudflare.steamstatic.com/steam/apps/123/header.jpg')).toBe(true)
  })
  it('allows Data Dragon', () => {
    expect(isAllowedImageUrl('https://ddragon.leagueoflegends.com/cdn/14.10.1/img/champion/Ahri.png')).toBe(true)
  })
  it('allows Spotify CDN', () => {
    expect(isAllowedImageUrl('https://i.scdn.co/image/abc123')).toBe(true)
  })
  it('blocks arbitrary URLs', () => {
    expect(isAllowedImageUrl('https://evil.com/malware.png')).toBe(false)
  })
  it('blocks internal IP ranges', () => {
    expect(isAllowedImageUrl('http://192.168.1.1/image.png')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
npx jest src/__tests__/lib/image.test.ts
```

Expected: `Cannot find module '@/lib/image'`

- [ ] **Step 3: Create `src/lib/image.ts`**

```typescript
import sharp from 'sharp'

const ALLOWED_HOSTNAMES = [
  'cdn.cloudflare.steamstatic.com',
  'ddragon.leagueoflegends.com',
  'i.scdn.co',
  'mosaic.scdn.co',
  'community.cloudflare.steamstatic.com',
]

export function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const host = parsed.hostname
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.)/.test(host)) return false
    return ALLOWED_HOSTNAMES.includes(host)
  } catch {
    return false
  }
}

export async function fetchAndGrayscale(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl, {
    headers: { 'User-Agent': 'KindleDashboard/1.0' },
  })
  if (!response.ok) throw new Error(`Upstream fetch failed: ${response.status}`)
  const arrayBuffer = await response.arrayBuffer()
  return sharp(Buffer.from(arrayBuffer))
    .grayscale()
    .toBuffer()
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx jest src/__tests__/lib/image.test.ts
```

Expected: `PASS` — 5 tests pass.

- [ ] **Step 5: Create `src/app/api/image-proxy/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { fetchAndGrayscale, isAllowedImageUrl } from '@/lib/image'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }
  if (!isAllowedImageUrl(url)) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 400 })
  }
  try {
    const buffer = await fetchAndGrayscale(url)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    })
  } catch (err) {
    console.error('[image-proxy]', err)
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 })
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/image.ts src/app/api/image-proxy src/__tests__/lib/image.test.ts
git commit -m "feat: add image grayscale proxy with SSRF protection"
```

---

### Task 2: Steam API Lib + Route

**Files:**
- Create: `src/lib/steam.ts`
- Create: `src/__tests__/lib/steam.test.ts`
- Create: `src/app/api/steam/route.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/lib/steam.test.ts`:

```typescript
import { buildGameFallback, minutesToHours, getSteamHeaderImageUrl, getSteamLibraryImageUrl } from '@/lib/steam'

describe('Steam utility functions', () => {
  it('minutesToHours converts correctly', () => {
    expect(minutesToHours(120)).toBe(2)
    expect(minutesToHours(90)).toBe(1.5)
    expect(minutesToHours(0)).toBe(0)
  })

  it('buildGameFallback truncates and uppercases long names', () => {
    expect(buildGameFallback('Elden Ring')).toBe('ELDEN\nRING')
    expect(buildGameFallback('Dark Souls II: Scholar of the First Sin')).toBe('DARK\nSOULS\nII:')
  })

  it('getSteamHeaderImageUrl formats correctly', () => {
    expect(getSteamHeaderImageUrl(1245620)).toBe(
      'https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg'
    )
  })

  it('getSteamLibraryImageUrl formats correctly', () => {
    expect(getSteamLibraryImageUrl(335300)).toBe(
      'https://cdn.cloudflare.steamstatic.com/steam/apps/335300/library_600x900.jpg'
    )
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
npx jest src/__tests__/lib/steam.test.ts
```

Expected: `Cannot find module '@/lib/steam'`

- [ ] **Step 3: Create `src/lib/steam.ts`**

```typescript
import type { SteamData, SteamNowPlaying, SteamTopGame } from '@/types'

const API_BASE = 'https://api.steampowered.com'

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10
}

export function buildGameFallback(name: string): string {
  return name.split(' ').slice(0, 3).join('\n').toUpperCase()
}

export function getSteamHeaderImageUrl(appId: number | string): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`
}

export function getSteamLibraryImageUrl(appId: number | string): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`
}

async function steamFetch<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const key = process.env.STEAM_API_KEY!
  const steamId = process.env.STEAM_ID!
  const url = new URL(`${API_BASE}/${endpoint}`)
  url.searchParams.set('key', key)
  url.searchParams.set('steamid', steamId)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`Steam API error: ${res.status}`)
  return res.json() as T
}

export async function buildSteamData(): Promise<SteamData> {
  const [summaryRes, ownedRes] = await Promise.all([
    steamFetch<{ response: { players: Array<{ personaname: string; personastate: number; gameid?: string; gameextrainfo?: string }> } }>(
      'ISteamUser/GetPlayerSummaries/v0002/', {}
    ),
    steamFetch<{ response: { games?: Array<{ appid: number; name: string; playtime_forever: number }>; game_count?: number } }>(
      'IPlayerService/GetOwnedGames/v0001/',
      { include_appinfo: '1', include_played_free_games: '1' }
    ),
  ])

  const player = summaryRes.response.players[0]
  const allGames = ownedRes.response.games ?? []
  const totalGames = ownedRes.response.game_count ?? allGames.length

  let nowPlaying: SteamNowPlaying | null = null
  if (player.gameid && player.gameextrainfo) {
    nowPlaying = {
      name: player.gameextrainfo,
      appid: player.gameid,
      headerImg: getSteamHeaderImageUrl(player.gameid),
      fallback: buildGameFallback(player.gameextrainfo),
    }
  }

  const topGames: SteamTopGame[] = allGames
    .filter((g) => g.playtime_forever > 0)
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, 3)
    .map((g) => ({
      name: g.name,
      appid: g.appid,
      hours: minutesToHours(g.playtime_forever),
      coverImg: getSteamLibraryImageUrl(g.appid),
      fallback: buildGameFallback(g.name),
    }))

  return {
    nowPlaying,
    topGames,
    totalGames,
    isOnline: player.personastate !== 0,
    personaname: player.personaname,
  }
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx jest src/__tests__/lib/steam.test.ts
```

Expected: `PASS` — 4 tests pass.

- [ ] **Step 5: Create `src/app/api/steam/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { buildSteamData } from '@/lib/steam'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await buildSteamData()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/steam]', err)
    return NextResponse.json({ error: 'Steam API unavailable' }, { status: 502 })
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/steam.ts src/app/api/steam src/__tests__/lib/steam.test.ts
git commit -m "feat: add Steam API lib and route handler"
```

---

### Task 3: League of Legends API Lib + Route

**Files:**
- Create: `src/lib/league.ts`
- Create: `src/__tests__/lib/league.test.ts`
- Create: `src/app/api/league/route.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/lib/league.test.ts`:

```typescript
import { queueTypeLabel, buildChampionFallback, getChampionImageUrl, buildChampIdMap } from '@/lib/league'

describe('League utility functions', () => {
  it('queueTypeLabel maps queue IDs', () => {
    expect(queueTypeLabel(420)).toBe('Ranked Solo')
    expect(queueTypeLabel(440)).toBe('Ranked Flex')
    expect(queueTypeLabel(400)).toBe('Normal Draft')
    expect(queueTypeLabel(450)).toBe('ARAM')
    expect(queueTypeLabel(999)).toBe('Normal')
  })

  it('buildChampionFallback uppercases name', () => {
    expect(buildChampionFallback('Ahri')).toBe('AHRI')
    expect(buildChampionFallback('Twisted Fate')).toBe('TF')
  })

  it('getChampionImageUrl formats correctly', () => {
    expect(getChampionImageUrl('Ahri', '14.10.1')).toBe(
      'https://ddragon.leagueoflegends.com/cdn/14.10.1/img/champion/Ahri.png'
    )
  })

  it('buildChampIdMap inverts champion JSON data', () => {
    const champData = {
      data: {
        Ahri: { key: '103', name: 'Ahri' },
        Lux: { key: '99', name: 'Lux' },
      },
    }
    const map = buildChampIdMap(champData)
    expect(map['103']).toBe('Ahri')
    expect(map['99']).toBe('Lux')
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
npx jest src/__tests__/lib/league.test.ts
```

Expected: `Cannot find module '@/lib/league'`

- [ ] **Step 3: Create `src/lib/league.ts`**

```typescript
import type { LeagueData, MatchResult, ChampionStat, SummonerProfile } from '@/types'

const BR1_BASE = 'https://br1.api.riotgames.com'
const AMERICAS_BASE = 'https://americas.api.riotgames.com'
const DD_BASE = 'https://ddragon.leagueoflegends.com'

const QUEUE_LABELS: Record<number, string> = {
  420: 'Ranked Solo',
  440: 'Ranked Flex',
  400: 'Normal Draft',
  430: 'Normal Blind',
  450: 'ARAM',
}

export function queueTypeLabel(queueId: number): string {
  return QUEUE_LABELS[queueId] ?? 'Normal'
}

export function buildChampionFallback(name: string): string {
  const words = name.split(' ')
  if (words.length === 1) return name.toUpperCase()
  return words.map((w) => w[0]).join('').toUpperCase()
}

export function getChampionImageUrl(championName: string, ddVersion: string): string {
  return `${DD_BASE}/cdn/${ddVersion}/img/champion/${championName}.png`
}

export function getProfileIconUrl(iconId: number, ddVersion: string): string {
  return `${DD_BASE}/cdn/${ddVersion}/img/profileicon/${iconId}.png`
}

export function buildChampIdMap(champJson: { data: Record<string, { key: string; name: string }> }): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [champName, champInfo] of Object.entries(champJson.data)) {
    map[champInfo.key] = champName
  }
  return map
}

async function riotFetch<T>(baseUrl: string, path: string): Promise<T> {
  const key = process.env.LEAGUE_API_KEY!
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'X-Riot-Token': key },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Riot API error ${res.status} at ${path}`)
  return res.json() as T
}

export async function getDDVersion(): Promise<string> {
  const versions = await fetch(`${DD_BASE}/api/versions.json`).then((r) => r.json()) as string[]
  return versions[0]
}

export async function getSummonerData(summonerId: string): Promise<SummonerProfile> {
  return riotFetch<SummonerProfile>(BR1_BASE, `/lol/summoner/v4/summoners/${summonerId}`)
}

async function getMatchDetails(matchId: string, puuid: string, ddVersion: string): Promise<MatchResult> {
  type MatchResponse = {
    info: {
      queueId: number
      participants: Array<{
        puuid: string
        championName: string
        kills: number
        deaths: number
        assists: number
        win: boolean
      }>
    }
  }
  const match = await riotFetch<MatchResponse>(AMERICAS_BASE, `/lol/match/v5/matches/${matchId}`)
  const me = match.info.participants.find((p) => p.puuid === puuid)!
  return {
    matchId,
    champion: me.championName,
    win: me.win,
    kills: me.kills,
    deaths: me.deaths,
    assists: me.assists,
    queueType: queueTypeLabel(match.info.queueId),
    championImg: getChampionImageUrl(me.championName, ddVersion),
    fallback: buildChampionFallback(me.championName),
  }
}

export async function buildLeagueData(): Promise<LeagueData> {
  const summonerId = process.env.SUMMONER_ID!
  const [ddVersion, summoner] = await Promise.all([getDDVersion(), getSummonerData(summonerId)])

  const matchIds = await riotFetch<string[]>(
    AMERICAS_BASE,
    `/lol/match/v5/matches/by-puuid/${summoner.puuid}/ids?count=20`
  )

  const recentMatches = await Promise.all(
    matchIds.slice(0, 20).map((id) => getMatchDetails(id, summoner.puuid, ddVersion))
  )

  const displayMatches = recentMatches.slice(0, 4)

  // Compute per-champion stats from recent 20 matches
  const champStats: Record<string, { wins: number; games: number }> = {}
  for (const m of recentMatches) {
    if (!champStats[m.champion]) champStats[m.champion] = { wins: 0, games: 0 }
    champStats[m.champion].games++
    if (m.win) champStats[m.champion].wins++
  }

  const topChamps: ChampionStat[] = Object.entries(champStats)
    .sort((a, b) => b[1].games - a[1].games)
    .slice(0, 3)
    .map(([name, stats]) => ({
      name,
      games: stats.games,
      winrate: Math.round((stats.wins / stats.games) * 100),
      championImg: getChampionImageUrl(name, ddVersion),
      fallback: buildChampionFallback(name),
    }))

  // Extract game name + tag from summoner name (format: "name#TAG" in newer API or separate fields)
  const summonerName = summoner.name ?? 'Summoner'
  const [gameName, tagLine] = summonerName.includes('#')
    ? summonerName.split('#')
    : [summonerName, 'BR1']

  return {
    profile: {
      name: gameName,
      tag: `#${tagLine}`,
      level: summoner.summonerLevel,
      iconUrl: getProfileIconUrl(summoner.profileIconId, ddVersion),
      fallback: gameName.slice(0, 2).toUpperCase(),
    },
    matches: displayMatches,
    topChamps,
    ddVersion,
  }
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx jest src/__tests__/lib/league.test.ts
```

Expected: `PASS` — 4 tests pass.

- [ ] **Step 5: Create `src/app/api/league/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { buildLeagueData } from '@/lib/league'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await buildLeagueData()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/league]', err)
    return NextResponse.json({ error: 'League API unavailable' }, { status: 502 })
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/league.ts src/app/api/league src/__tests__/lib/league.test.ts
git commit -m "feat: add League of Legends API lib and route handler"
```

---

### Task 4: Spotify API Lib + Routes

**Files:**
- Create: `src/lib/spotify.ts`
- Create: `src/__tests__/lib/spotify.test.ts`
- Create: `src/app/api/spotify/route.ts`
- Create: `src/app/api/spotify/auth/route.ts`
- Create: `src/app/api/spotify/callback/route.ts`
- Create: `src/app/api/spotify/control/route.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/lib/spotify.test.ts`:

```typescript
import { parseLrcLibResponse, formatFallback } from '@/lib/spotify'

describe('Spotify utility functions', () => {
  it('parseLrcLibResponse parses synced lyrics', () => {
    const raw = '[00:12.50] Hello world\n[00:15.20] Second line\n'
    const result = parseLrcLibResponse(raw)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ time: 12.5, text: 'Hello world' })
    expect(result[1]).toEqual({ time: 15.2, text: 'Second line' })
  })

  it('parseLrcLibResponse skips metadata lines', () => {
    const raw = '[ar:Artist]\n[ti:Title]\n[00:05.00] Actual lyric\n'
    const result = parseLrcLibResponse(raw)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('Actual lyric')
  })

  it('formatFallback truncates artist name', () => {
    expect(formatFallback('The Beatles')).toBe('THE\nBEATLES')
    expect(formatFallback('Taylor Swift - Red')).toBe('TAYLOR\nSWIFT')
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
npx jest src/__tests__/lib/spotify.test.ts
```

Expected: `Cannot find module '@/lib/spotify'`

- [ ] **Step 3: Create `src/lib/spotify.ts`**

```typescript
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
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx jest src/__tests__/lib/spotify.test.ts
```

Expected: `PASS` — 3 tests pass.

- [ ] **Step 5: Create `src/app/api/spotify/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getAccessToken, getCurrentlyPlaying } from '@/lib/spotify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const token = await getAccessToken()
    const data = await getCurrentlyPlaying(token)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/spotify]', err)
    return NextResponse.json({ isPlaying: false, track: null })
  }
}
```

- [ ] **Step 6: Create `src/app/api/spotify/auth/route.ts`** (OAuth initiation)

```typescript
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
```

- [ ] **Step 7: Create `src/app/api/spotify/callback/route.ts`** (OAuth callback — shows refresh token)

```typescript
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
```

- [ ] **Step 8: Create `src/app/api/spotify/control/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken, controlPlayback } from '@/lib/spotify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json() as { action: string }
  const action = body.action

  if (!['play', 'pause', 'next', 'previous'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  try {
    const token = await getAccessToken()
    await controlPlayback(action as 'play' | 'pause' | 'next' | 'previous', token)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/spotify/control]', err)
    return NextResponse.json({ error: 'Playback control failed' }, { status: 502 })
  }
}
```

- [ ] **Step 9: Create `src/app/api/spotify/lyrics/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getLyrics } from '@/lib/spotify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title') ?? ''
  const artist = request.nextUrl.searchParams.get('artist') ?? ''
  const album = request.nextUrl.searchParams.get('album') ?? ''

  if (!title || !artist) {
    return NextResponse.json({ error: 'title and artist required' }, { status: 400 })
  }

  try {
    const data = await getLyrics(title, artist, album)
    if (!data) return NextResponse.json(null)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    })
  } catch (err) {
    console.error('[api/spotify/lyrics]', err)
    return NextResponse.json(null)
  }
}
```

- [ ] **Step 10: Run all tests**

```bash
npx jest
```

Expected: All tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/lib/spotify.ts src/app/api/spotify src/__tests__/lib/spotify.test.ts
git commit -m "feat: add Spotify API lib with OAuth, playback control, and lyrics routes"
```

---

**Plan 02 complete.** Proceed to `2026-05-16-kindle-dashboard-03-components.md`.
