# AutumnFaun Kindle Dashboard — Design Reference

Exported from Claude Design (claude.ai/design). This document is the single source of truth for visual and structural decisions when building the Next.js implementation.

---

## Target Device

- **Screen**: Kindle Paperwhite (portrait), browser viewport **600 × 800 px**
- **Orientation**: Portrait primary; landscape variant exists but is not the primary target
- **Browser**: Kindle's WebKit/Chromium-based browser
- **Note**: CSS transitions should be minimal to avoid e-ink ghosting

---

## Design Philosophy

E-ink / paper aesthetic. No bright colors, no shadows that feel digital. The palette mimics aged paper with ink letterpress type. Fonts are serif-first (Georgia) with Helvetica Neue for labels and metadata.

---

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `ink` | `#1a1612` | Primary text, borders, fills |
| `ink-soft` | `#3a342c` | Image fallback background |
| `ink-muted` | `#7a7268` | Secondary text, metadata |
| `ink-light` | `#a89e90` | Tertiary text |
| `paper` | `#e8e3d8` | Page background |
| `paper-light` | `#f1ede2` | Card background (win state, default card) |
| `paper-dark` | `#d8d2c4` | Card background (loss state) |
| `paper-darker` | `#c4bdac` | Progress bar track, borders |

---

## Typography

| Role | Font | Size | Weight | Letter-spacing |
|------|------|------|--------|---------------|
| Section label | Helvetica Neue | 10px | 700 | 2.5 |
| Section meta | Helvetica Neue | 9px | 400 | 1.5 |
| Game title | Georgia | 12px | 700 | -0.1 |
| Now playing title | Georgia | 18px | 700 | -0.3 |
| Hours number | Georgia | 18px | 700 | -0.5 |
| Summoner name | Georgia | 18px | 700 | -0.3 |
| Summoner level | Georgia | 28px | 700 | -1 |
| Total games count | Georgia | 48–54px | 700 | -1.5 |
| KDA | Georgia | 14px | 700 | -0.2 |
| Champion name | Georgia | 14px | 700 | -0.2 |
| Winrate % | Georgia | 13px | 700 | -0.3 |
| Track title | Georgia | 20–21px | 700 | -0.3 |
| Track artist | Georgia | 12px | 400 | 0 (italic) |
| Track album | Helvetica Neue | 9px | 400 | 1.5 |
| Lyrics (current) | Georgia | 21px | 700 | -0.3 |
| Lyrics (adjacent) | Georgia | 14px | 400 | 0 (italic) |
| Lyrics (far) | Georgia | 12px | 400 | 0 (italic) |
| Button | Georgia | 12px | 700 | 0.5 |
| Footer | Georgia | 11px | 400 | 3 (italic) |

---

## Image Treatment

**Requirement**: All remote images must be converted to grayscale **server-side** before serving to the browser. The image proxy route (`/api/image-proxy`) handles this using Sharp.

Client-side CSS applies additional tuning: `filter: contrast(1.3) brightness(0.95)` for e-ink depth. Images that fail to load fall back to a dithered pattern (`repeating-linear-gradient(45deg, ink-soft 0 2px, ink 2px 4px)`) with the game/champion abbreviation centered.

---

## Border Radius (rounded variant)

| Token | Value |
|-------|-------|
| `card` | 10px |
| `tile` | 6px |
| `pill` | 9999px |
| `avatar` | 9999px (circle) |
| `bar` | 2px |

The design uses `variant="rounded"`. The square variant (radius 0) is not used.

---

## Views

### View 1: Main Dashboard (`/`)

Layout: single column, `600 × 800`, padding `20px 22px 16px`.

**Sections (top to bottom):**

#### STEAM section
- Section header: `STEAM` label + `autumnfaun · online` meta
- **Now Playing card** (height: 70px): game thumbnail (52×52), "NOW PLAYING" label, game title, session detail, `LIVE` dot indicator
- **Games grid** (2×2, gap: 8px): 3 game cards + 1 total-count card
  - Game card (height: 86px): horizontal — cover image (66×66), name (2-line clamp), "PLAYED" label + hours
  - Total card (height: 86px): dark ink background, large number (48px), "TOTAL / Games Owned"

#### LEAGUE OF LEGENDS section
- Section header: `LEAGUE OF LEGENDS` label + `ranked solo · season 14` meta
- **Profile banner** (height: 68px): avatar (44×44, circle), summoner name + tag, "SUMMONER LEVEL" label, level number (28px)
- **Matches grid** (2×2, gap: 8px, height per card: 60px): champion icon (40×40, circle), mode label, K/D/A, W/L badge
  - Win cards: `paper-light` background, filled ink W badge
  - Loss cards: `paper-dark` background, outlined L badge
- **Top 3 Champions** (stacked, gap: 6px, height per row: 50px): rank circle (20×20), champion icon (34×34, circle), name + games count, winrate bar + %

#### Navigation + Footer
- Two buttons: `Main Dashboard` (active, filled ink) + `Spotify View` (outline, navigates to `/spotify`)
- Footer: centered italic `AutumnFaun Dashboard` with flanking hairlines

---

### View 2: Spotify View (`/spotify`)

Layout: single column, `600 × 800`, padding `20px 22px 16px`.

**Sections (top to bottom):**

#### SPOTIFY section
- Section header: `SPOTIFY` + `autumnfaun · streaming` meta

#### Player card
- Album art (110×110, tile radius)
- Track title (20px, centered)
- Artist (12px italic, centered)
- Album name (9px uppercase, centered, muted)
- Progress bar with handle dot; elapsed/total timestamps
- Controls: Prev (32×32) + Play/Pause (44×44, primary filled) + Next (32×32)

#### LYRICS section
- Dashed border card (flex 1, fills remaining space)
- Shows ≈6 lyric lines, centered
  - Current line: 21px bold
  - ±1 distance: 14px italic, 85% opacity
  - ±2+ distance: 12px italic, 55% opacity
  - No CSS transitions (omit for Kindle e-ink compatibility)

#### Navigation + Footer
- Two buttons: `Main Dashboard` (outline) + `Spotify View` (active, filled ink)
- Footer: same as main dashboard

---

## API Data Sources

### Steam
- **Base**: `https://api.steampowered.com`
- Env vars: `STEAM_API_KEY`, `STEAM_ID` (**must be added to .env** — 64-bit Steam ID)
- Update rate: `STEAM_UPDATE_RATE=60` seconds
- Endpoints used:
  - `ISteamUser/GetPlayerSummaries/v0002` — online status, currently playing game
  - `IPlayerService/GetOwnedGames/v0001` — total games count + playtime data
  - `IPlayerService/GetRecentlyPlayedGames/v0001` — top recently played

### League of Legends
- **Platform**: `https://br1.api.riotgames.com` (Brazil server)
- **Regional**: `https://americas.api.riotgames.com` (Match V5)
- **Data Dragon**: `https://ddragon.leagueoflegends.com`
- Env vars: `LEAGUE_API_KEY`, `SUMMONER_ID` (encrypted summoner ID — already in .env)
- Update rate: `LEAGUE_UPDATE_RATE=600` seconds
- Endpoints used:
  - `/lol/summoner/v4/summoners/{summonerId}` — profile + PUUID
  - `/lol/match/v5/matches/by-puuid/{puuid}/ids?count=20` — recent match IDs
  - `/lol/match/v5/matches/{matchId}` — match details (K/D/A)
  - `/lol/champion-mastery/v4/champion-masteries/by-summoner/{summonerId}/top?count=5` — top champs
  - `https://ddragon.leagueoflegends.com/api/versions.json` — current patch

### Spotify
- Env vars: `SPOTIFY_API_CLIENT_ID`, `SPOTIFY_API_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN` (**added after OAuth flow**)
- Update rate: `SPOTIFY_UPDATE_RATE=5` seconds
- OAuth scopes: `user-read-currently-playing user-read-playback-state user-modify-playback-state`
- Endpoints used:
  - `POST https://accounts.spotify.com/api/token` — token refresh
  - `GET https://api.spotify.com/v1/me/player/currently-playing` — now playing
  - `PUT https://api.spotify.com/v1/me/player/play` — resume
  - `PUT https://api.spotify.com/v1/me/player/pause` — pause
  - `POST https://api.spotify.com/v1/me/player/next` — skip
  - `POST https://api.spotify.com/v1/me/player/previous` — previous

### Lyrics
- **Base**: `https://lrclib.net/api/`
- `GET /get?artist_name=...&track_name=...&album_name=...` → synced + plain lyrics
- Synced format: `[00:12.50] Line text` (parsed to `{ time: number, text: string }[]`)

---

## Missing .env Variables (must be added by user)

| Variable | Description | How to get |
|----------|-------------|------------|
| `STEAM_ID` | 64-bit Steam ID | Visit steamidfinder.com or check Steam profile URL |
| `SPOTIFY_REFRESH_TOKEN` | OAuth refresh token | Visit `/api/spotify/auth` after deploying, follow prompts |

---

## Notes for Implementation

- **Image proxy security**: Only proxy images from approved CDN domains (Steam, Riot Data Dragon, Spotify CDN). Reject other URLs with 400.
- **Spotify playback controls**: Require Spotify Premium. If the API returns 403, log and ignore.
- **League of Legends winrate**: Computed from the last 20 matches per champion (from the match history fetch). Top 3 champions shown are those with the most games in recent history, falling back to mastery API ordering.
- **No page refresh**: All data updates via `setInterval` client-side polling. The dashboard page never reloads.
- **Kindle browser viewport**: Set `<meta name="viewport" content="width=600">` to prevent mobile scaling.
- **CSS transitions**: Omit all transitions in Lyrics display. Keep them only in NavButton hover states but they're non-critical on Kindle.
- **Lyrics lookahead**: Show current line + all lines within the next **12 seconds**, not just the single current line. Kindle e-ink refresh takes 1–2 s and Spotify polling runs every 10 s, so the user needs to see upcoming lines in advance. One past line is shown at 35% opacity as a context anchor. Font sizes descend from the current line (21px) down to upcoming lines (16px → 13px → 11px).
- **Deployment**: The app runs inside Docker (multi-stage build, `output: standalone`). `compose.yaml` reads `.env` via `env_file`. Dev workflow uses `npm run dev` directly without Docker.
