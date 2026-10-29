# Kindle Dashboard — KOReader plugin

A [KOReader](https://github.com/koreader/koreader) plugin that turns the Kindle into a small
dashboard, full screen, with four tabs:

- **Dashboard** — Steam + League of Legends, as on `/kindle`. The server renders it as a grayscale
  PNG sized to the screen (`/api/kindle/dashboard.png`) and the plugin downloads it every 60 s.
- **Spotify** — album cover, track, progress, **Prev / Play-Pause / Next** buttons and
  **synced lyrics**. The plugin polls `/api/spotify` every 5 s and a local clock moves the lyrics
  between polls; each line change redraws only the lyrics box, without flashing the whole screen.
- **Work** — GitHub (PRs opened and reviewed, commits, open PRs, review queue, deploys) and Claude
  usage, as a server-rendered PNG (`/api/kindle/work.png`), refreshed like the Dashboard tab.
- **Servers** — CPU, RAM, disks, RAID, SMART, containers and site health checks of your servers
  (`/api/kindle/servers.png`). Both new tabs need the access token when the server sets one.

Switch tabs with the buttons in the top bar or by swiping left/right. **Close** returns to KOReader.

```
Kindle (KOReader + kindledash.koplugin)            kindle-dashboard server
  Dashboard tab ── every 60 s ───────────────────► /api/kindle/dashboard.png?w=&h=
  Work tab      ── every 60 s ───────────────────► /api/kindle/work.png?w=&h=
  Servers tab   ── every 60 s ───────────────────► /api/kindle/servers.png?w=&h=
  Spotify tab   ── every 5 s ────────────────────► /api/spotify
                ── once per track ───────────────► /api/spotify/lyrics, /api/image-proxy (cover)
                ── on tap ───────────────────────► POST /api/spotify/control
```

## Install

1. **Jailbreak the Kindle and install KUAL** (see [Kindle Setup](../README.md#kindle-setup) in the main README).
2. **Install KOReader** — download `koreader-kindlepw2-*.zip` from the
   [KOReader releases](https://github.com/koreader/koreader/releases) (the `kindlepw2` build covers
   the Kindle 10th gen, Paperwhite 2+ and newer), unzip it at the root of the Kindle over USB, and
   start it from KUAL → **KOReader**.
3. **Copy the plugin** — copy the `kindledash.koplugin` folder into `koreader/plugins/` on the
   Kindle, then restart KOReader.
4. **Open it** — top menu → **Tools** (wrench) → **Kindle Dashboard** → **Open dashboard**.

## Settings

In **Tools → Kindle Dashboard**:

| Setting | Default |
|---|---|
| Server | *not set*: your kindle-dashboard URL, e.g. `https://dashboard.example.com` (asked the first time you open the plugin) |
| Access token | *not set*: the server's `KINDLE_API_TOKEN`, needed for the Spotify, Work and Servers tabs when the server sets one |
| Image tabs refresh | 60 s (minimum 15) |

To open it with a gesture, add **Kindle Dashboard** (or **Kindle Dashboard: Spotify**, **Kindle Dashboard: Work** or **Kindle Dashboard: Servers**) to a
gesture in **Settings → Taps and gestures → Gesture manager**: the actions are listed under *General*.

## Keeping the screen on

The plugin only updates while the Kindle is awake. If KOReader suspends the device after some
idle time, disable or lengthen that in KOReader's settings (**Device → Autosuspend timeout** /
**Autostandby**) when you want to leave it running as a dashboard. Wi-Fi stays on while the plugin
is open, so battery lasts hours rather than weeks: keep it plugged in for an always-on display.

## Notes

- The Spotify buttons need Spotify Premium and an active device (errors are shown under the buttons).
- The dashboard image keeps the last good one when the server is unreachable; the Spotify tab keeps
  the last track on screen.
- Every 10th dashboard update and every 15th lyric change flash the screen to clear e-ink ghosting.
- Downloaded files (dashboard image, cover) live in `koreader/cache/kindledash/`.

## Development

The plugin is plain Lua (LuaJIT, KOReader's widget toolkit). Pure logic is tested without KOReader:

```bash
cd koreader-plugin
lua spec/lyrics_test.lua   # lyric line / playback clock
lua spec/api_test.lua      # URL building
lua spec/tabs_test.lua     # tab order / width
```

Files in `kindledash.koplugin/`:

| File | Role |
|---|---|
| `main.lua` | Registers the menu entry, gesture actions and settings; opens the hub |
| `kdash_hub.lua` | Full-screen window: tab bar, active view, partial refreshes |
| `kdash_image.lua` | Image tabs (Dashboard, Work, Servers): downloads and shows a server PNG |
| `kdash_tabs.lua` | Pure helpers: tab order, tab width |
| `kdash_spotify.lua` | Spotify tab (polling, lyrics clock, controls) |
| `kdash_lyrics.lua` | Pure helpers: current lyric line, playback clock |
| `kdash_api.lua` | HTTP client (LuaSocket, short timeouts) |
| `kdash_ui.lua` | Fonts and fixed-size refreshable regions |

Module names carry a `kdash_` prefix because KOReader shares one `require` cache between plugins.
