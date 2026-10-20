# AutumnFaun Dashboard — TRMNL Plugin (LaraPaper)

Shows the Steam + League of Legends + Spotify dashboard as an e-ink image on a Kindle
(or any TRMNL-compatible device), served by a self-hosted [LaraPaper](https://github.com/usetrmnl/larapaper) server.

## How it works

```
Kindle (TRMNL client) ──every N s──► LaraPaper ──polls──► kindle-dashboard /api/trmnl (JSON)
        ▲                                │
        └──────── 600×800 PNG ◄──────────┘ renders template.html (Liquid) with headless Chrome
```

1. LaraPaper polls `https://YOUR_DASHBOARD/api/trmnl` for a JSON payload (Steam + League + Spotify).
2. It renders [`template.html`](template.html) (a Liquid template) with that data into a PNG sized for the device.
3. The Kindle downloads and displays the PNG on its refresh interval.

The image is static: the screen cannot have buttons (taps never reach the server), and it only
changes when the device refreshes.

## 1. Install LaraPaper

LaraPaper is a self-hosted TRMNL server ("BYOS"). Run it with Docker Compose next to the dashboard:

```yaml
# ~/larapaper/docker-compose.yml — based on docker/prod/docker-compose.yml from the LaraPaper repo
services:
  app:
    image: ghcr.io/usetrmnl/larapaper:latest
    ports:
      - "127.0.0.1:4567:8080"         # only reachable through the reverse proxy
    environment:
      - APP_KEY=${APP_KEY}            # from .env, see below
      - APP_URL=https://trmnl.example.com
      - FORCE_HTTPS=true              # HTTPS is terminated by nginx
      - TRUSTED_PROXIES=*
      - REGISTRATION_ENABLED=1        # set to 0 after creating your account
      - APP_TIMEZONE=America/Sao_Paulo
      - PHP_OPCACHE_ENABLE=1
      - TRMNL_PROXY_REFRESH_MINUTES=15
      - DB_DATABASE=database/storage/database.sqlite
    volumes:
      - database:/var/www/html/database/storage
      - storage:/var/www/html/storage/app/public/images/generated
    restart: unless-stopped
volumes:
  database:
  storage:
```

```bash
cd ~/larapaper
echo "APP_KEY=base64:$(openssl rand -base64 32)" > .env
docker compose up -d
```

Put it behind your reverse proxy with HTTPS. Example nginx site (then run
`sudo certbot --nginx -d trmnl.example.com`):

```nginx
server {
    listen 80;
    server_name trmnl.example.com;
    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:4567;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Open `https://trmnl.example.com`, register your account, then set `REGISTRATION_ENABLED=0`
and run `docker compose up -d` again so nobody else can sign up.

**Updating:** `docker compose pull && docker compose up -d`.
**Backup:** the SQLite database lives in the `database` volume
(`docker cp <container>:/var/www/html/database/storage/database.sqlite backup.sqlite`).

## 2. Create a device model for the Kindle

LaraPaper renders each screen at the size of the device's **model**. Without a model it falls back
to the original TRMNL (800×480 landscape), and this 600×800 portrait template comes out cut off.
The built-in Kindle models are landscape and rotated, so create one for a portrait Kindle
(Kindle 10th gen / Paperwhite 1–3 / Kindle 7: 600×800 at 167 PPI):

**Device Models → Add**

| Field | Value |
|---|---|
| Name (Identifier) | `amazon_kindle_10_portrait` |
| Label | `Amazon Kindle 10th Gen (portrait)` |
| Width / Height | `600` / `800` |
| Colors / Bit Depth | `256` / `8` |
| Color Palette | `256 Grays` |
| Rotation | `0` |
| Scale Factor | `1` |
| MIME Type | `image/png` |
| Offset X / Y | `0` / `0` |
| CSS Model Identifier | *(empty)* |
| CSS Variables | `--screen-w` = `600px`, `--screen-h` = `800px`, `--ui-scale` = `1.0`, `--gap-scale` = `1.0` |

The CSS variables are what size the render canvas; width/height alone are not enough.

## 3. Connect the Kindle

Install a TRMNL client on the Kindle and point it at your LaraPaper URL — see the e-reader
clients listed in the [LaraPaper README](https://github.com/usetrmnl/larapaper#key-features)
(Kindle, KOReader, Kobo, Nook). Then add the device in LaraPaper:

- **Auto-Join:** enable "Permit Auto-Join" in the header, start the client once, and the device
  appears in **Devices**; disable Auto-Join afterwards.
- **Manually:** **Devices → Add New Device** with the device's MAC address and API key.

Edit the device and set:

- **Device model:** the `amazon_kindle_10_portrait` model from step 2
- **Refresh interval:** how often the Kindle fetches a new image. `60` s follows Spotify track
  changes within about a minute; longer intervals save battery (each refresh wakes Wi-Fi and redraws the panel).

## 4. Create the plugin

**Plugins & Recipes → New Recipe**

| Field | Value |
|---|---|
| Data strategy | **Polling** |
| Polling URL | `https://YOUR_DASHBOARD/api/trmnl` |
| Polling verb | `GET` |
| Data stale minutes | `1` (refetch the JSON at most once a minute) |
| Markup language | **Liquid** |
| Markup (full) | the full contents of [`template.html`](template.html) |

Then **Playlists → Create Playlist** for the device and add the plugin to it.

`template.html` is a markup **fragment** (a `<style>` block plus `<div class="layout">`).
LaraPaper wraps it in its own HTML document with the TRMNL framework CSS and `.screen`/`.view`
elements, so do not add `<html>`, `<head>`, `plugins.css` or `.screen` to it: reloading
`plugins.css` resets the canvas to 800×480.

## Sections

- **Steam** — online status, the game being played (*Now playing*) or, when not in game, the *Last played* one with how long ago (from Steam's `rtime_last_played`), top 3 games by hours, total games.
- **League of Legends** — profile and level, last 4 matches with KDA and W/L, top 3 champions with winrate.
- **Spotify** — album cover, track and artist. Shows *Now playing* while a track plays and keeps
  the *Last played* track when playback stops. Requires `SPOTIFY_REFRESH_TOKEN`
  (see [Spotify](../README.md#spotify) in the main README).

Data comes from the dashboard's server-side cache: a failed API call (Riot rate limit, expired key,
Spotify offline) never replaces good data, so the screen keeps the last successful values instead
of going blank. If an API never returned data, its section shows a short "unavailable" message.

## Payload schema

`GET /api/trmnl` returns this shape (all fields are always present; `null` / `[]` means no data).
`steam_now_playing*` are only set while in game; `steam_game*` hold the current game or, when not playing, the last played one:

```json
{
  "steam_online": true,
  "steam_username": "AutumnFaun",
  "steam_now_playing": "Elden Ring",
  "steam_now_playing_img": "https://cdn.../header.jpg",
  "steam_playing": true,
  "steam_game": "Elden Ring",
  "steam_game_img": "https://cdn.../header.jpg",
  "steam_last_played": "3 days ago",
  "steam_games": [{ "name": "Elden Ring", "hours": 120, "img": "https://..." }],
  "steam_total_games": 200,
  "league_name": "AutumnFaun",
  "league_tag": "#SH4C0",
  "league_level": 312,
  "league_icon": "https://ddragon.../icon/123.png",
  "league_matches": [{ "champion": "Jinx", "win": true, "kda": "10/2/5", "queue": "Ranked Solo", "img": "https://..." }],
  "league_top_champs": [{ "rank": 1, "name": "Jinx", "games": 15, "winrate": 67, "img": "https://..." }],
  "spotify_playing": true,
  "spotify_title": "Bohemian Rhapsody",
  "spotify_artist": "Queen",
  "spotify_cover": "https://i.scdn.co/image/..."
}
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Content cut off at the top, bottom half blank | The device has no model (renders at 800×480), or the markup reloads `plugins.css`. See steps 2 and 4. |
| League shows "unavailable" | Riot key expired (dev keys last 24 h) or rate limited (429). Check `docker logs` of the dashboard. Once data loads it is kept through later failures. |
| Spotify shows "Nothing played yet" | No `SPOTIFY_REFRESH_TOKEN`, or nothing played since it was set. Play a track and wait one refresh. |
| Screen updates slowly | Lower the device refresh interval and the plugin's data stale minutes. |
