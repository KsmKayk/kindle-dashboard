# Kindle Static HTML Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/kindle` route that returns a zero-JavaScript, pure HTML page (with meta-refresh auto-reload) so a Kindle e-ink browser on weak hardware can display Steam and League data without running any client-side code.

**Architecture:** A module-level singleton cache (`server-cache.ts`) holds the last fetched Steam and League API responses with configurable TTLs. The `/kindle` route handler reads from that cache, tries Spotify (optional, no cache), and renders a plain HTML string via `kindle-render.ts`. The browser receives `text/html` with a `<meta http-equiv="refresh">` tag — no JS bundle, no React hydration.

**Tech Stack:** Next.js App Router route handler, TypeScript, existing `buildSteamData` / `buildLeagueData` / `getCurrentlyPlaying`, existing `/api/image-proxy` for grayscale images, Jest for tests.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/server-cache.ts` | Create | Module-level singleton TTL cache for Steam + League data |
| `src/lib/kindle-render.ts` | Create | Pure TypeScript HTML string renderer (no React) |
| `src/app/kindle/route.ts` | Create | Route handler: reads cache, renders, returns `text/html` |
| `src/__tests__/lib/server-cache.test.ts` | Create | Unit tests for cache hit/miss/TTL logic |
| `src/__tests__/lib/kindle-render.test.ts` | Create | Unit tests for HTML string output |
| `src/__tests__/api/kindle.test.ts` | Create | Route handler integration test |

---

### Task 1: Server-side data cache

**Files:**
- Create: `src/lib/server-cache.ts`
- Create: `src/__tests__/lib/server-cache.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/__tests__/lib/server-cache.test.ts`:
```typescript
import { getCachedSteamData, getCachedLeagueData, resetCacheForTest } from '@/lib/server-cache'
import { buildSteamData } from '@/lib/steam'
import { buildLeagueData } from '@/lib/league'
import type { SteamData, LeagueData } from '@/types'

jest.mock('@/lib/steam')
jest.mock('@/lib/league')

const mockSteam = buildSteamData as jest.MockedFunction<typeof buildSteamData>
const mockLeague = buildLeagueData as jest.MockedFunction<typeof buildLeagueData>

const fakeSteam: SteamData = {
  nowPlaying: null,
  topGames: [],
  totalGames: 42,
  isOnline: true,
  personaname: 'TestUser',
}

const fakeLeague: LeagueData = {
  profile: { name: 'Summoner', tag: '#TEST', level: 100, iconUrl: 'http://x.com/icon.png', fallback: 'SU' },
  matches: [],
  topChamps: [],
  ddVersion: '14.0.1',
}

beforeEach(() => {
  resetCacheForTest()
  mockSteam.mockResolvedValue(fakeSteam)
  mockLeague.mockResolvedValue(fakeLeague)
})

describe('getCachedSteamData', () => {
  it('fetches and returns data on first call', async () => {
    const data = await getCachedSteamData()
    expect(data).toEqual(fakeSteam)
    expect(mockSteam).toHaveBeenCalledTimes(1)
  })

  it('returns cached data on second call without fetching again', async () => {
    await getCachedSteamData()
    await getCachedSteamData()
    expect(mockSteam).toHaveBeenCalledTimes(1)
  })

  it('refetches after TTL expires', async () => {
    process.env.STEAM_UPDATE_RATE = '1'
    await getCachedSteamData()
    await new Promise((r) => setTimeout(r, 1100))
    await getCachedSteamData()
    expect(mockSteam).toHaveBeenCalledTimes(2)
    delete process.env.STEAM_UPDATE_RATE
  })
})

describe('getCachedLeagueData', () => {
  it('fetches and returns data on first call', async () => {
    const data = await getCachedLeagueData()
    expect(data).toEqual(fakeLeague)
    expect(mockLeague).toHaveBeenCalledTimes(1)
  })

  it('returns cached data on second call without fetching again', async () => {
    await getCachedLeagueData()
    await getCachedLeagueData()
    expect(mockLeague).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx jest src/__tests__/lib/server-cache.test.ts --no-coverage
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/lib/server-cache.ts`**

```typescript
import { buildSteamData } from './steam'
import { buildLeagueData } from './league'
import type { SteamData, LeagueData } from '@/types'

interface Entry<T> { data: T; at: number }

let steamEntry: Entry<SteamData> | null = null
let leagueEntry: Entry<LeagueData> | null = null

function steamTtlMs() { return parseInt(process.env.STEAM_UPDATE_RATE ?? '60', 10) * 1000 }
function leagueTtlMs() { return parseInt(process.env.LEAGUE_UPDATE_RATE ?? '600', 10) * 1000 }

export async function getCachedSteamData(): Promise<SteamData> {
  if (steamEntry && Date.now() - steamEntry.at < steamTtlMs()) return steamEntry.data
  const data = await buildSteamData()
  steamEntry = { data, at: Date.now() }
  return data
}

export async function getCachedLeagueData(): Promise<LeagueData> {
  if (leagueEntry && Date.now() - leagueEntry.at < leagueTtlMs()) return leagueEntry.data
  const data = await buildLeagueData()
  leagueEntry = { data, at: Date.now() }
  return data
}

export function resetCacheForTest() {
  steamEntry = null
  leagueEntry = null
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest src/__tests__/lib/server-cache.test.ts --no-coverage
```
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/server-cache.ts src/__tests__/lib/server-cache.test.ts
git commit -m "feat: add server-side TTL cache for Steam and League data"
```

---

### Task 2: Kindle HTML renderer

**Files:**
- Create: `src/lib/kindle-render.ts`
- Create: `src/__tests__/lib/kindle-render.test.ts`

The renderer takes data objects and returns a complete HTML document string. It uses `<table>` for multi-column grids (most compatible with old browsers), inline styles, and the existing `/api/image-proxy?url=` endpoint for grayscale images. All user-supplied strings are HTML-escaped.

- [ ] **Step 1: Write the failing tests**

`src/__tests__/lib/kindle-render.test.ts`:
```typescript
import { renderKindlePage, escapeHtml } from '@/lib/kindle-render'
import type { SteamData, LeagueData, SpotifyPlayback } from '@/types'

const BASE = 'http://localhost:3000'

const steam: SteamData = {
  nowPlaying: { name: 'Elden Ring', appid: '1245620', headerImg: 'http://cdn/1245620/header.jpg', fallback: 'ELDEN\nRING' },
  topGames: [
    { name: 'Elden Ring', appid: 1245620, hours: 120, coverImg: 'http://cdn/1245620/library.jpg', fallback: 'ELDEN\nRING' },
    { name: 'Dark Souls III', appid: 374320, hours: 80, coverImg: 'http://cdn/374320/library.jpg', fallback: 'DARK\nSOULS' },
    { name: 'Sekiro', appid: 814380, hours: 60, coverImg: 'http://cdn/814380/library.jpg', fallback: 'SEKIRO' },
  ],
  totalGames: 200,
  isOnline: true,
  personaname: 'AutumnFaun',
}

const league: LeagueData = {
  profile: { name: 'AutumnFaun', tag: '#SH4C0', level: 312, iconUrl: 'http://dd/icon/123.png', fallback: 'AU' },
  matches: [
    { matchId: 'BR1_1', champion: 'Jinx', win: true, kills: 10, deaths: 2, assists: 5, queueType: 'Ranked Solo', championImg: 'http://dd/Jinx.png', fallback: 'JINX' },
    { matchId: 'BR1_2', champion: 'Caitlyn', win: false, kills: 3, deaths: 7, assists: 2, queueType: 'Normal Draft', championImg: 'http://dd/Caitlyn.png', fallback: 'CAITLYN' },
  ],
  topChamps: [
    { name: 'Jinx', games: 15, winrate: 67, championImg: 'http://dd/Jinx.png', fallback: 'JINX' },
  ],
  ddVersion: '14.0.1',
}

const spotify: SpotifyPlayback = {
  isPlaying: true,
  track: {
    title: 'Song Title',
    artist: 'Artist Name',
    album: 'Album',
    durationMs: 200000,
    progressMs: 50000,
    coverUrl: 'http://spotify/cover.jpg',
    fallback: 'ARTIST\nNAME',
    id: 'track123',
  },
}

describe('renderKindlePage', () => {
  it('returns a complete HTML document', () => {
    const html = renderKindlePage(null, null, null, BASE)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('</html>')
  })

  it('includes meta refresh tag with configurable interval', () => {
    process.env.STEAM_UPDATE_RATE = '120'
    process.env.LEAGUE_UPDATE_RATE = '600'
    const html = renderKindlePage(null, null, null, BASE)
    expect(html).toContain('http-equiv="refresh"')
    expect(html).toContain('content="120"')
    delete process.env.STEAM_UPDATE_RATE
    delete process.env.LEAGUE_UPDATE_RATE
  })

  it('includes personaname when Steam data is provided', () => {
    const html = renderKindlePage(steam, null, null, BASE)
    expect(html).toContain('AutumnFaun')
    expect(html).toContain('online')
    expect(html).toContain('Elden Ring')
    expect(html).toContain('200h')
  })

  it('uses image proxy URL for Steam game images', () => {
    const html = renderKindlePage(steam, null, null, BASE)
    expect(html).toContain('/api/image-proxy?url=')
    expect(html).toContain(encodeURIComponent('http://cdn/1245620/library.jpg'))
  })

  it('includes player name and match results when League data is provided', () => {
    const html = renderKindlePage(null, league, null, BASE)
    expect(html).toContain('AutumnFaun')
    expect(html).toContain('#SH4C0')
    expect(html).toContain('Level 312')
    expect(html).toContain('Jinx')
    expect(html).toContain('WIN')
    expect(html).toContain('LOSS')
    expect(html).toContain('67% WR')
  })

  it('includes Spotify track when playing', () => {
    const html = renderKindlePage(null, null, spotify, BASE)
    expect(html).toContain('Song Title')
    expect(html).toContain('Artist Name')
  })

  it('omits Spotify section when not playing', () => {
    const noSpotify: SpotifyPlayback = { isPlaying: false, track: null }
    const html = renderKindlePage(null, null, noSpotify, BASE)
    expect(html).not.toContain('♫')
  })

  it('shows unavailable message when data is null', () => {
    const html = renderKindlePage(null, null, null, BASE)
    expect(html).toContain('unavailable')
  })
})

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry')
  })

  it('returns plain strings unchanged', () => {
    expect(escapeHtml('AutumnFaun')).toBe('AutumnFaun')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx jest src/__tests__/lib/kindle-render.test.ts --no-coverage
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/lib/kindle-render.ts`**

```typescript
import type { SteamData, LeagueData, SpotifyPlayback } from '@/types'

const INK = '#1a1612'
const PAPER = '#e8e3d8'
const PAPER_DARK = '#d8d2c4'
const WIN_GREEN = '#2a5c2a'
const LOSS_RED = '#8b1a1a'

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function proxyImg(url: string, baseUrl: string): string {
  return `${baseUrl}/api/image-proxy?url=${encodeURIComponent(url)}`
}

function sectionHeader(label: string, meta: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
  <tr>
    <td style="font-size:11px;font-weight:bold;letter-spacing:2px;border-bottom:1px solid ${INK};padding-bottom:4px;">${label}</td>
    <td style="font-size:11px;border-bottom:1px solid ${INK};padding-bottom:4px;text-align:right;font-weight:normal;">${meta}</td>
  </tr>
</table>`
}

function renderSteam(data: SteamData | null, baseUrl: string): string {
  if (!data) {
    return `<div style="margin-bottom:10px;">
      ${sectionHeader('STEAM', 'unavailable')}
      <p style="font-size:12px;color:#666;">Steam data unavailable</p>
    </div>`
  }

  const status = `${escapeHtml(data.personaname)} &middot; ${data.isOnline ? 'online' : 'offline'}`

  const nowPlaying = data.nowPlaying
    ? `<div style="font-size:12px;margin-bottom:8px;padding:6px 8px;background:${PAPER_DARK};border-radius:6px;border:1px solid ${INK};">
        <strong>NOW PLAYING:</strong> ${escapeHtml(data.nowPlaying.name)}
      </div>`
    : ''

  const gameRows: string[] = []
  const allCards = [...data.topGames.slice(0, 3)]
  const totalCard = `<div style="text-align:center;padding:10px 0;">
    <div style="font-size:28px;font-weight:bold;">${data.totalGames}</div>
    <div style="font-size:10px;letter-spacing:1px;">TOTAL GAMES</div>
  </div>`

  const cells: string[] = allCards.map((g) => `
    <div style="background:${PAPER_DARK};border:1px solid ${INK};border-radius:10px;overflow:hidden;">
      <img src="${proxyImg(g.coverImg, baseUrl)}" width="100%" height="66" style="display:block;width:100%;height:66px;object-fit:cover;" onerror="this.style.display='none'">
      <div style="padding:4px 6px;">
        <div style="font-size:11px;white-space:nowrap;overflow:hidden;">${escapeHtml(g.name)}</div>
        <div style="font-size:11px;color:#555;">${g.hours}h</div>
      </div>
    </div>`)
  cells.push(`<div style="background:${PAPER_DARK};border:1px solid ${INK};border-radius:10px;">${totalCard}</div>`)

  for (let i = 0; i < cells.length; i += 2) {
    const left = cells[i] ?? '<div></div>'
    const right = cells[i + 1] ?? '<div></div>'
    gameRows.push(`<tr>
      <td width="50%" style="padding-right:4px;padding-bottom:8px;vertical-align:top;">${left}</td>
      <td width="50%" style="padding-left:4px;padding-bottom:8px;vertical-align:top;">${right}</td>
    </tr>`)
  }

  return `<div style="margin-bottom:10px;">
    ${sectionHeader('STEAM', status)}
    ${nowPlaying}
    <table width="100%" cellpadding="0" cellspacing="0">${gameRows.join('')}</table>
  </div>`
}

function renderLeague(data: LeagueData | null, baseUrl: string): string {
  const year = new Date().getFullYear()

  if (!data) {
    return `<div style="margin-bottom:10px;">
      ${sectionHeader('LEAGUE OF LEGENDS', `All Game Modes &middot; ${year}`)}
      <p style="font-size:12px;color:#666;">League data unavailable</p>
    </div>`
  }

  const profile = `<div style="background:${PAPER_DARK};border:1px solid ${INK};border-radius:10px;padding:8px 10px;margin-bottom:8px;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px;vertical-align:top;">
        <img src="${proxyImg(data.profile.iconUrl, baseUrl)}" width="50" height="50" style="border-radius:6px;border:1px solid ${INK};display:block;" onerror="this.style.display='none'">
      </td>
      <td style="vertical-align:middle;">
        <div style="font-size:15px;font-weight:bold;">${escapeHtml(data.profile.name)}<span style="font-size:12px;font-weight:normal;color:#555;"> ${escapeHtml(data.profile.tag)}</span></div>
        <div style="font-size:12px;color:#555;">Level ${data.profile.level}</div>
      </td>
    </tr></table>
  </div>`

  const matchCells = data.matches.slice(0, 4).map((m) => {
    const color = m.win ? WIN_GREEN : LOSS_RED
    const result = m.win ? 'WIN' : 'LOSS'
    return `<div style="background:${PAPER_DARK};border:1px solid ${INK};border-radius:10px;padding:8px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:8px;vertical-align:top;">
          <img src="${proxyImg(m.championImg, baseUrl)}" width="42" height="42" style="border-radius:6px;border:1px solid ${INK};display:block;" onerror="this.style.display='none'">
        </td>
        <td style="vertical-align:middle;">
          <div style="font-size:12px;font-weight:bold;">${escapeHtml(m.champion)}</div>
          <div style="font-size:11px;color:#555;">${escapeHtml(m.queueType)}</div>
          <div style="font-size:11px;"><span style="color:${color};font-weight:bold;">${result}</span> &middot; ${m.kills}/${m.deaths}/${m.assists}</div>
        </td>
      </tr></table>
    </div>`
  })

  const matchRows: string[] = []
  for (let i = 0; i < matchCells.length; i += 2) {
    const left = matchCells[i] ?? '<div></div>'
    const right = matchCells[i + 1] ?? '<div></div>'
    matchRows.push(`<tr>
      <td width="50%" style="padding-right:4px;padding-bottom:8px;vertical-align:top;">${left}</td>
      <td width="50%" style="padding-left:4px;padding-bottom:8px;vertical-align:top;">${right}</td>
    </tr>`)
  }

  const champRows = data.topChamps.map((c, i) => `
    <div style="padding:6px 8px;background:${PAPER_DARK};border:1px solid ${INK};border-radius:8px;margin-bottom:6px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;">
          <span style="font-size:11px;font-weight:bold;margin-right:6px;">#${i + 1}</span>
          <img src="${proxyImg(c.championImg, baseUrl)}" width="28" height="28" style="vertical-align:middle;border-radius:4px;border:1px solid ${INK};margin-right:6px;" onerror="this.style.display='none'">
          <span style="font-size:12px;">${escapeHtml(c.name)}</span>
        </td>
        <td style="text-align:right;font-size:11px;color:#555;vertical-align:middle;">
          ${c.games} games &middot; ${c.winrate}% WR
        </td>
      </tr></table>
    </div>`).join('')

  return `<div style="margin-bottom:10px;">
    ${sectionHeader('LEAGUE OF LEGENDS', `All Game Modes &middot; ${year}`)}
    ${profile}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">${matchRows.join('')}</table>
    ${champRows}
  </div>`
}

function renderSpotify(data: SpotifyPlayback | null): string {
  if (!data?.isPlaying || !data.track) return ''
  return `<div style="font-size:12px;padding:6px 8px;background:${PAPER_DARK};border:1px solid ${INK};border-radius:8px;margin-bottom:8px;">
    &#9835; <strong>${escapeHtml(data.track.title)}</strong> &middot; ${escapeHtml(data.track.artist)}
  </div>`
}

export function renderKindlePage(
  steam: SteamData | null,
  league: LeagueData | null,
  spotify: SpotifyPlayback | null,
  baseUrl: string
): string {
  const steamRate = parseInt(process.env.STEAM_UPDATE_RATE ?? '60', 10)
  const leagueRate = parseInt(process.env.LEAGUE_UPDATE_RATE ?? '600', 10)
  const refreshSeconds = Math.min(steamRate, leagueRate)
  const updatedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=600, initial-scale=1, user-scalable=no">
<meta http-equiv="refresh" content="${refreshSeconds}">
<title>Dashboard</title>
</head>
<body style="background:${PAPER};color:${INK};font-family:Georgia,'Times New Roman',serif;margin:0;padding:20px 22px 16px;width:556px;box-sizing:border-box;">
${renderSteam(steam, baseUrl)}
${renderLeague(league, baseUrl)}
${renderSpotify(spotify)}
<div style="text-align:right;font-size:10px;color:#888;margin-top:4px;">Updated ${updatedAt} &middot; auto-refresh ${refreshSeconds}s</div>
</body>
</html>`
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest src/__tests__/lib/kindle-render.test.ts --no-coverage
```
Expected: PASS (10 tests)

- [ ] **Step 5: TypeScript check**

```
npx tsc --noEmit
```
Expected: no output (clean)

- [ ] **Step 6: Commit**

```bash
git add src/lib/kindle-render.ts src/__tests__/lib/kindle-render.test.ts
git commit -m "feat: add Kindle HTML renderer (zero-JS, table-based layout)"
```

---

### Task 3: Kindle route handler

**Files:**
- Create: `src/app/kindle/route.ts`
- Create: `src/__tests__/api/kindle.test.ts`

The route handler reads from the server cache for Steam and League (so the Kindle browser never triggers slow external API calls on its own), tries Spotify once on each request (fast, no cache needed), then calls the renderer and returns `text/html`.

- [ ] **Step 1: Write the failing test**

`src/__tests__/api/kindle.test.ts`:
```typescript
import { GET } from '@/app/kindle/route'
import { getCachedSteamData, getCachedLeagueData } from '@/lib/server-cache'
import { getAccessToken, getCurrentlyPlaying } from '@/lib/spotify'

jest.mock('@/lib/server-cache')
jest.mock('@/lib/spotify')

const mockSteamCache = getCachedSteamData as jest.MockedFunction<typeof getCachedSteamData>
const mockLeagueCache = getCachedLeagueData as jest.MockedFunction<typeof getCachedLeagueData>
const mockToken = getAccessToken as jest.MockedFunction<typeof getAccessToken>
const mockNowPlaying = getCurrentlyPlaying as jest.MockedFunction<typeof getCurrentlyPlaying>

const fakeSteam = {
  nowPlaying: null,
  topGames: [],
  totalGames: 10,
  isOnline: false,
  personaname: 'Tester',
}

const fakeLeague = {
  profile: { name: 'Tester', tag: '#TEST', level: 1, iconUrl: 'http://x/icon.png', fallback: 'TE' },
  matches: [],
  topChamps: [],
  ddVersion: '14.0.1',
}

beforeEach(() => {
  mockSteamCache.mockResolvedValue(fakeSteam as never)
  mockLeagueCache.mockResolvedValue(fakeLeague as never)
  mockToken.mockResolvedValue('mock-token')
  mockNowPlaying.mockResolvedValue({ isPlaying: false, track: null })
})

it('returns 200 with text/html content type', async () => {
  const req = new Request('http://localhost:3000/kindle')
  const res = await GET(req)
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toContain('text/html')
})

it('returns HTML document with meta refresh', async () => {
  const req = new Request('http://localhost:3000/kindle')
  const res = await GET(req)
  const html = await res.text()
  expect(html).toContain('<!DOCTYPE html>')
  expect(html).toContain('http-equiv="refresh"')
})

it('includes Steam personaname in HTML output', async () => {
  const req = new Request('http://localhost:3000/kindle')
  const res = await GET(req)
  const html = await res.text()
  expect(html).toContain('Tester')
})

it('returns valid HTML even when Steam cache throws', async () => {
  mockSteamCache.mockRejectedValue(new Error('Steam unavailable'))
  const req = new Request('http://localhost:3000/kindle')
  const res = await GET(req)
  expect(res.status).toBe(200)
  const html = await res.text()
  expect(html).toContain('<!DOCTYPE html>')
})

it('returns valid HTML even when League cache throws', async () => {
  mockLeagueCache.mockRejectedValue(new Error('League unavailable'))
  const req = new Request('http://localhost:3000/kindle')
  const res = await GET(req)
  expect(res.status).toBe(200)
})

it('returns valid HTML when Spotify is not configured', async () => {
  mockToken.mockRejectedValue(new Error('SPOTIFY_REFRESH_TOKEN not set'))
  const req = new Request('http://localhost:3000/kindle')
  const res = await GET(req)
  expect(res.status).toBe(200)
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx jest src/__tests__/api/kindle.test.ts --no-coverage
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/app/kindle/route.ts`**

```typescript
import { getCachedSteamData, getCachedLeagueData } from '@/lib/server-cache'
import { getAccessToken, getCurrentlyPlaying } from '@/lib/spotify'
import { renderKindlePage } from '@/lib/kindle-render'
import type { SteamData, LeagueData, SpotifyPlayback } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  const { origin } = new URL(request.url)

  const [steam, league] = await Promise.all([
    getCachedSteamData().catch((): SteamData | null => null),
    getCachedLeagueData().catch((): LeagueData | null => null),
  ])

  let spotify: SpotifyPlayback | null = null
  try {
    const token = await getAccessToken()
    spotify = await getCurrentlyPlaying(token)
  } catch {
    // Spotify not configured or unavailable — omit section
  }

  const html = renderKindlePage(steam, league, spotify, origin)

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx jest src/__tests__/api/kindle.test.ts --no-coverage
```
Expected: PASS (6 tests)

- [ ] **Step 5: Run full test suite**

```
npx jest --no-coverage
```
Expected: all tests pass (no regressions)

- [ ] **Step 6: TypeScript check**

```
npx tsc --noEmit
```
Expected: no output

- [ ] **Step 7: Commit**

```bash
git add src/app/kindle/route.ts src/__tests__/api/kindle.test.ts
git commit -m "feat: add /kindle route — zero-JS HTML page for Kindle browser"
```

---

## Manual Verification on Kindle

After implementation, test at `http://<server-ip>:3000/kindle` in a browser. On the Kindle:

1. Open the Silk/WebKit browser
2. Navigate to `http://<your-server-ip>:3000/kindle`
3. Bookmark it (if the browser supports it)
4. The page shows Steam + League + (Spotify if playing)
5. Page auto-reloads every `STEAM_UPDATE_RATE` seconds (default 60)

To make it fullscreen on Kindle: long-press the browser address bar and select "Full screen" or "Reading mode" if available. On Kindle Paperwhite, use the browser menu → "Article mode" to strip the browser chrome.

---

## Self-Review

**Spec coverage:**
- ✅ Server-side data generation (cache module, not client-side fetching)
- ✅ Data stays "semi-static" (TTL cache respects existing `STEAM_UPDATE_RATE` / `LEAGUE_UPDATE_RATE` env vars)
- ✅ Page auto-refreshes via `<meta http-equiv="refresh">` — no JS needed
- ✅ Zero JavaScript sent to browser
- ✅ Works on old browsers (table-based layout, inline styles, no CSS variables)
- ✅ Existing `/api/image-proxy` handles grayscale conversion
- ✅ Spotify gracefully omitted if not configured

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:**
- `SteamData`, `LeagueData`, `SpotifyPlayback` used identically across all three tasks.
- `getCachedSteamData()` → `SteamData` (matches type in `server-cache.ts` and usage in `kindle/route.ts`).
- `renderKindlePage(steam, league, spotify, baseUrl)` signature matches across `kindle-render.ts` tests and `kindle/route.ts` call site.
- `resetCacheForTest()` exported from `server-cache.ts`, used in tests only.
