# Work and Servers tabs — design

Date: 2026-10-29
Status: approved in brainstorming, pending spec review

## Goal

Add two tabs to the KOReader plugin, next to Dashboard and Spotify:

- **Work** — GitHub activity (PRs opened, PRs reviewed, commits, repos, open PRs, review queue, deploys)
  and Claude usage (5-hour session limit, weekly limit, Claude Code tokens).
- **Servers** — status of the two servers: Oracle (`129.148.25.68`, arm64, runs this dashboard) and
  kayk-server (home, x86_64, behind NAT and NordVPN): CPU, RAM, temperatures, network, disks, RAID,
  SMART, containers and their host ports, plus HTTP health checks of the public sites.

The KOReader plugin is the main target. The mockups used during brainstorming are in
`.superpowers/brainstorm/` (`work-servers-v3.html` is the approved one).

## Out of scope

- Browser versions of these tabs (`/kindle`, the React app, TRMNL).
- The work Claude account (the user's work computer uses another account; it is not tracked).
- Alerts or notifications of any kind.
- Claude API cost estimates and per-container RAM/CPU (offered, not chosen).

## Architecture

```
                         ┌───────────────── Oracle server ─────────────────────┐
 Kindle (KOReader)       │  kindle-dashboard (Next.js)                         │
  Work tab ── 60 s ────► │   GET /api/kindle/work.png     ◄── lib/github.ts ───┼──► GitHub API
  Servers tab ─ 60 s ──► │   GET /api/kindle/servers.png  ◄── health checks ───┼──► public sites
                         │   POST /api/claude/report  ◄───────────────────┐    │
                         │   POST /api/servers/report ◄──┐                │    │
                         │                               │                │    │
                         │  server-agent (container) ────┘ (localhost)    │    │
                         └────────────────────────────────────────────────┼────┘
 kayk-server (home)                                                       │
  server-agent (container) ── HTTPS, outbound, every 60 s ──► public URL ─┤
 This PC (Windows)                                                        │
  claude-reporter (Task Scheduler) ── HTTPS, every 5 min ─────────────────┘
```

Data that can only be read on a given machine (server metrics, the Claude login and logs) is
**pushed** to the dashboard by a small reporter running on that machine. The home server only makes
outbound requests, so it needs no open port, VPN or tunnel and works alongside NordVPN. GitHub and the
health checks are **pulled** by the dashboard itself.

## 1. KOReader plugin

- Tab bar: **Dashboard · Spotify · Work · Servers · ✕**. Tab width is computed from the screen width
  (`(width - close - paddings) / 4`) instead of the fixed `TAB_WIDTH = 150`, which no longer fits 600 px.
- `kdash_dashboard.lua` becomes a generic image view (`kdash_image.lua`) taking the server path and the
  cache file name. Three instances:
  - Dashboard → `/api/kindle/dashboard.png`, `dashboard.png`
  - Work → `/api/kindle/work.png`, `work.png`
  - Servers → `/api/kindle/servers.png`, `servers.png`
- All three share the existing "Dashboard refresh" setting (default 60 s), the "keep last image on
  failure" behaviour and the full e-ink refresh every 10th update.
- The plugin sends the configured access token on all image downloads (today it is only sent on the
  Spotify calls).
- Gesture actions: add **Kindle Dashboard: Work** and **Kindle Dashboard: Servers**, like the existing
  Spotify one.

## 2. Server: images and routes

- Shared rendering pieces move out of `src/lib/dashboard-image.tsx` into `src/lib/image-kit.tsx`:
  colours, fonts, `card`, section header, meter bar, the PNG conversion (8-bit grayscale via Sharp).
  `dashboard-image.tsx` keeps only the Steam + League layout.
- New renderers: `src/lib/work-image.tsx` and `src/lib/servers-image.tsx`, following the approved
  mockup (`work-servers-v3.html`). Layout uses flexbox only (Satori).
- New routes, same shape as `/api/kindle/dashboard.png` (`?w=&h=`, `no-store`):
  - `GET /api/kindle/work.png`
  - `GET /api/kindle/servers.png`
- Both routes are added to the `KINDLE_API_TOKEN` matcher in `src/proxy.ts`: they show company PR titles
  and server details.
- A section with no data yet (GitHub token missing, no Claude report received) renders a short
  "not configured" / "waiting for first report" line instead of failing the whole image.

## 3. GitHub (`src/lib/github.ts`)

Config: `GITHUB_TOKEN` (classic PAT with `repo` scope; verified on 2026-10-29 that the search API returns
the user's `iclinic` org PRs with such a token, without org approval), `GITHUB_DEPLOY_REPOS`
(comma-separated `owner/repo` list), `GITHUB_UPDATE_RATE` (seconds, default 600).

Periods: **week** = since Monday 00:00, **month** = since the 1st 00:00, **12 months** = the last 365 days;
all in `TZ` (the container's timezone, set to `America/Sao_Paulo` in `.env`).

| Figure | Definition | Source |
|---|---|---|
| PRs opened (week / month / 12-month average) | PRs authored by the user, by creation date; average = 12-month count ÷ 12 | Search `author:@me is:pr created:>=…` (`total_count`) |
| PRs reviewed (week / month / 12-month average) | Distinct PRs by other authors with at least one review by the user **submitted** in the period | GraphQL search `reviewed-by:@me -author:@me is:pr updated:>=<12 months ago>`, paginated, reading the user's reviews' `submittedAt` |
| Commits (week / month) and 12-week bars | Commits authored by the user, grouped by day | Search commits `author:@me committer-date:>=…`, paginated per month (search returns at most 1000 results per query) |
| Streak | Consecutive days, ending today or yesterday, with at least one commit | Same commit list |
| Most contributed repo (12 months / month) | Repo with the most commits in the period | Same commit list |
| Time to merge | Median `mergedAt − createdAt` of the user's PRs merged in the last 30 days | GraphQL search `author:@me is:pr is:merged merged:>=…` |
| Lines +/− (month) | Sum of `additions` / `deletions` of the user's PRs merged this month | Same query |
| My open PRs (up to 3) | Title, repo, number, CI state of the last commit (`statusCheckRollup`), approval count, age | GraphQL search `author:@me is:pr is:open` |
| Waiting for my review (up to 3) | Title, repo, number, author, age | GraphQL search `review-requested:@me is:pr is:open` |
| Deploys | Latest workflow run on the default branch of each `GITHUB_DEPLOY_REPOS` entry: conclusion and time | REST `GET /repos/{repo}/actions/runs?branch=<default>&per_page=1` |

Known limitation (shown nowhere, documented in the README): commit search only covers commits on each
repository's default branch.

Caching uses `server-cache.ts`: a `github-fast` entry (week/month figures, lists, deploys) on
`GITHUB_UPDATE_RATE`, and a `github-slow` entry (12-month figures, commit history) refreshed hourly.
That keeps search usage well under GitHub's 30 search requests per minute.

The computations (period boundaries, review de-duplication, streak, median, most-contributed repo) are
pure functions over fetched data, tested with fixtures.

## 4. Claude reporter (`claude-reporter/`)

Runs on this Windows PC only (Claude Pro, personal account).

- `report.mjs`: plain Node (≥ 20), no dependencies. Run every 5 minutes by a Windows Task Scheduler task
  created by `install.ps1` (hidden window). Config in `claude-reporter/config.json` (git-ignored, from a
  `config.example.json`): dashboard URL and `REPORT_TOKEN`.
- **Limits:** reads `accessToken` from `~/.claude/.credentials.json` and calls
  `GET https://api.anthropic.com/api/oauth/usage` (header `anthropic-beta: oauth-2025-04-20`), the
  undocumented endpoint Claude Code uses for `/usage`. Reads `five_hour` and `seven_day`
  (`utilization`, `resets_at`). It **never refreshes the token**: refreshing would rotate it and could log
  Claude Code out. If the call fails (expired token, endpoint changed), the report goes out without limits
  and the server keeps the last limits it received, shown with their timestamp.
- **Tokens:** reads `~/.claude/projects/**/*.jsonl` incrementally, keeping per-file byte offsets in
  `claude-reporter/state.json`. Assistant entries with `message.usage` are counted once, de-duplicated by
  `message.id` + `requestId`. Per local day it sums `input`, `output`, `cache_creation_input` and
  `cache_read_input` tokens, split by model and by project (the project folder name). Days older than 35
  are dropped from the state.
- Sends `POST /api/claude/report` with `Authorization: Bearer <REPORT_TOKEN>`:
  `{ limits: { fiveHour: {utilization, resetsAt}, sevenDay: {…}, at } | null, days: [{ date, total, input, output, cacheWrite, cacheRead, byModel: {…}, byProject: {…} }] }`.

Displayed on the Work tab:
- 5h session % with time until reset (dark card), weekly % with reset day and time.
- Tokens today / this week / this month (total of the four token kinds), 14-day bars.
- Cache rate = `cacheRead / (input + cacheWrite + cacheRead)` this month; model split (share of total
  tokens) this month; top project this month.
- Header shows "atualizado HH:MM", or "sem dados há X" when the last report is older than 30 minutes.

## 5. Server agent (`server-agent/`)

- `agent.mjs` (plain Node, no dependencies), `Dockerfile` (`node:22-alpine` + `smartmontools`; builds on
  arm64 and x86_64), `compose.yaml`, `config.example.json`. Installed on each server with
  `docker compose up -d --build` from a checkout of this repo.
- Container: `privileged: true` (SMART needs raw device access), `network_mode: host` (host network
  counters; Oracle reaches the dashboard on `localhost`), `pid: host`, `/var/run/docker.sock` mounted.
  Host files are read through `/proc/1/root` (the host init's root, visible with `pid: host`), not a bind
  mount of `/`: under snap Docker (Oracle) such a mount shows the snap's own tree. Root-equivalent on the host. Does not depend on the user being in the `docker`
  group.
- Config (`config.json`, git-ignored): `id`, display `name`, dashboard URL, `REPORT_TOKEN`, `mounts`
  (host paths to report, e.g. `["/", "/mnt/raid1"]`), interval (default 60 s).
- Every interval it collects and sends `POST /api/servers/report`:
  - **System:** hostname, arch, uptime, CPU % (from the `/proc/stat` change since the previous report), load, core count, RAM
    total/used (`MemTotal − MemAvailable`), CPU temperature (`/sys/class/hwmon`, `/sys/class/thermal`,
    omitted when absent), network rx/tx bytes per second (sum of non-loopback, non-virtual interfaces).
  - **Disks:** for each configured mount: used/total (`statfs` on `/proc/1/root<mount>`; a configured mount
    that is not mounted is reported with device `?` and shown as "não montado"), the backing device
    and, for md devices, the RAID info below.
  - **RAID:** parsed from `/proc/mdstat`: device, level, `[UU]` state, member disks, active/total count,
    resync/recovery progress when present.
  - **SMART:** `smartctl -j -H -A` per physical disk (the mount's disk, or each RAID member): overall
    health, temperature, reallocated and pending sector counts.
  - **Containers:** Docker Engine API over the socket (`/containers/json?all=1`): name, state, status
    text, published host ports (or "interna" when none).
- Real layout today: Oracle reports `/` (`/dev/sda1`, 184 GB); kayk-server reports `/` (LVM on `sda`,
  500 GB) and `/mnt/raid1` (`md0`, RAID 1 over `sdb1` + `sdc1`, 1.8 TB).

## 6. Server: reports (`src/lib/reports.ts`)

- `POST /api/claude/report` and `POST /api/servers/report` require `Authorization: Bearer <REPORT_TOKEN>`
  (new env var, compared in constant time like `KINDLE_API_TOKEN`). Missing `REPORT_TOKEN` = the routes
  return 503, so reports are never accepted unauthenticated.
- Bodies are validated (shape and sizes); invalid → 400.
- The latest report per source (`claude`, `server:<id>`) is saved to the `.cache` volume with its
  receive time, so it survives restarts and deploys. A Claude report without limits keeps the previous
  limits.
- **Health checks:** `HEALTHCHECK_URLS` (comma-separated `label=url`). The dashboard requests each one
  (GET, 5 s timeout) on the same interval as the Servers image, caching results for 60 s: status code
  and latency; non-2xx/3xx or timeout = down.

## 7. Servers tab rendering rules

- One section per server in config order (Oracle first, then kayk-server): header (name, arch,
  uptime, temperature or network), CPU / RAM / main-disk meters, storage card (one row per mount; RAID
  mounts grouped in a framed block with level, `[UU]`, members with SMART status and temperature),
  containers in two columns (name, host ports), then the health-check card at the bottom.
- **Dark (attention) state** for a card when: the server has not reported for 3 minutes ("sem dados há
  X"), RAID is degraded (any `_` in the state) or resyncing, SMART health fails or reallocated/pending
  sectors > 0, RAM or a disk ≥ 90%, a container is not running, a health check is down.

## 8. Environment variables (new)

| Variable | Where | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | dashboard | GitHub PAT (`repo`) |
| `GITHUB_DEPLOY_REPOS` | dashboard | Repos shown under "Últimos deploys" |
| `GITHUB_UPDATE_RATE` | dashboard | Fast GitHub refresh, seconds (default 600) |
| `REPORT_TOKEN` | dashboard + reporters | Shared secret for the report routes |
| `HEALTHCHECK_URLS` | dashboard | `label=url,…` to check |
| `TZ` | dashboard | Timezone for week/month boundaries |

`.env.example` and the README get the new variables; the README also gets install steps for the
server agent and the Claude reporter.

## 9. Testing

- **Jest (server):** GitHub computations from fixture responses (periods, reviews de-dup by submit
  date, streak, median merge time, most-contributed repo); report validation and auth (missing token,
  wrong token, bad body); staleness and attention rules; health-check result mapping.
- **Node test runner (`node --test`) for the reporters:** Claude JSONL parsing (de-dup, per-day sums,
  incremental offsets, 35-day pruning); `/proc/mdstat`, `/proc/stat`, `/proc/meminfo` and
  `smartctl -j` parsing from captured samples of both servers.
- **Lua:** `spec/api_test.lua` covers the new image paths with the token.
- **Manual:** render both PNGs at 600×744 and compare with the mockup; install the agent on both
  servers and the reporter on this PC, then check the Kindle.

## Delivery order

1. Shared image kit + plugin generic image view and 4-tab bar (no visible change on Dashboard).
2. Work tab: GitHub.
3. Work tab: Claude reporter + report route.
4. Servers tab: agent + report route + health checks + rendering.
