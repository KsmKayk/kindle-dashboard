# AutumnFaun Dashboard — TRMNL Plugin

Displays the Steam + League of Legends dashboard on any TRMNL-compatible e-ink device.

## How it works

1. TRMNL polls your server's `/api/trmnl` endpoint for a JSON payload (Steam + League data).
2. TRMNL renders `template.html` (Liquid template) with the polled data on its cloud infrastructure.
3. The rendered image is pushed to your e-ink device.

Images (Steam covers, champion icons) are loaded from their original public CDN URLs — no local proxy needed.

## Setup

### 1. Make your server reachable from the internet

TRMNL's cloud must reach `https://YOUR_SERVER/api/trmnl`.

Options:
- Deploy on a VPS (see the main README for Docker instructions)
- Use [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) for zero-config HTTPS
- Use `ngrok http 3000` for quick local testing

### 2. Create a private plugin in TRMNL

1. Go to **Plugins → Private Plugin → New Plugin**
2. Set **Strategy** to **Polling**
3. Set **Polling URL** to `https://YOUR_SERVER/api/trmnl`
4. Paste the full contents of `template.html` into the **Markup** field
5. Save

### 3. Add the plugin to your device playlist

1. Go to your device in the TRMNL dashboard
2. Add the private plugin to its playlist
3. Set the **refresh interval** to match `STEAM_UPDATE_RATE` (default: 60 seconds)

## Notes

- League data has its own TTL (`LEAGUE_UPDATE_RATE`, default 600 s).
- If an API is unavailable, the relevant section shows "unavailable" instead of crashing.
- Spotify is not included in this plugin yet (see the project roadmap).
