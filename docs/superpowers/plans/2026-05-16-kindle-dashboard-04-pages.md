# Kindle Dashboard — Plan 04: Pages, Hooks, and Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up polling hooks, compose the two pages (Main Dashboard and Spotify View), configure the root layout for Kindle fullscreen, and verify the complete app works end-to-end.

**Architecture:** Root layout sets a fixed 600px viewport. Both pages are thin Client Components that mount polling hooks and pass data down to section components from Plan 03. Update intervals come from env vars.

**Tech Stack:** React 18 hooks, Next.js 14 App Router, TypeScript.

**Prerequisite:** Plans 01, 02, 03 complete.

---

### Task 1: Data Polling Hooks

**Files:**
- Create: `src/hooks/useSteamData.ts`
- Create: `src/hooks/useLeagueData.ts`
- Create: `src/hooks/useSpotifyData.ts`

These hooks poll their respective API routes and return the latest data. The intervals are read from `process.env` on the client via `NEXT_PUBLIC_*` variables (set in `next.config.ts`).

- [ ] **Step 1: Expose update rates to client — update `next.config.ts`**

Open `next.config.ts` and replace with:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
  env: {
    NEXT_PUBLIC_STEAM_UPDATE_RATE: process.env.STEAM_UPDATE_RATE ?? '60',
    NEXT_PUBLIC_LEAGUE_UPDATE_RATE: process.env.LEAGUE_UPDATE_RATE ?? '600',
    NEXT_PUBLIC_SPOTIFY_UPDATE_RATE: process.env.SPOTIFY_UPDATE_RATE ?? '5',
  },
}

export default nextConfig
```

- [ ] **Step 2: Create `src/hooks/useSteamData.ts`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import type { SteamData } from '@/types'

export function useSteamData(): SteamData | null {
  const [data, setData] = useState<SteamData | null>(null)
  const interval = parseInt(process.env.NEXT_PUBLIC_STEAM_UPDATE_RATE ?? '60', 10) * 1000

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/steam')
        if (res.ok) setData(await res.json())
      } catch {
        // keep previous data on network error
      }
    }

    fetchData()
    const id = setInterval(fetchData, interval)
    return () => clearInterval(id)
  }, [interval])

  return data
}
```

- [ ] **Step 3: Create `src/hooks/useLeagueData.ts`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import type { LeagueData } from '@/types'

export function useLeagueData(): LeagueData | null {
  const [data, setData] = useState<LeagueData | null>(null)
  const interval = parseInt(process.env.NEXT_PUBLIC_LEAGUE_UPDATE_RATE ?? '600', 10) * 1000

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/league')
        if (res.ok) setData(await res.json())
      } catch {
        // keep previous data on network error
      }
    }

    fetchData()
    const id = setInterval(fetchData, interval)
    return () => clearInterval(id)
  }, [interval])

  return data
}
```

- [ ] **Step 4: Create `src/hooks/useSpotifyData.ts`**

This hook is more complex: it polls the Spotify API, fetches lyrics when the track changes, and interpolates playback position client-side between polls so the progress bar is smooth.

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import type { SpotifyPlayback, LyricsData } from '@/types'

interface SpotifyState {
  playback: SpotifyPlayback | null
  lyrics: LyricsData | null
  liveProgressMs: number
}

export function useSpotifyData(): SpotifyState & {
  sendControl: (action: 'play' | 'pause' | 'next' | 'previous') => Promise<void>
} {
  const [playback, setPlayback] = useState<SpotifyPlayback | null>(null)
  const [lyrics, setLyrics] = useState<LyricsData | null>(null)
  const [liveProgressMs, setLiveProgressMs] = useState(0)
  const lastTrackId = useRef<string | null>(null)
  const lastPollMs = useRef<number>(0)
  const interval = parseInt(process.env.NEXT_PUBLIC_SPOTIFY_UPDATE_RATE ?? '5', 10) * 1000

  async function sendControl(action: 'play' | 'pause' | 'next' | 'previous') {
    await fetch('/api/spotify/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    // Re-fetch immediately after control action
    await fetchPlayback()
  }

  async function fetchPlayback() {
    try {
      const res = await fetch('/api/spotify')
      if (!res.ok) return
      const data: SpotifyPlayback = await res.json()
      setPlayback(data)
      setLiveProgressMs(data.track?.progressMs ?? 0)
      lastPollMs.current = Date.now()

      // Fetch lyrics if track changed
      if (data.track && data.track.id !== lastTrackId.current) {
        lastTrackId.current = data.track.id
        fetchLyrics(data.track.title, data.track.artist, data.track.album)
      }
    } catch {
      // keep previous state on network error
    }
  }

  async function fetchLyrics(title: string, artist: string, album: string) {
    try {
      const params = new URLSearchParams({ title, artist, album })
      const res = await fetch(`/api/spotify/lyrics?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLyrics(data)
      } else {
        setLyrics(null)
      }
    } catch {
      setLyrics(null)
    }
  }

  useEffect(() => {
    fetchPlayback()
    const pollId = setInterval(fetchPlayback, interval)
    return () => clearInterval(pollId)
  }, [interval])

  // Smooth progress interpolation between polls (updates every second)
  useEffect(() => {
    const tickId = setInterval(() => {
      setPlayback((current) => {
        if (!current?.isPlaying || !current.track) return current
        const elapsed = Date.now() - lastPollMs.current
        const interpolated = Math.min(
          (current.track.progressMs + elapsed),
          current.track.durationMs
        )
        setLiveProgressMs(interpolated)
        return current
      })
    }, 1000)
    return () => clearInterval(tickId)
  }, [])

  return { playback, lyrics, liveProgressMs, sendControl }
}
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

### Task 2: Root Layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace `src/app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AutumnFaun Dashboard',
  description: 'Kindle e-ink dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=600, initial-scale=1, user-scalable=no" />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

---

### Task 3: Main Dashboard Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace `src/app/page.tsx`**

```typescript
'use client'

import { SteamSection } from '@/components/steam/SteamSection'
import { LeagueSection } from '@/components/league/LeagueSection'
import { NavButtons } from '@/components/layout/NavButtons'
import { Footer } from '@/components/layout/Footer'
import { useSteamData } from '@/hooks/useSteamData'
import { useLeagueData } from '@/hooks/useLeagueData'

const INK = '#1a1612'
const PAPER = '#e8e3d8'

export default function DashboardPage() {
  const steamData = useSteamData()
  const leagueData = useLeagueData()

  return (
    <div
      style={{
        width: 600,
        height: 800,
        background: PAPER,
        fontFamily: 'Georgia, "Times New Roman", serif',
        color: INK,
        padding: '20px 22px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        backgroundImage:
          'radial-gradient(circle at 20% 20%, rgba(0,0,0,0.015) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(0,0,0,0.02) 0%, transparent 50%)',
      }}
    >
      <SteamSection data={steamData} />
      <LeagueSection data={leagueData} />
      <NavButtons activePage="dashboard" />
      <Footer />
    </div>
  )
}
```

---

### Task 4: Spotify Page

**Files:**
- Create: `src/app/spotify/page.tsx`

- [ ] **Step 1: Create `src/app/spotify/page.tsx`**

```typescript
'use client'

import { SpotifySection } from '@/components/spotify/SpotifySection'
import { NavButtons } from '@/components/layout/NavButtons'
import { Footer } from '@/components/layout/Footer'
import { useSpotifyData } from '@/hooks/useSpotifyData'

const INK = '#1a1612'
const PAPER = '#e8e3d8'

export default function SpotifyPage() {
  const { playback, lyrics, liveProgressMs, sendControl } = useSpotifyData()

  return (
    <div
      style={{
        width: 600,
        height: 800,
        background: PAPER,
        fontFamily: 'Georgia, "Times New Roman", serif',
        color: INK,
        padding: '20px 22px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        backgroundImage:
          'radial-gradient(circle at 20% 20%, rgba(0,0,0,0.015) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(0,0,0,0.02) 0%, transparent 50%)',
      }}
    >
      <SpotifySection
        playback={playback}
        lyrics={lyrics}
        liveProgressMs={liveProgressMs}
        onAction={sendControl}
      />
      <NavButtons activePage="spotify" />
      <Footer />
    </div>
  )
}
```

---

### Task 5: Final Integration Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Add `STEAM_ID` to `.env`**

Before running, the `.env` must have `STEAM_ID`. Find your 64-bit Steam ID at `https://steamidfinder.com` and add:
```
STEAM_ID=76561198XXXXXXXXX
```

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

Expected: server starts on `http://localhost:3000`

- [ ] **Step 3: Test the image proxy**

Visit: `http://localhost:3000/api/image-proxy?url=https://ddragon.leagueoflegends.com/cdn/14.10.1/img/champion/Ahri.png`

Expected: a grayscale PNG of Ahri renders in the browser.

- [ ] **Step 4: Test the Steam API route**

Visit: `http://localhost:3000/api/steam`

Expected: JSON with `nowPlaying`, `topGames`, `totalGames`, `isOnline`, `personaname`.

If you see `Steam API error: 403`, the `STEAM_API_KEY` is invalid. If `Steam API error: 500`, `STEAM_ID` is wrong.

- [ ] **Step 5: Test the League API route**

Visit: `http://localhost:3000/api/league`

Expected: JSON with `profile`, `matches`, `topChamps`, `ddVersion`.

If you see a 403, the `LEAGUE_API_KEY` has expired (Riot dev keys expire every 24h — generate a new one at developer.riotgames.com).

- [ ] **Step 6: Set up Spotify OAuth**

Visit: `http://localhost:3000/api/spotify/auth`

Expected: redirects to Spotify login page. After authorizing, you'll see a page displaying:
```
SPOTIFY_REFRESH_TOKEN=AQXXX...
```

Copy that value into `.env` and restart the dev server (`Ctrl+C`, then `npm run dev`).

- [ ] **Step 7: Test the Spotify API route**

Visit: `http://localhost:3000/api/spotify`

Expected: JSON with `isPlaying` and `track` (or `null` if nothing is playing). Play something on Spotify first if needed.

- [ ] **Step 8: Load the main dashboard**

Visit: `http://localhost:3000`

Expected:
- Page renders at 600×800 fixed size
- STEAM section shows either "NOW PLAYING" card (if you're playing a game) or the "NOT PLAYING" fallback
- Top 3 most-played games with cover images (grayscale)
- LEAGUE section shows your profile, last 4 matches, top 3 champions
- Navigation buttons at bottom

- [ ] **Step 9: Load the Spotify page**

Visit: `http://localhost:3000/spotify`

Expected:
- SPOTIFY section shows current track with album art (grayscale), progress bar, controls
- LYRICS section shows synced lyrics if available (highlighted current line)
- If nothing is playing, shows "NOTHING PLAYING" state

- [ ] **Step 10: Test navigation between pages**

Click "Spotify View" → should navigate to `/spotify`
Click "Main Dashboard" → should navigate back to `/`

No page flicker or full reload (client-side navigation).

- [ ] **Step 11: Run type check and all tests**

```bash
npx tsc --noEmit && npx jest
```

Expected: no TypeScript errors, all tests pass.

- [ ] **Step 12: Build for production**

```bash
npm run build
```

Expected: build completes. Note any warnings about image domains — they're non-blocking since we use the image proxy.

- [ ] **Step 13: Final commit**

```bash
git add -A
git commit -m "feat: wire up pages with polling hooks and complete Kindle dashboard integration"
```

---

### Task 6: Kindle Deployment

**Files:**
- None (deployment instructions)

The app runs as a Next.js server. On your local network, the Kindle's browser can access it.

- [ ] **Step 1: Find your local IP**

Run (PowerShell):
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike '*Loopback*' } | Select-Object IPAddress
```

Note your local IP (e.g., `192.168.1.100`).

- [ ] **Step 2: Start dev server bound to all interfaces**

```bash
npm run dev -- -H 0.0.0.0
```

- [ ] **Step 3: Open on Kindle**

On the Kindle, open the experimental browser and navigate to:
```
http://192.168.1.100:3000
```

- [ ] **Step 4: Enable fullscreen on Kindle**

The Kindle browser has a fullscreen mode. Tap the menu (⋮) → View → Full Screen, or use Kindle's built-in reader mode if available.

- [ ] **Step 5: Keep the server running**

For a persistent setup, run the production build and use `npm start` instead of `npm run dev`:
```bash
npm run build && npm start
```

Or use `pm2` to keep it running:
```bash
npx pm2 start npm --name "kindle-dashboard" -- start
```

---

## Troubleshooting Reference

| Issue | Cause | Fix |
|-------|-------|-----|
| Steam returns empty games | `STEAM_ID` wrong or profile private | Check ID format (must be 64-bit); set Steam profile to public |
| League returns 403 | Dev API key expired | Generate new key at developer.riotgames.com (24h TTL) |
| League matches return 0 results | No recent games | Play a game, wait a few minutes |
| Spotify returns `SPOTIFY_REFRESH_TOKEN not set` | OAuth not done | Visit `/api/spotify/auth` |
| Spotify returns 403 on controls | Non-Premium account | Remove control buttons from SpotifyPlayer (playback control requires Premium) |
| Images not appearing | Proxy returning 400 | Check CDN domain is in `ALLOWED_HOSTNAMES` in `src/lib/image.ts` |
| Dashboard too large/small on Kindle | Viewport not matching | Check `<meta name="viewport" content="width=600">` in layout.tsx |
| Lyrics not showing | Track not in LRCLIB | LRCLIB may not have the track; the lyrics section shows "No lyrics available" |

---

**All 4 plans complete. The Kindle dashboard is fully implemented.**
