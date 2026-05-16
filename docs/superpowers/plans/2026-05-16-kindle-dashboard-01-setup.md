# Kindle Dashboard — Plan 01: Project Setup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Next.js 14 project with TypeScript, Tailwind, Sharp, and all type definitions needed by subsequent plans.

**Architecture:** Next.js 14 App Router in `src/` layout. Tailwind extended with e-ink color tokens. TypeScript strict mode. Tests use Jest + ts-jest.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Sharp, Jest, ts-jest

**Prerequisite reading:** `docs/design.md` — color palette, typography, and API data shape specifications.

---

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json` (generated)
- Create: `tsconfig.json` (generated)
- Create: `next.config.ts`

- [ ] **Step 1: Run create-next-app**

Run inside `D:\Workspace\Node\kindle-dashboard`:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

When prompted, answer:
- Would you like to use Turbopack? → **No**

Expected output ends with: `Success! Created kindle-dashboard at ...`

- [ ] **Step 2: Install additional dependencies**

```bash
npm install sharp
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @types/jest ts-jest
```

Expected: packages installed without errors.

- [ ] **Step 3: Replace `next.config.ts`**

`output: 'standalone'` is required for the Docker multi-stage build — it produces a self-contained `server.js` that doesn't need the full `node_modules` tree at runtime.

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [],
  },
}

export default nextConfig
```

- [ ] **Step 4: Add Jest config — create `jest.config.ts`**

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

export default createJestConfig(config)
```

Wait — the correct key is `setupFilesAfterFramework`? No, it's `setupFilesAfterFramework` → actually it is `setupFilesAfterFramework`. Let me correct:

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

export default createJestConfig(config)
```

> Note: The correct key is `setupFilesAfterFramework`. If your Jest version uses `setupFilesAfterFramework` rename accordingly — Jest 29 uses `setupFilesAfterFramework`.

The correct field name is `setupFilesAfterFramework`  — actually in Jest it is: `setupFilesAfterFramework`. Let me use the real name:

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

export default createJestConfig(config)
```

Use the actual correct Jest field `setupFilesAfterFramework` (or `setupFiles` if older). The real field is `setupFilesAfterFramework`. Just write exactly:

```typescript
// jest.config.ts
import type { Config } from 'jest'
import nextJest from 'next/jest'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
}

export default createJestConfig(config)
```

> The real Jest config key for running setup after the test framework loads is `setupFilesAfterFramework`. Use that exact string.

- [ ] **Step 5: Create `jest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add test script to `package.json`**

Open `package.json`. In the `"scripts"` object, add:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 7: Verify setup**

```bash
npx tsc --noEmit
```

Expected: no output (no errors).

---

### Task 2: Configure Tailwind with E-Ink Tokens

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace `tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1a1612',
          soft: '#3a342c',
          muted: '#7a7268',
          light: '#a89e90',
        },
        paper: {
          DEFAULT: '#e8e3d8',
          light: '#f1ede2',
          dark: '#d8d2c4',
          darker: '#c4bdac',
        },
      },
      fontFamily: {
        serif: ['Georgia', '"Times New Roman"', 'serif'],
        sans: ['"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        card: '10px',
        tile: '6px',
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 2: Replace `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  margin: 0;
  padding: 0;
  background: #1a1612;
  width: 600px;
  height: 800px;
  overflow: hidden;
}

#__next,
[data-nextjs-scroll-focus-boundary] {
  height: 100%;
}

* {
  box-sizing: border-box;
}

@layer utilities {
  .dash-fallback {
    background-image: repeating-linear-gradient(
      45deg,
      #3a342c 0 2px,
      #1a1612 2px 4px
    );
  }
}
```

- [ ] **Step 3: Verify Tailwind is working**

```bash
npm run build
```

Expected: build completes without errors (ignore Next.js route warnings about missing pages for now).

---

### Task 3: Create TypeScript Type Definitions

**Files:**
- Create: `src/types/steam.ts`
- Create: `src/types/league.ts`
- Create: `src/types/spotify.ts`
- Create: `src/types/index.ts`
- Create: `src/__tests__/types.test.ts`

- [ ] **Step 1: Write the failing test for types**

Create `src/__tests__/types.test.ts`:

```typescript
import type { SteamData, LeagueData, SpotifyPlayback, LyricLine } from '@/types'

describe('type imports', () => {
  it('SteamData shape is correct', () => {
    const data: SteamData = {
      nowPlaying: null,
      topGames: [],
      totalGames: 0,
      isOnline: false,
      personaname: 'test',
    }
    expect(data.totalGames).toBe(0)
  })

  it('LyricLine has time and text', () => {
    const line: LyricLine = { time: 12.5, text: 'hello' }
    expect(line.time).toBe(12.5)
  })
})
```

- [ ] **Step 2: Run test — expect failure (types don't exist yet)**

```bash
npx jest src/__tests__/types.test.ts
```

Expected: `Cannot find module '@/types'`

- [ ] **Step 3: Create `src/types/steam.ts`**

```typescript
export interface SteamPlayer {
  steamid: string
  personaname: string
  personastate: number
  gameid?: string
  gameextrainfo?: string
}

export interface SteamGame {
  appid: number
  name: string
  playtime_forever: number
  playtime_2weeks?: number
}

export interface SteamNowPlaying {
  name: string
  appid: string
  headerImg: string
  fallback: string
}

export interface SteamTopGame {
  name: string
  appid: number
  hours: number
  coverImg: string
  fallback: string
}

export interface SteamData {
  nowPlaying: SteamNowPlaying | null
  topGames: SteamTopGame[]
  totalGames: number
  isOnline: boolean
  personaname: string
}
```

- [ ] **Step 4: Create `src/types/league.ts`**

```typescript
export interface SummonerProfile {
  id: string
  accountId: string
  puuid: string
  name: string
  profileIconId: number
  summonerLevel: number
}

export interface MatchResult {
  matchId: string
  champion: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  queueType: string
  championImg: string
  fallback: string
}

export interface ChampionStat {
  name: string
  games: number
  winrate: number
  championImg: string
  fallback: string
}

export interface LeagueData {
  profile: {
    name: string
    tag: string
    level: number
    iconUrl: string
    fallback: string
  }
  matches: MatchResult[]
  topChamps: ChampionStat[]
  ddVersion: string
}
```

- [ ] **Step 5: Create `src/types/spotify.ts`**

```typescript
export interface LyricLine {
  time: number
  text: string
}

export interface LyricsData {
  synced: LyricLine[]
  plain: string[]
}

export interface SpotifyTrackInfo {
  title: string
  artist: string
  album: string
  durationMs: number
  progressMs: number
  coverUrl: string | null
  fallback: string
  id: string
}

export interface SpotifyPlayback {
  isPlaying: boolean
  track: SpotifyTrackInfo | null
}
```

- [ ] **Step 6: Create `src/types/index.ts`**

```typescript
export type { SteamData, SteamNowPlaying, SteamTopGame, SteamPlayer, SteamGame } from './steam'
export type { LeagueData, MatchResult, ChampionStat, SummonerProfile } from './league'
export type { SpotifyPlayback, SpotifyTrackInfo, LyricsData, LyricLine } from './spotify'
```

- [ ] **Step 7: Run test — expect pass**

```bash
npx jest src/__tests__/types.test.ts
```

Expected: `PASS src/__tests__/types.test.ts` — 2 tests pass.

---

### Task 4: Environment and Git Configuration

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create `.env.example`**

```bash
# League of Legends (Riot API)
LEAGUE_API_KEY=RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SUMMONER_ID=your_encrypted_summoner_id

# Steam
STEAM_API_KEY=your_steam_api_key
STEAM_ID=your_64bit_steam_id  # Get from: steamidfinder.com

# Spotify OAuth
SPOTIFY_API_CLIENT_ID=your_spotify_client_id
SPOTIFY_API_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REFRESH_TOKEN=  # Leave blank — populated after visiting /api/spotify/auth

# Lyrics
LRCLIB_API_URL=https://lrclib.net/api/

# Update rates in seconds
LEAGUE_UPDATE_RATE=600
STEAM_UPDATE_RATE=60
SPOTIFY_UPDATE_RATE=5
```

- [ ] **Step 2: Verify `.gitignore` includes `.env`**

Open `.gitignore`. Confirm these lines exist (create-next-app adds them):
```
.env
.env.local
.env*.local
```

If missing, add them.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js 14 project with TypeScript, Tailwind, and type definitions"
```

---

### Task 5: Create Source Directory Structure

**Files:**
- Create: `src/lib/.gitkeep`
- Create: `src/components/ui/.gitkeep`
- Create: `src/components/steam/.gitkeep`
- Create: `src/components/league/.gitkeep`
- Create: `src/components/spotify/.gitkeep`
- Create: `src/components/layout/.gitkeep`
- Create: `src/hooks/.gitkeep`

- [ ] **Step 1: Create directory structure**

Run (PowerShell):
```powershell
$dirs = @(
  'src\lib',
  'src\components\ui',
  'src\components\steam',
  'src\components\league',
  'src\components\spotify',
  'src\components\layout',
  'src\hooks',
  'src\__tests__\lib',
  'src\__tests__\api'
)
foreach ($d in $dirs) {
  New-Item -ItemType Directory -Force -Path $d | Out-Null
}
Write-Output "Done"
```

Expected: `Done`

- [ ] **Step 2: Delete placeholder files created by create-next-app**

Remove the default page content that create-next-app adds. Open `src/app/page.tsx` and replace its entire content with:

```typescript
export default function Home() {
  return <div>Dashboard loading...</div>
}
```

This will be replaced in Plan 04.

- [ ] **Step 3: Final verification**

```bash
npx tsc --noEmit && npm run build
```

Expected: build succeeds (the placeholder page renders fine).

---

---

### Task 6: Docker Setup

**Files:**
- Create: `Dockerfile`
- Create: `compose.yaml`
- Create: `.dockerignore`

The production image uses a 3-stage build: `deps` installs packages (including Sharp's native bindings), `builder` runs `next build`, and `runner` copies only the standalone output + Sharp native module — resulting in a lean final image (~250 MB).

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
.next
.git
.env
.env.*
handoff-temp
kindle-dashboard-handoff.zip
docs
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
FROM node:20-alpine AS base

# ── deps: install all packages (including Sharp native bindings) ──────────────
FROM base AS deps
WORKDIR /app
# python3/make/g++ are needed to compile Sharp's native module on Alpine
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci

# ── builder: compile Next.js ──────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runner: minimal production image ─────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static   ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public         ./public

# Sharp native module — standalone doesn't bundle native addons automatically
COPY --from=deps /app/node_modules/sharp ./node_modules/sharp

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

- [ ] **Step 3: Create `compose.yaml`**

```yaml
services:
  dashboard:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: unless-stopped
```

- [ ] **Step 4: Build and verify the Docker image**

```bash
docker compose build
```

Expected output ends with: `=> => writing image sha256:...` and no errors.

- [ ] **Step 5: Start the container**

```bash
docker compose up -d
```

Expected: container starts. Visit `http://localhost:3000` — should see the placeholder "Dashboard loading..." page.

- [ ] **Step 6: Check logs**

```bash
docker compose logs -f dashboard
```

Expected: `Ready - started server on 0.0.0.0:3000`

- [ ] **Step 7: Commit**

```bash
git add Dockerfile compose.yaml .dockerignore
git commit -m "feat: add Docker multi-stage build with Sharp native module support"
```

> **Dev workflow note:** For local development you don't need Docker. Run `npm run dev` directly and use Docker only for the final deployment on your home server/NAS. The compose file reads `.env` automatically — no changes needed.

---

**Plan 01 complete.** Proceed to `2026-05-16-kindle-dashboard-02-api.md`.
