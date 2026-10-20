# KOReader plugin — design

**Date:** 2026-10-20 · **Status:** implemented (first version, pending on-device testing)

## Goal

Turn the Kindle (10th gen, 600×800 portrait) into a small hub that refreshes more often and reacts to
taps, replacing the fullscreen browser, which runs no JavaScript and reloads the whole page.

First version: a dashboard tab (Steam + League), a Spotify tab with synced lyrics, and playback controls.
Out of scope: keeping the device awake (left to KOReader's own autosuspend settings) and auth on the
control endpoint (already public for `/spotify`).

## Approach: hybrid

Chosen over "all native widgets" and "all server images":

- **Dashboard** is rendered on the server as a PNG (`/api/kindle/dashboard.png?w=&h=`, `next/og`
  `ImageResponse` + `sharp` grayscale) and shown with an `ImageWidget`. Its look changes on the
  server without touching the Kindle, and the Lua stays small.
- **Spotify** is native KOReader widgets, because it needs per-line partial refreshes and buttons.
  It reuses `/api/spotify`, `/api/spotify/lyrics`, `/api/image-proxy` and `/api/spotify/control`.

## Server

- `src/lib/dashboard-image.tsx` — the `/kindle` design rebuilt in flexbox (Satori has no tables).
  Images are fetched server-side, converted to grayscale data URIs and memoised per URL; a failed
  image leaves an empty frame. Fonts: Noto Serif / Noto Sans TTFs in `assets/fonts` (OFL), copied
  into the Docker image.
- `src/app/api/kindle/dashboard.png/route.ts` — reads the Steam/League server cache (missing data
  renders as "unavailable"), size clamped to 200–2000 px, `Cache-Control: no-store`.

## Plugin (`koreader-plugin/kindledash.koplugin`)

| Unit | Responsibility |
|---|---|
| `main.lua` | Menu (open dashboard / Spotify, server URL, dashboard interval), dispatcher actions for gestures, opens the hub when online |
| `kdash_hub.lua` | Full-screen `InputContainer`: tab bar (Dashboard, Spotify, Close), swipe to switch, owns the content region, `setContent` / `refreshRegion` |
| `kdash_dashboard.lua` | Downloads the PNG every N s (default 60) to a temp file then renames; shows last session's image at once; `full` refresh every 10th update |
| `kdash_spotify.lua` | Polls every 5 s; on track change downloads cover + lyrics and redraws with `flashui`; otherwise refreshes only the progress region; local clock schedules a tick at the next lyric line and redraws only the lyrics box (`ui`, `flashui` every 15th); optimistic play/pause, re-poll 0.8 s after a command, errors shown under the buttons |
| `kdash_lyrics.lua` | Pure: current line, seconds to next line, clock position, resync (track/state change or drift > 1.5 s), pause/resume |
| `kdash_api.lua` | LuaSocket client, 5 s block / 15 s total timeouts, JSON helpers, safe downloads |
| `kdash_ui.lua` | Fonts; `region(w, h, child)` = `FrameContainer` (records painted dimen) around a fixed-size `CenterContainer` (FrameContainer alone sizes to its content) |

Network calls are blocking; first fetches are scheduled 0.3 s after a tab switch so the switch paints first.

## Testing

- Server: Jest tests for the PNG route (size parsing, missing data, render failure).
- Plugin: pure-Lua tests in `koreader-plugin/spec/` (lyrics clock, URL building); all files
  syntax-checked and linted with luacheck. Widget code is verified on the device.
