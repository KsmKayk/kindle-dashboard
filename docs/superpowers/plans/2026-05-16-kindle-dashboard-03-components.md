# Kindle Dashboard — Plan 03: UI Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all React UI components matching the handoff design pixel-perfectly. Components use Tailwind classes where convenient and inline styles where pixel-precise control is needed (matching the handoff).

**Architecture:** Client components only (all use `'use client'`). Props are typed against `src/types/`. Images go through `/api/image-proxy`. No CSS transitions in the Lyrics component (e-ink ghost prevention).

**Tech Stack:** React 18, TypeScript, Tailwind CSS.

**Prerequisite:** Plans 01 and 02 complete. Types exist. API routes exist.

**Design reference:** `docs/design.md` — color values, font sizes, border radii.

---

### Color constants (copy into every component that needs them)

```typescript
const INK = '#1a1612'
const INK_SOFT = '#3a342c'
const INK_MUTED = '#7a7268'
const PAPER = '#e8e3d8'
const PAPER_LIGHT = '#f1ede2'
const PAPER_DARK = '#d8d2c4'
const PAPER_DARKER = '#c4bdac'
```

Border radii for `variant="rounded"`:

```typescript
const R = { card: 10, tile: 6, pill: 9999, avatar: 9999, bar: 2 }
```

---

### Task 1: DashImg — Image with Grayscale Proxy + Fallback

**Files:**
- Create: `src/components/ui/DashImg.tsx`

- [ ] **Step 1: Create `src/components/ui/DashImg.tsx`**

```typescript
'use client'

import { useState } from 'react'

const INK = '#1a1612'
const INK_SOFT = '#3a342c'
const PAPER_LIGHT = '#f1ede2'

interface DashImgProps {
  src: string | null | undefined
  fallback: string
  alt: string
  radius?: number
}

function proxyUrl(src: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(src)}`
}

export function DashImg({ src, fallback, alt, radius = 0 }: DashImgProps) {
  const [failed, setFailed] = useState(false)

  if (failed || !src) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: INK_SOFT,
          backgroundImage: `repeating-linear-gradient(45deg, ${INK_SOFT} 0 2px, ${INK} 2px 4px)`,
          color: PAPER_LIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.5,
          textAlign: 'center',
          padding: 3,
          borderRadius: radius,
          boxSizing: 'border-box',
          lineHeight: 1.1,
          whiteSpace: 'pre-line',
        }}
      >
        {fallback}
      </div>
    )
  }

  return (
    <img
      src={proxyUrl(src)}
      alt={alt}
      onError={() => setFailed(true)}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        filter: 'contrast(1.3) brightness(0.95)',
        display: 'block',
        borderRadius: radius,
      }}
    />
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

### Task 2: SectionHeader and WinrateBar

**Files:**
- Create: `src/components/ui/SectionHeader.tsx`
- Create: `src/components/ui/WinrateBar.tsx`

- [ ] **Step 1: Create `src/components/ui/SectionHeader.tsx`**

```typescript
const INK = '#1a1612'
const INK_MUTED = '#7a7268'

interface SectionHeaderProps {
  label: string
  meta?: string
}

export function SectionHeader({ label, meta }: SectionHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span
        style={{
          fontFamily: '"Helvetica Neue", Arial, sans-serif',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2.5,
          color: INK,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: INK }} />
      {meta && (
        <span
          style={{
            fontFamily: '"Helvetica Neue", Arial, sans-serif',
            fontSize: 9,
            letterSpacing: 1.5,
            color: INK_MUTED,
          }}
        >
          {meta}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/ui/WinrateBar.tsx`**

```typescript
const INK = '#1a1612'
const PAPER_DARKER = '#c4bdac'

interface WinrateBarProps {
  value: number
  radius?: number
}

export function WinrateBar({ value, radius = 2 }: WinrateBarProps) {
  return (
    <div
      style={{
        width: '100%',
        height: 4,
        background: PAPER_DARKER,
        borderRadius: radius,
        overflow: 'hidden',
        border: `1px solid ${INK}`,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: `${Math.min(100, Math.max(0, value))}%`, height: '100%', background: INK }} />
    </div>
  )
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

### Task 3: NavButtons

**Files:**
- Create: `src/components/layout/NavButtons.tsx`

- [ ] **Step 1: Create `src/components/layout/NavButtons.tsx`**

```typescript
'use client'

import { useRouter } from 'next/navigation'

const INK = '#1a1612'
const PAPER = '#e8e3d8'

interface NavButtonsProps {
  activePage: 'dashboard' | 'spotify'
}

export function NavButtons({ activePage }: NavButtonsProps) {
  const router = useRouter()

  const baseStyle: React.CSSProperties = {
    height: 34,
    border: `1px solid ${INK}`,
    borderRadius: 10,
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.5,
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
      <button
        onClick={() => router.push('/')}
        style={{
          ...baseStyle,
          background: activePage === 'dashboard' ? INK : 'transparent',
          color: activePage === 'dashboard' ? PAPER : INK,
        }}
      >
        {activePage === 'dashboard' && (
          <span style={{ width: 6, height: 6, background: PAPER, borderRadius: 9999, display: 'inline-block' }} />
        )}
        {activePage !== 'dashboard' && (
          <span style={{ fontSize: 14, lineHeight: 1, marginTop: -1 }}>‹</span>
        )}
        Main Dashboard
      </button>
      <button
        onClick={() => router.push('/spotify')}
        style={{
          ...baseStyle,
          background: activePage === 'spotify' ? INK : 'transparent',
          color: activePage === 'spotify' ? PAPER : INK,
        }}
      >
        {activePage === 'spotify' && (
          <span style={{ width: 6, height: 6, background: PAPER, borderRadius: 9999, display: 'inline-block' }} />
        )}
        Spotify View
        {activePage !== 'spotify' && (
          <span style={{ fontSize: 14, lineHeight: 1, marginTop: -1 }}>›</span>
        )}
      </button>
    </div>
  )
}
```

---

### Task 4: Footer

**Files:**
- Create: `src/components/layout/Footer.tsx`

- [ ] **Step 1: Create `src/components/layout/Footer.tsx`**

```typescript
const INK = '#1a1612'

export function Footer() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 10 }}>
      <div style={{ flex: 1, height: 1, background: INK, opacity: 0.3, maxWidth: 140 }} />
      <div
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: 11,
          letterSpacing: 3,
          color: INK,
          fontWeight: 400,
          fontStyle: 'italic',
        }}
      >
        AutumnFaun Dashboard
      </div>
      <div style={{ flex: 1, height: 1, background: INK, opacity: 0.3, maxWidth: 140 }} />
    </div>
  )
}
```

---

### Task 5: Steam Components

**Files:**
- Create: `src/components/steam/NowPlaying.tsx`
- Create: `src/components/steam/GameCard.tsx`
- Create: `src/components/steam/TotalGamesCard.tsx`
- Create: `src/components/steam/SteamSection.tsx`

- [ ] **Step 1: Create `src/components/steam/NowPlaying.tsx`**

```typescript
import { DashImg } from '@/components/ui/DashImg'
import type { SteamNowPlaying } from '@/types'

const INK = '#1a1612'
const INK_MUTED = '#7a7268'
const PAPER_LIGHT = '#f1ede2'

interface NowPlayingProps {
  game: SteamNowPlaying | null
}

export function NowPlaying({ game }: NowPlayingProps) {
  const cardStyle: React.CSSProperties = {
    background: PAPER_LIGHT,
    border: `1px solid ${INK}`,
    borderRadius: 10,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    padding: 9,
    gap: 12,
    height: 70,
    marginBottom: 10,
  }

  if (!game) {
    return (
      <div style={cardStyle}>
        <div style={{ flex: 1, fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: 11, color: INK_MUTED, letterSpacing: 1.5 }}>
          NOT PLAYING
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <div style={{ width: 52, height: 52, borderRadius: 6, overflow: 'hidden', border: `1px solid ${INK}`, flexShrink: 0 }}>
        <DashImg src={game.headerImg} fallback={game.fallback} alt={game.name} radius={6} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: 8, fontWeight: 700, letterSpacing: 2.2, color: INK_MUTED }}>
            NOW PLAYING
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: 8, fontWeight: 700, letterSpacing: 1.5, color: INK }}>
            <span style={{ width: 6, height: 6, background: INK, borderRadius: 9999, display: 'inline-block' }} />
            LIVE
          </div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.15, fontFamily: 'Georgia, serif', letterSpacing: -0.3, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {game.name}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/steam/GameCard.tsx`**

```typescript
import { DashImg } from '@/components/ui/DashImg'
import type { SteamTopGame } from '@/types'

const INK = '#1a1612'
const INK_MUTED = '#7a7268'
const PAPER_LIGHT = '#f1ede2'

interface GameCardProps {
  game: SteamTopGame
}

export function GameCard({ game }: GameCardProps) {
  return (
    <div style={{ background: PAPER_LIGHT, border: `1px solid ${INK}`, borderRadius: 10, boxSizing: 'border-box', padding: 10, height: 86, display: 'flex', alignItems: 'stretch', gap: 10 }}>
      <div style={{ width: 66, height: 66, borderRadius: 6, overflow: 'hidden', border: `1px solid ${INK}`, flexShrink: 0 }}>
        <DashImg src={game.coverImg} fallback={game.fallback} alt={game.name} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 2, paddingBottom: 2 }}>
        <div style={{ fontSize: 12, lineHeight: 1.2, fontWeight: 700, fontFamily: 'Georgia, serif', color: INK, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', letterSpacing: -0.1 }}>
          {game.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontFamily: '"Helvetica Neue", Arial, sans-serif' }}>
          <span style={{ fontSize: 8, letterSpacing: 1.5, color: INK_MUTED }}>PLAYED</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Georgia, serif', color: INK, letterSpacing: -0.5 }}>
            {game.hours}<span style={{ fontSize: 11, fontWeight: 400 }}>h</span>
          </span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/steam/TotalGamesCard.tsx`**

```typescript
const INK = '#1a1612'
const PAPER = '#e8e3d8'

interface TotalGamesCardProps {
  total: number
}

export function TotalGamesCard({ total }: TotalGamesCardProps) {
  return (
    <div style={{ background: INK, color: PAPER, border: `1px solid ${INK}`, borderRadius: 10, boxSizing: 'border-box', padding: 10, height: 86, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 48, fontWeight: 700, lineHeight: 1, letterSpacing: -2 }}>
        {total}
      </div>
      <div style={{ flex: 1, borderLeft: `1px solid ${PAPER}`, paddingLeft: 12 }}>
        <div style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: 9, letterSpacing: 2, opacity: 0.75, marginBottom: 2 }}>TOTAL</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.2 }}>
          Games<br />Owned
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/components/steam/SteamSection.tsx`**

```typescript
import { SectionHeader } from '@/components/ui/SectionHeader'
import { NowPlaying } from './NowPlaying'
import { GameCard } from './GameCard'
import { TotalGamesCard } from './TotalGamesCard'
import type { SteamData } from '@/types'

interface SteamSectionProps {
  data: SteamData | null
}

export function SteamSection({ data }: SteamSectionProps) {
  const meta = data ? `${data.personaname} · ${data.isOnline ? 'online' : 'offline'}` : 'loading...'

  const placeholderGames = Array(3).fill(null)
  const games = data?.topGames ?? placeholderGames

  return (
    <div style={{ marginBottom: 10 }}>
      <SectionHeader label="STEAM" meta={meta} />
      <NowPlaying game={data?.nowPlaying ?? null} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {games.slice(0, 3).map((g, i) =>
          g ? <GameCard key={g.appid} game={g} /> : <div key={i} style={{ height: 86, background: '#d8d2c4', borderRadius: 10, border: '1px solid #1a1612' }} />
        )}
        <TotalGamesCard total={data?.totalGames ?? 0} />
      </div>
    </div>
  )
}
```

---

### Task 6: League of Legends Components

**Files:**
- Create: `src/components/league/ProfileBanner.tsx`
- Create: `src/components/league/MatchCard.tsx`
- Create: `src/components/league/ChampionRow.tsx`
- Create: `src/components/league/LeagueSection.tsx`

- [ ] **Step 1: Create `src/components/league/ProfileBanner.tsx`**

```typescript
import { DashImg } from '@/components/ui/DashImg'

const INK = '#1a1612'
const INK_MUTED = '#7a7268'
const PAPER_LIGHT = '#f1ede2'

interface ProfileBannerProps {
  name: string
  tag: string
  level: number
  iconUrl: string
  fallback: string
}

export function ProfileBanner({ name, tag, level, iconUrl, fallback }: ProfileBannerProps) {
  return (
    <div style={{ background: PAPER_LIGHT, border: `1px solid ${INK}`, borderRadius: 10, boxSizing: 'border-box', display: 'flex', alignItems: 'center', padding: 12, gap: 14, height: 68, marginBottom: 8 }}>
      <div style={{ width: 44, height: 44, borderRadius: 9999, border: `1px solid ${INK}`, overflow: 'hidden', flexShrink: 0 }}>
        <DashImg src={iconUrl} fallback={fallback} alt={name} radius={9999} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Georgia, serif', letterSpacing: -0.3, lineHeight: 1.1 }}>
          {name}<span style={{ color: INK_MUTED, fontWeight: 400, fontSize: 13 }}>{tag}</span>
        </div>
        <div style={{ fontSize: 9, letterSpacing: 2, fontFamily: '"Helvetica Neue", Arial, sans-serif', color: INK_MUTED, marginTop: 3 }}>
          SUMMONER LEVEL
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Georgia, serif', lineHeight: 1, letterSpacing: -1 }}>
          {level}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/league/MatchCard.tsx`**

```typescript
import { DashImg } from '@/components/ui/DashImg'
import type { MatchResult } from '@/types'

const INK = '#1a1612'
const INK_MUTED = '#7a7268'
const PAPER_LIGHT = '#f1ede2'
const PAPER_DARK = '#d8d2c4'
const PAPER = '#e8e3d8'

interface MatchCardProps {
  match: MatchResult
}

export function MatchCard({ match }: MatchCardProps) {
  return (
    <div style={{ background: match.win ? PAPER_LIGHT : PAPER_DARK, border: `1px solid ${INK}`, borderRadius: 10, boxSizing: 'border-box', padding: 8, height: 60, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 40, height: 40, borderRadius: 9999, overflow: 'hidden', border: `1px solid ${INK}`, flexShrink: 0 }}>
        <DashImg src={match.championImg} fallback={match.fallback} alt={match.champion} radius={9999} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 8, letterSpacing: 1.2, fontFamily: '"Helvetica Neue", Arial, sans-serif', color: INK_MUTED }}>
          {match.queueType.toUpperCase()}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Georgia, serif', lineHeight: 1.1, letterSpacing: -0.2, marginTop: 1 }}>
          {match.kills}<span style={{ color: INK_MUTED, margin: '0 2px' }}>/</span>
          {match.deaths}<span style={{ color: INK_MUTED, margin: '0 2px' }}>/</span>
          {match.assists}
        </div>
      </div>
      <div style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: '3px 8px', borderRadius: 9999, background: match.win ? INK : 'transparent', color: match.win ? PAPER : INK, border: match.win ? 'none' : `1px solid ${INK}`, flexShrink: 0 }}>
        {match.win ? 'W' : 'L'}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/league/ChampionRow.tsx`**

```typescript
import { DashImg } from '@/components/ui/DashImg'
import { WinrateBar } from '@/components/ui/WinrateBar'
import type { ChampionStat } from '@/types'

const INK = '#1a1612'
const INK_MUTED = '#7a7268'
const PAPER_LIGHT = '#f1ede2'
const PAPER = '#e8e3d8'

interface ChampionRowProps {
  champ: ChampionStat
  rank: number
}

export function ChampionRow({ champ, rank }: ChampionRowProps) {
  return (
    <div style={{ background: PAPER_LIGHT, border: `1px solid ${INK}`, borderRadius: 10, boxSizing: 'border-box', padding: 7, height: 50, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 20, height: 20, borderRadius: 9999, border: `1px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, fontFamily: 'Georgia, serif', background: rank === 1 ? INK : 'transparent', color: rank === 1 ? PAPER : INK, flexShrink: 0 }}>
        {rank}
      </div>
      <div style={{ width: 34, height: 34, borderRadius: 9999, overflow: 'hidden', border: `1px solid ${INK}`, flexShrink: 0 }}>
        <DashImg src={champ.championImg} fallback={champ.fallback} alt={champ.name} radius={9999} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Georgia, serif', lineHeight: 1, letterSpacing: -0.2 }}>
          {champ.name}
        </div>
        <div style={{ fontSize: 9, letterSpacing: 0.5, fontFamily: '"Helvetica Neue", Arial, sans-serif', color: INK_MUTED, marginTop: 2 }}>
          {champ.games} games played
        </div>
      </div>
      <div style={{ width: 140, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <WinrateBar value={champ.winrate} radius={2} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Georgia, serif', letterSpacing: -0.3, minWidth: 32, textAlign: 'right' }}>
          {champ.winrate}%
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/components/league/LeagueSection.tsx`**

```typescript
import { SectionHeader } from '@/components/ui/SectionHeader'
import { ProfileBanner } from './ProfileBanner'
import { MatchCard } from './MatchCard'
import { ChampionRow } from './ChampionRow'
import type { LeagueData } from '@/types'

const INK = '#1a1612'
const PAPER_DARK = '#d8d2c4'

interface LeagueSectionProps {
  data: LeagueData | null
}

export function LeagueSection({ data }: LeagueSectionProps) {
  return (
    <div style={{ marginBottom: 10 }}>
      <SectionHeader label="LEAGUE OF LEGENDS" meta="ranked solo · season 14" />

      {data ? (
        <ProfileBanner
          name={data.profile.name}
          tag={data.profile.tag}
          level={data.profile.level}
          iconUrl={data.profile.iconUrl}
          fallback={data.profile.fallback}
        />
      ) : (
        <div style={{ height: 68, background: PAPER_DARK, borderRadius: 10, border: `1px solid ${INK}`, marginBottom: 8 }} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        {(data?.matches ?? Array(4).fill(null)).map((match, i) =>
          match ? (
            <MatchCard key={match.matchId} match={match} />
          ) : (
            <div key={i} style={{ height: 60, background: PAPER_DARK, borderRadius: 10, border: `1px solid ${INK}` }} />
          )
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(data?.topChamps ?? Array(3).fill(null)).map((champ, i) =>
          champ ? (
            <ChampionRow key={champ.name} champ={champ} rank={i + 1} />
          ) : (
            <div key={i} style={{ height: 50, background: PAPER_DARK, borderRadius: 10, border: `1px solid ${INK}` }} />
          )
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui src/components/steam src/components/league src/components/layout
git commit -m "feat: add Steam and League UI components matching e-ink design"
```

---

### Task 7: Spotify Components

**Files:**
- Create: `src/components/spotify/PlayerControls.tsx`
- Create: `src/components/spotify/SpotifyPlayer.tsx`
- Create: `src/components/spotify/LyricsDisplay.tsx`
- Create: `src/components/spotify/SpotifySection.tsx`

- [ ] **Step 1: Create `src/components/spotify/PlayerControls.tsx`**

```typescript
'use client'

const INK = '#1a1612'
const PAPER = '#e8e3d8'

const IconPrev = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 5h2.2v14H6V5zM21 5v14L9.5 12 21 5z" />
  </svg>
)
const IconNext = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.8 5H18v14h-2.2V5zM3 19V5l11.5 7L3 19z" />
  </svg>
)
const IconPlay = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 5v14l13-7L7 5z" />
  </svg>
)
const IconPause = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4.5h3.5v15H7v-15zM13.5 4.5H17v15h-3.5v-15z" />
  </svg>
)

interface PlayerControlsProps {
  isPlaying: boolean
  onAction: (action: 'play' | 'pause' | 'next' | 'previous') => void
}

function ControlButton({
  children,
  primary = false,
  size = 36,
  onClick,
}: {
  children: React.ReactNode
  primary?: boolean
  size?: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        border: `1px solid ${INK}`,
        background: primary ? INK : 'transparent',
        color: primary ? PAPER : INK,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

export function PlayerControls({ isPlaying, onAction }: PlayerControlsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <ControlButton size={32} onClick={() => onAction('previous')}>
        <IconPrev size={14} />
      </ControlButton>
      <ControlButton size={44} primary onClick={() => onAction(isPlaying ? 'pause' : 'play')}>
        {isPlaying ? <IconPause size={20} /> : <IconPlay size={20} />}
      </ControlButton>
      <ControlButton size={32} onClick={() => onAction('next')}>
        <IconNext size={14} />
      </ControlButton>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/spotify/SpotifyPlayer.tsx`**

```typescript
import { DashImg } from '@/components/ui/DashImg'
import { PlayerControls } from './PlayerControls'
import type { SpotifyTrackInfo } from '@/types'

const INK = '#1a1612'
const INK_MUTED = '#7a7268'
const PAPER_LIGHT = '#f1ede2'
const PAPER_DARK = '#d8d2c4'
const PAPER_DARKER = '#c4bdac'

interface SpotifyPlayerProps {
  track: SpotifyTrackInfo | null
  isPlaying: boolean
  liveProgressMs: number
  onAction: (action: 'play' | 'pause' | 'next' | 'previous') => void
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SpotifyPlayer({ track, isPlaying, liveProgressMs, onAction }: SpotifyPlayerProps) {
  const cardStyle: React.CSSProperties = {
    background: PAPER_LIGHT,
    border: `1px solid ${INK}`,
    borderRadius: 10,
    boxSizing: 'border-box',
    padding: 14,
    marginBottom: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  }

  if (!track) {
    return (
      <div style={cardStyle}>
        <div style={{ height: 110, width: 110, background: PAPER_DARK, borderRadius: 6, marginBottom: 10, border: `1px solid ${INK}` }} />
        <div style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: 11, color: INK_MUTED, letterSpacing: 2 }}>
          NOTHING PLAYING
        </div>
      </div>
    )
  }

  const progressFraction = track.durationMs > 0 ? liveProgressMs / track.durationMs : 0
  const progressPct = Math.min(100, Math.max(0, progressFraction * 100))

  return (
    <div style={cardStyle}>
      <div style={{ width: 110, height: 110, borderRadius: 6, overflow: 'hidden', border: `1px solid ${INK}`, marginBottom: 10 }}>
        <DashImg src={track.coverUrl} fallback={track.fallback} alt={track.title} radius={6} />
      </div>

      <div style={{ textAlign: 'center', lineHeight: 1.15, marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Georgia, serif', letterSpacing: -0.3 }}>
          {track.title}
        </div>
        <div style={{ fontSize: 12, color: INK, marginTop: 3, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
          {track.artist}
        </div>
        <div style={{ fontSize: 9, color: INK_MUTED, marginTop: 4, fontFamily: '"Helvetica Neue", Arial, sans-serif', letterSpacing: 1.5 }}>
          {track.album.toUpperCase()}
        </div>
      </div>

      <div style={{ width: '100%', marginBottom: 14 }}>
        <div style={{ position: 'relative', width: '100%', height: 4, background: PAPER_DARKER, borderRadius: 2, border: `1px solid ${INK}` }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: INK }} />
          <div style={{ position: 'absolute', left: `${progressPct}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 10, height: 10, background: INK, borderRadius: 9999, border: `2px solid ${PAPER_LIGHT}` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: 9, letterSpacing: 1, color: INK_MUTED }}>
          <span>{formatTime(liveProgressMs)}</span>
          <span>{formatTime(track.durationMs)}</span>
        </div>
      </div>

      <PlayerControls isPlaying={isPlaying} onAction={onAction} />
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/spotify/LyricsDisplay.tsx`**

**Design rationale:** The Kindle e-ink screen takes ~1–2 seconds to fully refresh after the browser redraws. Spotify polling runs every 10 s (see `SPOTIFY_UPDATE_RATE`). The lyrics box must therefore show the **current line plus all lines within the next 12 seconds**, so the user can read ahead and not miss a line while the screen is refreshing. Showing only the current line would leave it blank for most of the refresh cycle.

Layout: current line is large and bold (21px), upcoming lines shrink progressively (16px → 13px → 11px) and fade out, so the hierarchy guides the eye forward. One past line is shown at minimum opacity as context anchor. No CSS transitions (e-ink ghost prevention).

```typescript
import type { LyricLine } from '@/types'

const INK = '#1a1612'
const INK_MUTED = '#7a7268'

// How many seconds of upcoming lyrics to keep visible.
// Set to 12 to give the Kindle ~10 s poll interval + 2 s refresh buffer.
const LYRICS_LOOKAHEAD_SECONDS = 12

interface LyricsDisplayProps {
  lyrics: LyricLine[]
  currentTimeSeconds: number
}

function getCurrentLineIndex(lyrics: LyricLine[], timeSeconds: number): number {
  let idx = 0
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time <= timeSeconds) idx = i
    else break
  }
  return idx
}

function fontSizeForOffset(offset: number): number {
  // offset 0 = current, 1 = next, 2 = two ahead, etc.
  if (offset === 0) return 21
  if (offset === 1) return 16
  if (offset === 2) return 13
  return 11
}

function opacityForOffset(offset: number, isPast: boolean): number {
  if (offset === 0) return 1
  if (isPast) return 0.35
  if (offset === 1) return 0.85
  if (offset === 2) return 0.65
  return 0.45
}

export function LyricsDisplay({ lyrics, currentTimeSeconds }: LyricsDisplayProps) {
  const containerStyle: React.CSSProperties = {
    flex: 1,
    border: `1px dashed ${INK}`,
    borderRadius: 10,
    padding: '16px 24px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    gap: 2,
    background: 'transparent',
    marginBottom: 12,
    overflow: 'hidden',
  }

  if (lyrics.length === 0) {
    return (
      <div style={{ ...containerStyle, justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', fontFamily: 'Georgia, serif', fontSize: 14, fontStyle: 'italic', color: INK_MUTED }}>
          No lyrics available
        </div>
      </div>
    )
  }

  const currentIdx = getCurrentLineIndex(lyrics, currentTimeSeconds)
  const windowEnd = currentTimeSeconds + LYRICS_LOOKAHEAD_SECONDS

  // Always show 1 past line for context, then current, then everything up to windowEnd
  const pastIdx = Math.max(0, currentIdx - 1)
  let endIdx = currentIdx + 1
  while (endIdx < lyrics.length && lyrics[endIdx].time <= windowEnd) {
    endIdx++
  }

  const visible = lyrics.slice(pastIdx, endIdx)

  return (
    <div style={containerStyle}>
      {visible.map((line, i) => {
        const actualIdx = pastIdx + i
        const isCurrent = actualIdx === currentIdx
        const isPast = actualIdx < currentIdx
        const offset = actualIdx - currentIdx  // negative = past, 0 = current, positive = future

        return (
          <div
            key={actualIdx}
            style={{
              textAlign: 'center',
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: fontSizeForOffset(Math.abs(offset)),
              fontWeight: isCurrent ? 700 : 400,
              fontStyle: isCurrent ? 'normal' : 'italic',
              color: INK,
              opacity: opacityForOffset(Math.abs(offset), isPast),
              lineHeight: 1.35,
              letterSpacing: isCurrent ? -0.3 : 0,
              padding: isCurrent ? '6px 0' : '2px 0',
            }}
          >
            {line.text}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Create `src/components/spotify/SpotifySection.tsx`**

```typescript
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SpotifyPlayer } from './SpotifyPlayer'
import { LyricsDisplay } from './LyricsDisplay'
import type { SpotifyPlayback, LyricsData } from '@/types'

const INK = '#1a1612'

interface SpotifySectionProps {
  playback: SpotifyPlayback | null
  lyrics: LyricsData | null
  liveProgressMs: number
  onAction: (action: 'play' | 'pause' | 'next' | 'previous') => void
}

export function SpotifySection({ playback, lyrics, liveProgressMs, onAction }: SpotifySectionProps) {
  const currentTimeSeconds = liveProgressMs / 1000
  const synced = lyrics?.synced ?? []

  return (
    <>
      <SectionHeader label="SPOTIFY" meta="autumnfaun · streaming" />
      <SpotifyPlayer
        track={playback?.track ?? null}
        isPlaying={playback?.isPlaying ?? false}
        liveProgressMs={liveProgressMs}
        onAction={onAction}
      />
      <SectionHeader label="LYRICS" meta={synced.length > 0 ? 'synced' : 'plain'} />
      <LyricsDisplay lyrics={synced} currentTimeSeconds={currentTimeSeconds} />
    </>
  )
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/spotify
git commit -m "feat: add Spotify player, lyrics display, and controls components"
```

---

**Plan 03 complete.** Proceed to `2026-05-16-kindle-dashboard-04-pages.md`.
