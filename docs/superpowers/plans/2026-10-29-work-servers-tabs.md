# Work and Servers Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Work tab (GitHub + Claude usage) and a Servers tab (two servers' health) to the KOReader plugin, rendered by the server as grayscale PNGs like the existing Dashboard tab.

**Architecture:** The Next.js server renders `/api/kindle/work.png` and `/api/kindle/servers.png` with Satori (`next/og`), the same way as `/api/kindle/dashboard.png`. GitHub data is pulled by the server. Claude usage and server metrics are pushed to `POST /api/claude/report` and `POST /api/servers/report` by two small dependency-free Node reporters: `claude-reporter/` (Windows Task Scheduler on the user's PC) and `server-agent/` (a Docker container on each server). The KOReader plugin gets a generic image view and a 4-tab bar.

**Tech Stack:** Next.js 16 App Router (route handlers), TypeScript, Satori via `next/og`, Sharp, Jest 30; plain Node ≥ 20 ESM + `node:test` for the reporters; Lua (KOReader widgets) for the plugin.

**Spec:** `docs/superpowers/specs/2026-10-29-work-servers-tabs-design.md`. Approved mockup: `.superpowers/brainstorm/1009-1793283399/content/work-servers-v3.html` (git-ignored, local only).

---

## Ground rules for every task

- Read `AGENTS.md`: this Next.js version differs from older ones. Route handlers in this repo look like `src/app/api/kindle/dashboard.png/route.ts` (`export async function GET(request: Request)`, `export const runtime = 'nodejs'`, `export const dynamic = 'force-dynamic'`). Copy that shape; if in doubt check `node_modules/next/dist/docs/`.
- Run the whole Jest suite with `npm test`, one file with `npx jest <path>`.
- Satori (behind `ImageResponse`) needs `display: 'flex'` on every `<div>` with more than one child and has no grid or tables. **The bundled Noto fonts have no ✓ ✗ ↓ ↑ ⚠ glyphs**: use words (`OK`, `FALHOU`, `rx`/`tx`). `°`, `·`, `—`, `/`, `%` are fine.
- On-screen text is Portuguese (as in the approved mockup); code, comments and commit messages are English.
- Commit after each task with the message given. End every commit message with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Lua is not installed on the dev PC. Run the Lua specs with Docker:
  `docker run --rm -v "$PWD/koreader-plugin:/p" -w /p nickblah/lua:5.1 lua spec/<file>.lua`

## File map

**Server (Next.js)**

| File | Responsibility |
|---|---|
| `src/lib/kindle-png.ts` (new) | Image size from `?w=&h=`, PNG `Response` helper; no heavy imports (safe in tests) |
| `src/lib/image-kit.tsx` (new) | Palette, fonts, `card`, `Label`, `SectionHeader`, `Meter`, `Bars`, `Badge`, `Page`, `renderKindlePng` |
| `src/lib/dashboard-image.tsx` (modify) | Steam + League layout only, on top of the kit |
| `src/lib/periods.ts` (new) | Week/month/year starts, local `YYYY-MM-DD` keys |
| `src/lib/format.ts` (new) | Short labels: `8.2M`, `3h`, `em 1h48`, `qui 03:59`, `14 GB`, … |
| `src/types/github.ts` (new) | GitHub raw + stats types |
| `src/lib/github-stats.ts` (new) | Pure GitHub computations |
| `src/lib/github.ts` (new) | GitHub REST/GraphQL fetching |
| `src/types/reports.ts` (new) | Claude and server report types |
| `src/lib/reports.ts` (new) | Report auth, validation, storage |
| `src/lib/claude-summary.ts` (new) | Pure Claude figures for the Work tab |
| `src/lib/servers.ts` (new) | Pure staleness / attention rules |
| `src/lib/healthcheck.ts` (new) | `HEALTHCHECK_URLS` parsing and checks |
| `src/lib/server-cache.ts` (modify) | `saveEntry`/`loadEntry`, background cache, GitHub + health getters |
| `src/lib/work-image.tsx` (new) | Work tab layout |
| `src/lib/servers-image.tsx` (new) | Servers tab layout |
| `src/app/api/kindle/work.png/route.ts` (new) | Work PNG |
| `src/app/api/kindle/servers.png/route.ts` (new) | Servers PNG |
| `src/app/api/claude/report/route.ts` (new) | Claude report intake |
| `src/app/api/servers/report/route.ts` (new) | Server report intake |
| `src/proxy.ts` (modify) | Guard the two new PNGs with `KINDLE_API_TOKEN` |

**Reporters:** `claude-reporter/{lib.mjs,report.mjs,run-hidden.vbs,install.ps1,config.example.json,test/lib.test.mjs}`, `server-agent/{lib.mjs,agent.mjs,Dockerfile,compose.yaml,config.example.json,test/lib.test.mjs}`.

**Plugin:** `koreader-plugin/kindledash.koplugin/kdash_tabs.lua` (new, pure), `kdash_image.lua` (new, replaces `kdash_dashboard.lua`), `kdash_hub.lua`, `main.lua`, `koreader-plugin/spec/tabs_test.lua` (new).

---

## Phase 1: shared image kit and the 4-tab plugin

### Task 1: `kindle-png.ts` (size + response helpers)

**Files:**
- Create: `src/lib/kindle-png.ts`
- Create: `src/__tests__/lib/kindle-png.test.ts`
- Modify: `src/app/api/kindle/dashboard.png/route.ts`

- [ ] **Step 1: Write the failing test**

`src/__tests__/lib/kindle-png.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { imageSizeFrom, pngResponse, DEFAULT_IMAGE_SIZE } from '@/lib/kindle-png'

describe('imageSizeFrom', () => {
  it('reads w and h', () => {
    expect(imageSizeFrom(new URLSearchParams('w=600&h=700'))).toEqual({ width: 600, height: 700 })
  })

  it('defaults missing values and clamps to 200–2000', () => {
    expect(imageSizeFrom(new URLSearchParams(''))).toEqual(DEFAULT_IMAGE_SIZE)
    expect(imageSizeFrom(new URLSearchParams('w=99999&h=5'))).toEqual({ width: 2000, height: 200 })
  })
})

describe('pngResponse', () => {
  it('answers the PNG without caching', async () => {
    const res = await pngResponse('test', async () => Buffer.from('png'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('png')
  })

  it('answers 500 when rendering fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const res = await pngResponse('test', async () => { throw new Error('satori') })
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx jest src/__tests__/lib/kindle-png.test.ts`
Expected: FAIL, `Cannot find module '@/lib/kindle-png'`.

- [ ] **Step 3: Implement**

`src/lib/kindle-png.ts`:

```ts
// Helpers shared by the /api/kindle/*.png routes the KOReader plugin downloads.

export interface ImageSize { width: number; height: number }

// Kindle screen below the plugin's tab bar
export const DEFAULT_IMAGE_SIZE: ImageSize = { width: 600, height: 744 }

function dimension(value: string | null, fallback: number): number {
  const n = parseInt(value ?? '', 10)
  return Number.isFinite(n) ? Math.min(2000, Math.max(200, n)) : fallback
}

// ?w= and ?h= size the image to the area the plugin has free
export function imageSizeFrom(params: URLSearchParams): ImageSize {
  return {
    width: dimension(params.get('w'), DEFAULT_IMAGE_SIZE.width),
    height: dimension(params.get('h'), DEFAULT_IMAGE_SIZE.height),
  }
}

export async function pngResponse(tag: string, render: () => Promise<Buffer>): Promise<Response> {
  try {
    const png = await render()
    return new Response(new Uint8Array(png), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error(`[${tag}]`, err)
    return Response.json({ error: 'Failed to render image' }, { status: 500 })
  }
}
```

Replace `src/app/api/kindle/dashboard.png/route.ts` with:

```ts
import { getCachedSteamData, getCachedLeagueData } from '@/lib/server-cache'
import { renderDashboardPng } from '@/lib/dashboard-image'
import { imageSizeFrom, pngResponse } from '@/lib/kindle-png'
import type { SteamData, LeagueData } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Steam + League dashboard as a grayscale PNG for the KOReader plugin.
export async function GET(request: Request): Promise<Response> {
  const size = imageSizeFrom(new URL(request.url).searchParams)
  const [steam, league] = await Promise.all([
    getCachedSteamData().catch((): SteamData | null => null),
    getCachedLeagueData().catch((): LeagueData | null => null),
  ])
  return pngResponse('api/kindle/dashboard.png', () => renderDashboardPng(steam, league, size))
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/__tests__/lib/kindle-png.test.ts src/__tests__/api/kindle-dashboard-png.test.ts`
Expected: PASS (the existing dashboard route test still passes: same size handling, same 500).

- [ ] **Step 5: Commit**

```bash
git add src/lib/kindle-png.ts src/__tests__/lib/kindle-png.test.ts src/app/api/kindle/dashboard.png/route.ts
git commit -m "refactor: share the KOReader PNG size and response helpers"
```

### Task 2: `image-kit.tsx` and the slimmer `dashboard-image.tsx`

**Files:**
- Create: `src/lib/image-kit.tsx`
- Modify: `src/lib/dashboard-image.tsx`

No unit test: Satori rendering is checked visually against the current image.

- [ ] **Step 1: Save the current dashboard image as a baseline**

Run in one terminal: `npm run dev`. In another:

```bash
mkdir -p .superpowers/preview
curl -s "http://localhost:3000/api/kindle/dashboard.png?w=600&h=744" -o .superpowers/preview/dashboard-before.png
```

Expected: a PNG of about 40 KB (open it to check it shows Steam + League).

- [ ] **Step 2: Create the kit**

`src/lib/image-kit.tsx`:

```tsx
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ReactElement, ReactNode } from 'react'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import type { ImageSize } from './kindle-png'

// Look shared by the KOReader PNGs (dashboard, work, servers): the /kindle page's
// palette and fonts, flexbox only (Satori, behind ImageResponse, has no grid or tables).

export const INK = '#1a1612'
export const INK_MUTED = '#7a7268'
export const PAPER = '#e8e3d8'
export const PAPER_LIGHT = '#f1ede2'
export const PAPER_DARK = '#d8d2c4'
export const PAPER_DARKER = '#c4bdac'
// Meter track on a dark card
const INK_SOFT = '#3a342d'

export const SERIF = 'Noto Serif'
export const SANS = 'Noto Sans'

export const card = {
  display: 'flex',
  background: PAPER_LIGHT,
  border: `1px solid ${INK}`,
  borderRadius: 10,
} as const

// Attention state: inverted card
export const darkCard = { ...card, background: INK, color: PAPER_LIGHT } as const

// Muted text colour on a light or dark card
export const muted = (dark: boolean) => (dark ? PAPER_DARKER : INK_MUTED)

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 700; style: 'normal' | 'italic' }[]> | null = null

function loadFonts() {
  const dir = join(process.cwd(), 'assets', 'fonts')
  const font = async (file: string, name: string, weight: 400 | 700, style: 'normal' | 'italic' = 'normal') =>
    ({ name, data: await readFile(join(dir, file)), weight, style })
  fonts ??= Promise.all([
    font('NotoSerif-Regular.ttf', SERIF, 400),
    font('NotoSerif-Bold.ttf', SERIF, 700),
    font('NotoSerif-Italic.ttf', SERIF, 400, 'italic'),
    font('NotoSans-Regular.ttf', SANS, 400),
    font('NotoSans-Bold.ttf', SANS, 700),
  ]).catch((err) => {
    fonts = null
    throw err
  })
  return fonts
}

export function Label({ children, size = 9, color = INK_MUTED, bold = false, spacing = 1.8 }: { children: string; size?: number; color?: string; bold?: boolean; spacing?: number }) {
  return (
    <div style={{ display: 'flex', fontFamily: SANS, fontSize: size, letterSpacing: spacing, color, fontWeight: bold ? 700 : 400 }}>
      {children}
    </div>
  )
}

export function SectionHeader({ label, meta, marginBottom = 8 }: { label: string; meta: string; marginBottom?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom }}>
      <Label size={10} color={INK} bold>{label}</Label>
      <div style={{ display: 'flex', flex: 1, height: 1, background: INK, margin: '0 10px' }} />
      <Label>{meta}</Label>
    </div>
  )
}

// Horizontal fill bar; `dark` for use on a darkCard
export function Meter({ pct, height = 9, dark = false }: { pct: number; height?: number; dark?: boolean }) {
  const fill = Math.min(100, Math.max(0, pct))
  return (
    <div style={{
      display: 'flex', flex: 1, height, overflow: 'hidden', borderRadius: height / 2,
      border: `1px solid ${dark ? PAPER_LIGHT : INK}`, background: dark ? INK_SOFT : PAPER_DARK,
    }}>
      <div style={{ display: 'flex', width: `${fill}%`, background: dark ? PAPER_LIGHT : INK }} />
    </div>
  )
}

// Vertical bars, oldest first; the last one (the current period) is solid ink
export function Bars({ values, height = 28 }: { values: number[]; height?: number }) {
  const max = Math.max(1, ...values)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', height, flex: 1 }}>
      {values.map((v, i) => (
        <div key={i} style={{
          display: 'flex', flex: 1, marginLeft: i ? 3 : 0, borderRadius: 1,
          height: Math.max(1, Math.round((v / max) * height)),
          background: i === values.length - 1 ? INK : PAPER_DARKER,
        }} />
      ))}
    </div>
  )
}

export function Badge({ children, filled = false, dark = false }: { children: string; filled?: boolean; dark?: boolean }) {
  const fg = dark ? PAPER_LIGHT : INK
  return (
    <div style={{
      display: 'flex', fontFamily: SANS, fontSize: 8, fontWeight: 700, letterSpacing: 1,
      padding: '0 6px', borderRadius: 8, border: `1px solid ${fg}`,
      background: filled ? fg : 'transparent', color: filled ? (dark ? INK : PAPER_LIGHT) : fg,
    }}>
      {children}
    </div>
  )
}

export function Page({ children, gap = 0 }: { children: ReactNode; gap?: number }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', width: '100%', height: '100%', gap,
      padding: '14px 22px', background: PAPER, color: INK, fontFamily: SERIF,
    }}>
      {children}
    </div>
  )
}

// Returns an 8-bit grayscale PNG (the Kindle shows 16 grays; smaller to download)
export async function renderKindlePng(node: ReactElement, size: ImageSize): Promise<Buffer> {
  const response = new ImageResponse(node, { ...size, fonts: await loadFonts() })
  const png = Buffer.from(await response.arrayBuffer())
  return sharp(png).removeAlpha().toColourspace('b-w').png({ compressionLevel: 9 }).toBuffer()
}
```

- [ ] **Step 3: Move `dashboard-image.tsx` onto the kit**

In `src/lib/dashboard-image.tsx`:

1. Replace everything from the top of the file down to (not including) `// Images are embedded as grayscale data URIs` with:

```tsx
/* eslint-disable @next/next/no-img-element -- Satori (ImageResponse) renders plain <img>, not next/image */
import { fetchAndGrayscale } from './image'
import { daysAgo } from './steam'
import { INK, INK_MUTED, PAPER, PAPER_LIGHT, PAPER_DARK, PAPER_DARKER, SERIF, SANS, card, Label, SectionHeader, Page, renderKindlePng } from './image-kit'
import { DEFAULT_IMAGE_SIZE, type ImageSize } from './kindle-png'
import type { SteamData, LeagueData, MatchResult, ChampionStat, SteamTopGame } from '@/types'

// Steam + League dashboard as a PNG for the KOReader plugin. Same look as the
// /kindle page, rebuilt with flexbox only (see image-kit.tsx).

```

2. Delete the `let fonts …` declaration, the whole `loadFonts` function, and the `Label` and `SectionHeader` functions (they now live in the kit). Keep `imageCache`, `loadImage`, `loadImages`, `Images`, `Frame` and every Steam/League component unchanged.

3. Replace the final `renderDashboardPng` function with:

```tsx
export async function renderDashboardPng(
  steam: SteamData | null,
  league: LeagueData | null,
  size: ImageSize = DEFAULT_IMAGE_SIZE
): Promise<Buffer> {
  const images = await loadImages(imageUrls(steam, league))
  return renderKindlePng(
    <Page>
      <Steam steam={steam} images={images} />
      <League league={league} images={images} />
    </Page>,
    size
  )
}
```

- [ ] **Step 4: Type-check, lint, test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: no errors. If ESLint flags unused imports in `dashboard-image.tsx` (for example `PAPER_LIGHT`), remove only the ones it names.

- [ ] **Step 5: Compare with the baseline**

With `npm run dev` running:

```bash
curl -s "http://localhost:3000/api/kindle/dashboard.png?w=600&h=744" -o .superpowers/preview/dashboard-after.png
```

Expected: open both PNGs; they look the same (Steam data may differ if a game changed).

- [ ] **Step 6: Commit**

```bash
git add src/lib/image-kit.tsx src/lib/dashboard-image.tsx
git commit -m "refactor: move the KOReader PNG look into a shared image kit"
```

### Task 3: plugin tab order (`kdash_tabs.lua`)

**Files:**
- Create: `koreader-plugin/kindledash.koplugin/kdash_tabs.lua`
- Create: `koreader-plugin/spec/tabs_test.lua`

- [ ] **Step 1: Write the failing test**

`koreader-plugin/spec/tabs_test.lua`:

```lua
-- Tests for kdash_tabs.lua (tab order, tab width). Run from koreader-plugin/: lua spec/tabs_test.lua
package.path = "kindledash.koplugin/?.lua;" .. package.path
local Tabs = require("kdash_tabs")

local function check(name, cond)
    if not cond then error("FAIL: " .. name, 2) end
end

check("four tabs in order", table.concat(Tabs.ORDER, ",") == "dashboard,spotify,work,servers")
check("right of dashboard", Tabs.neighbour("dashboard", 1) == "spotify")
check("left of work", Tabs.neighbour("work", -1) == "spotify")
check("nothing left of the first", Tabs.neighbour("dashboard", -1) == nil)
check("nothing right of the last", Tabs.neighbour("servers", 1) == nil)
check("unknown tab", Tabs.neighbour("nope", 1) == nil)
-- 600 px bar: 12 px padding each side, 8 px after each tab, 90 px close button
check("tab width fills the bar", Tabs.width(600, 12, 8, 90) == 113)
print("tabs checks passed")
```

- [ ] **Step 2: Run it and see it fail**

Run: `docker run --rm -v "$PWD/koreader-plugin:/p" -w /p nickblah/lua:5.1 lua spec/tabs_test.lua`
Expected: error `module 'kdash_tabs' not found`.

- [ ] **Step 3: Implement**

`koreader-plugin/kindledash.koplugin/kdash_tabs.lua`:

```lua
--[[--
Tab order and tab bar geometry. Pure Lua, so it is testable without KOReader.
--]]

local Tabs = {}

Tabs.ORDER = { "dashboard", "spotify", "work", "servers" }

-- The tab `step` places away from `name` (-1 = left, 1 = right), or nil past the ends
function Tabs.neighbour(name, step)
    for i, tab in ipairs(Tabs.ORDER) do
        if tab == name then return Tabs.ORDER[i + step] end
    end
    return nil
end

-- Width of each tab so the tabs, a gap after each one and the close button fill the bar
function Tabs.width(bar_width, padding, gap, close_width)
    local count = #Tabs.ORDER
    return math.floor((bar_width - 2 * padding - count * gap - close_width) / count)
end

return Tabs
```

- [ ] **Step 4: Run the tests**

Run: `docker run --rm -v "$PWD/koreader-plugin:/p" -w /p nickblah/lua:5.1 sh -c "lua spec/tabs_test.lua && lua spec/api_test.lua && lua spec/lyrics_test.lua"`
Expected: `tabs checks passed`, `api checks passed`, and the lyrics checks pass.

- [ ] **Step 5: Commit**

```bash
git add koreader-plugin/kindledash.koplugin/kdash_tabs.lua koreader-plugin/spec/tabs_test.lua
git commit -m "feat(koreader): tab order for the Work and Servers tabs"
```

### Task 4: generic image view, 4-tab hub, menu and gestures

**Files:**
- Create: `koreader-plugin/kindledash.koplugin/kdash_image.lua`
- Delete: `koreader-plugin/kindledash.koplugin/kdash_dashboard.lua`
- Modify: `koreader-plugin/kindledash.koplugin/kdash_hub.lua`
- Modify: `koreader-plugin/kindledash.koplugin/main.lua`
- Modify: `koreader-plugin/README.md`

The Bearer token is already sent on every request by `Api:request` (including downloads), so the new images need no API change.

- [ ] **Step 1: Create `kdash_image.lua`**

```lua
--[[--
A tab that shows a PNG the server renders to the size of this area
(/api/kindle/dashboard.png, work.png, servers.png): downloads it on an
interval and keeps the last good image when the server is unreachable.
--]]

local Blitbuffer = require("ffi/blitbuffer")
local ImageWidget = require("ui/widget/imagewidget")
local TextBoxWidget = require("ui/widget/textboxwidget")
local UIManager = require("ui/uimanager")
local lfs = require("libs/libkoreader-lfs")
local logger = require("logger")
local T = require("ffi/util").template
local _ = require("gettext")

local Api = require("kdash_api")
local Ui = require("kdash_ui")

-- Every Nth image update flashes the screen to clear e-ink ghosting
local FULL_REFRESH_EVERY = 10
-- Let the tab switch paint before the (blocking) download starts
local START_DELAY = 0.3

local ImageView = {}
ImageView.__index = ImageView

-- `opts`: path (server route), file (cache file name), interval (seconds)
function ImageView.new(args, opts)
    local self = setmetatable({}, ImageView)
    self.hub = args.hub
    self.api = args.api
    self.width = args.width
    self.height = args.height
    self.path = opts.path
    self.interval = opts.interval or 60
    self.image_file = args.cache_dir .. "/" .. opts.file
    -- Show the image from the last session right away, until a fresh one arrives
    self.has_image = lfs.attributes(self.image_file, "mode") == "file"
    self.error = nil
    self.updates = 0
    self.running = false
    self.fetch_cb = function() self:fetch() end
    return self
end

function ImageView:start()
    self.running = true
    UIManager:unschedule(self.fetch_cb)
    UIManager:scheduleIn(START_DELAY, self.fetch_cb)
end

function ImageView:stop()
    self.running = false
    UIManager:unschedule(self.fetch_cb)
end

function ImageView:fetch()
    if not self.running then return end
    local path = Api.withQuery(self.path, { w = self.width, h = self.height })
    local ok, err = self.api:download(path, self.image_file)
    if ok then
        self.has_image = true
        self.error = nil
        self.updates = self.updates + 1
        local mode = self.updates % FULL_REFRESH_EVERY == 0 and "full" or "ui"
        self.hub:setContent(self, self:build(), mode)
    else
        logger.warn("kindledash:", self.path, "download failed:", err)
        self.error = err
        -- Keep showing the last image; only a first-load failure needs a message
        if not self.has_image then self.hub:setContent(self, self:build(), "ui") end
    end
    UIManager:scheduleIn(self.interval, self.fetch_cb)
end

function ImageView:message(text)
    return Ui.region(self.width, self.height, TextBoxWidget:new{
        text = text,
        face = Ui.serif(16),
        width = self.width - 80,
        alignment = "center",
        fgcolor = Blitbuffer.COLOR_DARK_GRAY,
    })
end

function ImageView:build()
    if self.has_image then
        return Ui.region(self.width, self.height, ImageWidget:new{
            file = self.image_file,
            file_do_cache = false, -- same path, new content on every update
            width = self.width,
            height = self.height,
            scale_factor = 0, -- fit, keeping the aspect ratio (1:1 when sizes match)
        })
    end
    if self.error then
        return self:message(T(_("Could not reach the server:\n%1\n\nRetrying every %2 s."), self.error, self.interval))
    end
    return self:message(_("Loading…"))
end

return ImageView
```

Then delete the old view: `git rm koreader-plugin/kindledash.koplugin/kdash_dashboard.lua`.

- [ ] **Step 2: Update `kdash_hub.lua`**

1. In the header comment, change `a tab bar (Dashboard / Spotify / Close)` to `a tab bar (Dashboard / Spotify / Work / Servers / Close)`.
2. Replace `local DashboardView = require("kdash_dashboard")` with:

```lua
local ImageView = require("kdash_image")
local Tabs = require("kdash_tabs")
```

3. Replace the constants block (`BAR_HEIGHT` … `BAR_PADDING`) with:

```lua
local BAR_HEIGHT = 56
local TAB_GAP = 8
local CLOSE_WIDTH = 90
local BAR_PADDING = 12

local TAB_LABELS = {
    dashboard = _("Dashboard"),
    spotify = _("Spotify"),
    work = _("Work"),
    servers = _("Servers"),
}
```

4. In `Hub:init`, replace the `self.views = { … }` block with:

```lua
    local view_args = { hub = self, api = self.api, width = self.width, height = content_height, cache_dir = self.cache_dir }
    local interval = self.settings.dashboard_interval
    self.views = {
        dashboard = ImageView.new(view_args, { path = "/api/kindle/dashboard.png", file = "dashboard.png", interval = interval }),
        spotify = SpotifyView.new(view_args),
        work = ImageView.new(view_args, { path = "/api/kindle/work.png", file = "work.png", interval = interval }),
        servers = ImageView.new(view_args, { path = "/api/kindle/servers.png", file = "servers.png", interval = interval }),
    }
```

(Remove the old `local view_args = …` line just above it, now part of this block.)

5. In `Hub:tab`, change `width = Screen:scaleBySize(TAB_WIDTH),` to `width = self.tab_width,`.

6. Replace the whole `Hub:layout` function with:

```lua
function Hub:layout()
    local pad = Screen:scaleBySize(BAR_PADDING)
    local gap = Screen:scaleBySize(TAB_GAP)
    local close_width = Screen:scaleBySize(CLOSE_WIDTH)
    self.tab_width = Tabs.width(self.width, pad, gap, close_width)

    local row = HorizontalGroup:new{
        align = "center",
        VerticalSpan:new{ width = self.bar_height },
        HorizontalSpan:new{ width = pad },
    }
    for _i, name in ipairs(Tabs.ORDER) do
        table.insert(row, self:tab(TAB_LABELS[name], name))
        table.insert(row, HorizontalSpan:new{ width = gap })
    end
    table.insert(row, Button:new{
        text = _("Close"),
        width = close_width,
        height = Screen:scaleBySize(BAR_HEIGHT - 16),
        radius = Size.radius.button,
        text_font_size = 16,
        callback = function() self:onClose() end,
    })

    local bar = FrameContainer:new{
        bordersize = 0, padding = 0, margin = 0,
        width = self.width, height = self.bar_height,
        background = Blitbuffer.COLOR_WHITE,
        row,
    }
    self[1] = FrameContainer:new{
        bordersize = 0, padding = 0, margin = 0,
        background = Blitbuffer.COLOR_WHITE,
        VerticalGroup:new{
            align = "left",
            bar,
            LineWidget:new{ dimen = Geom:new{ w = self.width, h = Size.line.medium } },
            self.content,
        },
    }
end
```

(The loop variable is `_i`, not `_`: `_` is gettext in this file.)

7. Replace `Hub:onSwipe` with:

```lua
-- Swipe left = next tab, swipe right = previous tab
function Hub:onSwipe(_arg, ges)
    local step = (ges.direction == "west" and 1) or (ges.direction == "east" and -1) or nil
    if not step then return end
    local target = Tabs.neighbour(self.active_name, step)
    if target then self:switchTo(target) end
    return true
end
```

- [ ] **Step 3: Update `main.lua`**

1. Header comment: `Steam, League of Legends and Spotify` → `Steam, League of Legends, Spotify, GitHub/Claude and server status`.
2. In `KindleDash:init`, after the `kindledash_open_spotify` action, add:

```lua
    Dispatcher:registerAction("kindledash_open_work", {
        category = "none", event = "KindleDashOpenWork", title = _("Kindle Dashboard: Work"), general = true,
    })
    Dispatcher:registerAction("kindledash_open_servers", {
        category = "none", event = "KindleDashOpenServers", title = _("Kindle Dashboard: Servers"), general = true,
    })
```

3. After `KindleDash:onKindleDashOpenSpotify`, add:

```lua
function KindleDash:onKindleDashOpenWork()
    self:open("work")
    return true
end

function KindleDash:onKindleDashOpenServers()
    self:open("servers")
    return true
end
```

4. In `addToMainMenu`, replace the "Open Spotify player" item with these three (the `separator` moves to the last one):

```lua
            {
                text = _("Open Spotify player"),
                callback = function() self:open("spotify") end,
            },
            {
                text = _("Open Work"),
                callback = function() self:open("work") end,
            },
            {
                text = _("Open Servers"),
                callback = function() self:open("servers") end,
                separator = true,
            },
```

5. Rename the menu text `Dashboard refresh: %1 s` → `Image tabs refresh: %1 s` and the dialog title `Dashboard refresh (seconds)` → `Image tabs refresh (seconds)` (the same setting now drives Dashboard, Work and Servers).

- [ ] **Step 4: Update `koreader-plugin/README.md`**

- Intro: "with two tabs" → "with four tabs", and add after the Spotify bullet:

```markdown
- **Work** — GitHub (PRs opened and reviewed, commits, open PRs, review queue, deploys) and Claude
  usage, as a server-rendered PNG (`/api/kindle/work.png`), refreshed like the Dashboard tab.
- **Servers** — CPU, RAM, disks, RAID, SMART, containers and site health checks of your servers
  (`/api/kindle/servers.png`). Both new tabs need the access token when the server sets one.
```

- Diagram: add the lines

```
  Work tab      ── every 60 s ───────────────────► /api/kindle/work.png?w=&h=
  Servers tab   ── every 60 s ───────────────────► /api/kindle/servers.png?w=&h=
```

- Settings table: `Dashboard refresh` → `Image tabs refresh`, and the token row: "needed for the Spotify, Work and Servers tabs when the server sets one".
- Gestures: also list **Kindle Dashboard: Work** and **Kindle Dashboard: Servers**.
- Files table: replace the `kdash_dashboard.lua` row with
  `| \`kdash_image.lua\` | Image tabs (Dashboard, Work, Servers): downloads and shows a server PNG |`
  and add `| \`kdash_tabs.lua\` | Pure helpers: tab order, tab width |`.
- Development block: add `lua spec/tabs_test.lua   # tab order / width`.

- [ ] **Step 5: Check the Lua parses and specs pass**

Run: `docker run --rm -v "$PWD/koreader-plugin:/p" -w /p nickblah/lua:5.1 sh -c "for f in kindledash.koplugin/*.lua; do luac -p \$f || exit 1; done && lua spec/tabs_test.lua && lua spec/api_test.lua"`
Expected: no syntax errors; `tabs checks passed`, `api checks passed`.

- [ ] **Step 6: Commit**

```bash
git add -A koreader-plugin
git commit -m "feat(koreader): Work and Servers tabs as server-rendered images"
```

---

## Phase 2: Work tab, GitHub

### Task 5: periods and labels (`periods.ts`, `format.ts`)

**Files:**
- Create: `src/lib/periods.ts`, `src/lib/format.ts`
- Create: `src/__tests__/lib/periods.test.ts`, `src/__tests__/lib/format.test.ts`

All dates use the process's local time, which is `TZ` (set to `America/Sao_Paulo` on the server in Task 19). The tests build dates with the local `Date` constructor, so they pass in any timezone.

- [ ] **Step 1: Write the failing tests**

`src/__tests__/lib/periods.test.ts`:

```ts
import { periodStarts, recentStart, localDay, monthWindows } from '@/lib/periods'

// Wednesday 29 Oct 2026, 14:30 local time
const now = new Date(2026, 9, 29, 14, 30)

describe('periodStarts', () => {
  it('starts the week on Monday 00:00 and the month on the 1st', () => {
    const p = periodStarts(now)
    expect(p.week).toEqual(new Date(2026, 9, 26))
    expect(p.month).toEqual(new Date(2026, 9, 1))
    expect(now.getTime() - p.year.getTime()).toBe(365 * 86_400_000)
  })

  it('keeps Sunday in the week that started the Monday before', () => {
    expect(periodStarts(new Date(2026, 10, 1, 9)).week).toEqual(new Date(2026, 9, 26))
  })
})

describe('recentStart', () => {
  it('is the earlier of week and month', () => {
    expect(recentStart(now)).toEqual(new Date(2026, 9, 1))
    // Tue 3 Nov: the week began on Mon 2 Nov, the month on Sun 1 Nov
    expect(recentStart(new Date(2026, 10, 3))).toEqual(new Date(2026, 10, 1))
    // Wed 3 Feb 2027: week and month both start on Mon 1 Feb
    expect(recentStart(new Date(2027, 1, 3))).toEqual(new Date(2027, 1, 1))
  })
})

describe('localDay', () => {
  it('formats YYYY-MM-DD in local time', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('monthWindows', () => {
  it('lists calendar months, newest first, as date ranges', () => {
    expect(monthWindows(now, 3)).toEqual([
      ['2026-10-01', '2026-10-31'],
      ['2026-09-01', '2026-09-30'],
      ['2026-08-01', '2026-08-31'],
    ])
  })
})
```

`src/__tests__/lib/format.test.ts`:

```ts
import { compactNumber, ageLabel, untilLabel, weekdayTime, clockTime, durationLabel, bytesLabel, rateLabel, uptimeLabel } from '@/lib/format'

const now = new Date(2026, 9, 29, 14, 30)

it('compactNumber', () => {
  expect(compactNumber(950)).toBe('950')
  expect(compactNumber(4_120)).toBe('4.1k')
  expect(compactNumber(8_240_000)).toBe('8.2M')
  expect(compactNumber(41_400_000)).toBe('41M')
  expect(compactNumber(1_630_000_000)).toBe('1.6B')
})

it('ageLabel', () => {
  expect(ageLabel(new Date(2026, 9, 29, 14, 28), now)).toBe('2min')
  expect(ageLabel(new Date(2026, 9, 29, 9, 30).getTime(), now)).toBe('5h')
  expect(ageLabel(new Date(2026, 9, 27, 14, 30).toISOString(), now)).toBe('2d')
})

it('untilLabel', () => {
  expect(untilLabel(new Date(2026, 9, 29, 16, 18).toISOString(), now)).toBe('em 1h48')
  expect(untilLabel(new Date(2026, 9, 29, 14, 45).toISOString(), now)).toBe('em 15min')
  expect(untilLabel(new Date(2026, 9, 29, 14, 0).toISOString(), now)).toBe('agora')
})

it('weekdayTime and clockTime', () => {
  expect(weekdayTime(new Date(2026, 10, 5, 3, 59).toISOString())).toBe('qui 03:59')
  expect(clockTime(new Date(2026, 9, 29, 7, 5).getTime())).toBe('07:05')
})

it('durationLabel', () => {
  expect(durationLabel(9.4)).toBe('9h')
  expect(durationLabel(33.6)).toBe('1.4d')
})

it('bytesLabel', () => {
  expect(bytesLabel(512 * 1024 ** 2)).toBe('512 MB')
  expect(bytesLabel(5.6 * 1024 ** 3)).toBe('5.6 GB')
  expect(bytesLabel(339 * 1024 ** 3)).toBe('339 GB')
  expect(bytesLabel(1.82 * 1024 ** 4)).toBe('1.8 TB')
})

it('rateLabel and uptimeLabel', () => {
  expect(rateLabel(1_258_291)).toBe('1.2 MB/s')
  expect(rateLabel(20_480)).toBe('20 KB/s')
  expect(uptimeLabel(41 * 86_400 + 3600)).toBe('41d')
  expect(uptimeLabel(5 * 3600)).toBe('5h')
})
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest src/__tests__/lib/periods.test.ts src/__tests__/lib/format.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/lib/periods.ts`:

```ts
// Reporting periods in the server's local time (TZ): the week starts on Monday
// 00:00, the month on the 1st, the year is the last 365 days.

const DAY_MS = 86_400_000

export interface Periods { week: Date; month: Date; year: Date }

export function periodStarts(now: Date): Periods {
  const week = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  week.setDate(week.getDate() - ((week.getDay() + 6) % 7))
  return {
    week,
    month: new Date(now.getFullYear(), now.getMonth(), 1),
    year: new Date(now.getTime() - 365 * DAY_MS),
  }
}

// Start of the window the frequent refresh covers: the earlier of week and month
export function recentStart(now: Date): Date {
  const { week, month } = periodStarts(now)
  return week < month ? week : month
}

const pad = (n: number) => String(n).padStart(2, '0')

export function localDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// The last `count` calendar months as [first day, last day], newest first
export function monthWindows(now: Date, count: number): [string, string][] {
  const windows: [string, string][] = []
  for (let i = 0; i < count; i++) {
    const first = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const last = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    windows.push([localDay(first), localDay(last)])
  }
  return windows
}
```

`src/lib/format.ts`:

```ts
// Short labels for the KOReader images (Portuguese, like the rest of their text).

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const pad = (n: number) => String(n).padStart(2, '0')
const toMs = (t: Date | string | number) => (t instanceof Date ? t.getTime() : typeof t === 'number' ? t : new Date(t).getTime())

// One decimal under 10, none above: 4.1k, 41M
function short(v: number): string {
  return v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10)
}

export function compactNumber(n: number): string {
  if (n >= 1e9) return `${short(n / 1e9)}B`
  if (n >= 1e6) return `${short(n / 1e6)}M`
  if (n >= 1e3) return `${short(n / 1e3)}k`
  return String(Math.round(n))
}

// How long ago: 2min, 5h, 2d
export function ageLabel(from: Date | string | number, now: Date): string {
  const ms = Math.max(0, now.getTime() - toMs(from))
  if (ms < HOUR_MS) return `${Math.round(ms / MINUTE_MS)}min`
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)}h`
  return `${Math.floor(ms / DAY_MS)}d`
}

// Time left: em 15min, em 1h48, em 3d; "agora" once past
export function untilLabel(to: string, now: Date): string {
  const ms = toMs(to) - now.getTime()
  if (ms <= 0) return 'agora'
  if (ms < HOUR_MS) return `em ${Math.ceil(ms / MINUTE_MS)}min`
  if (ms < DAY_MS) return `em ${Math.floor(ms / HOUR_MS)}h${pad(Math.floor((ms % HOUR_MS) / MINUTE_MS))}`
  return `em ${Math.floor(ms / DAY_MS)}d`
}

export function clockTime(at: Date | string | number): string {
  const d = new Date(toMs(at))
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// qui 03:59
export function weekdayTime(at: string): string {
  return `${WEEKDAYS[new Date(at).getDay()]} ${clockTime(at)}`
}

// Hours as 9h, or days as 1.4d from 24 h on
export function durationLabel(hours: number): string {
  return hours < 24 ? `${Math.round(hours)}h` : `${short(hours / 24)}d`
}

export function bytesLabel(bytes: number): string {
  const units: [number, string][] = [[1024 ** 4, 'TB'], [1024 ** 3, 'GB'], [1024 ** 2, 'MB']]
  for (const [size, unit] of units) if (bytes >= size) return `${short(bytes / size)} ${unit}`
  return `${Math.round(bytes / 1024)} KB`
}

export function rateLabel(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1024 ** 2) return `${short(bytesPerSecond / 1024 ** 2)} MB/s`
  return `${Math.round(bytesPerSecond / 1024)} KB/s`
}

export function uptimeLabel(seconds: number): string {
  return seconds >= 86_400 ? `${Math.floor(seconds / 86_400)}d` : `${Math.floor(seconds / 3600)}h`
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/__tests__/lib/periods.test.ts src/__tests__/lib/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/periods.ts src/lib/format.ts src/__tests__/lib/periods.test.ts src/__tests__/lib/format.test.ts
git commit -m "feat: reporting periods and short labels for the Work and Servers images"
```

### Task 6: GitHub types and computations (`github-stats.ts`)

**Files:**
- Create: `src/types/github.ts`
- Modify: `src/types/index.ts`
- Create: `src/lib/github-stats.ts`
- Create: `src/__tests__/lib/github-stats.test.ts`

- [ ] **Step 1: Add the types**

`src/types/github.ts`:

```ts
export type CiState = 'success' | 'failure' | 'pending' | null

export interface GithubPr {
  repo: string        // owner/name
  number: number
  title: string
  author: string
  createdAt: string
  ci: CiState         // state of the last commit's checks
  approvals: number
}

export interface GithubDeploy {
  repo: string
  state: 'success' | 'failure' | 'running' | null  // null: no workflow run yet
  at: string | null
}

export interface GithubCommit { sha: string; repo: string; date: string }
// pr: the PR's node id, so reviews of one PR count once
export interface GithubReview { pr: string; submittedAt: string }
export interface GithubMergedPr { createdAt: string; mergedAt: string; additions: number; deletions: number }

// Refreshed every GITHUB_UPDATE_RATE: this week and month, lists, deploys
export interface GithubFast {
  login: string
  prsOpenedWeek: number
  prsOpenedMonth: number
  commits: GithubCommit[]   // since recentStart()
  reviews: GithubReview[]   // since recentStart()
  merged: GithubMergedPr[]  // merged in the last 31 days
  openPrs: GithubPr[]
  reviewQueue: GithubPr[]
  deploys: GithubDeploy[]
}

// Refreshed hourly: the last 12 months
export interface GithubSlow {
  prsOpenedYear: number
  commits: GithubCommit[]
  reviews: GithubReview[]
}

export interface PeriodCounts { week: number; month: number; avgMonth: number | null }
export interface RepoCount { repo: string; commits: number }

export interface GithubStats {
  login: string
  prsOpened: PeriodCounts
  prsReviewed: PeriodCounts
  commits: { week: number; month: number; weekly: number[] }  // weekly: 12 weeks, oldest first
  streak: number
  topRepo: { year: RepoCount | null; month: RepoCount | null }
  mergeHours: number | null
  lines: { added: number; removed: number }
  openPrs: GithubPr[]
  reviewQueue: GithubPr[]
  deploys: GithubDeploy[]
}
```

Append to `src/types/index.ts`:

```ts
export type { CiState, GithubPr, GithubDeploy, GithubCommit, GithubReview, GithubMergedPr, GithubFast, GithubSlow, GithubStats, PeriodCounts, RepoCount } from './github'
```

- [ ] **Step 2: Write the failing test**

`src/__tests__/lib/github-stats.test.ts`:

```ts
import { reviewedPrs, weeklyCounts, commitStreak, topRepo, medianMergeHours, buildGithubStats } from '@/lib/github-stats'
import type { GithubFast, GithubSlow } from '@/types'

// Wednesday 29 Oct 2026, 14:30 local; the week began Mon 26 Oct
const now = new Date(2026, 9, 29, 14, 30)
const at = (month: number, day: number, hour = 12) => new Date(2026, month, day, hour).toISOString()
const commit = (sha: string, repo: string, date: string) => ({ sha, repo, date })

describe('reviewedPrs', () => {
  it('counts distinct PRs with a review submitted since the start', () => {
    const reviews = [
      { pr: 'A', submittedAt: at(9, 27) },
      { pr: 'A', submittedAt: at(9, 28) },
      { pr: 'B', submittedAt: at(9, 20) },
    ]
    expect(reviewedPrs(reviews, new Date(2026, 9, 26))).toBe(1)
    expect(reviewedPrs(reviews, new Date(2026, 9, 1))).toBe(2)
  })
})

describe('weeklyCounts', () => {
  it('buckets dates into weeks ending with the current one', () => {
    const weekStart = new Date(2026, 9, 26)
    // current week: 27 Oct, 26 Oct 00:00 → 2; previous week (19–25): 25 Oct 23:00, 19 Oct → 2;
    // two weeks back (12–18): 18 Oct → 1; 1 Aug is past the 3-week window
    const dates = [at(9, 27), at(9, 26, 0), at(9, 25, 23), at(9, 19), at(9, 18), at(7, 1)]
    expect(weeklyCounts(dates, weekStart, 3)).toEqual([1, 2, 2])
  })
})

describe('commitStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(commitStreak([at(9, 29), at(9, 28), at(9, 27), at(9, 25)], now)).toBe(3)
  })

  it('ends yesterday when there is no commit yet today', () => {
    expect(commitStreak([at(9, 28), at(9, 27)], now)).toBe(2)
  })

  it('is 0 without a commit today or yesterday', () => {
    expect(commitStreak([at(9, 26)], now)).toBe(0)
  })
})

describe('topRepo', () => {
  it('returns the repo with most commits since the start', () => {
    const commits = [commit('1', 'a/x', at(9, 27)), commit('2', 'a/y', at(9, 27)), commit('3', 'a/y', at(9, 28)), commit('4', 'a/x', at(8, 1)), commit('5', 'a/x', at(8, 2))]
    expect(topRepo(commits, new Date(2026, 9, 1))).toEqual({ repo: 'a/y', commits: 2 })
    expect(topRepo(commits, new Date(2026, 0, 1))).toEqual({ repo: 'a/x', commits: 3 })
    expect(topRepo([], new Date(2026, 0, 1))).toBeNull()
  })
})

describe('medianMergeHours', () => {
  it('takes the median time from creation to merge', () => {
    const pr = (createdAt: string, mergedAt: string) => ({ createdAt, mergedAt, additions: 0, deletions: 0 })
    const merged = [pr(at(9, 20, 0), at(9, 20, 10)), pr(at(9, 20, 0), at(9, 21, 0)), pr(at(9, 20, 0), at(9, 22, 0))]
    expect(medianMergeHours(merged, new Date(2026, 9, 1))).toBe(24)
    expect(medianMergeHours(merged.slice(0, 2), new Date(2026, 9, 1))).toBe(17)
    expect(medianMergeHours([], new Date(2026, 9, 1))).toBeNull()
  })
})

describe('buildGithubStats', () => {
  const fast: GithubFast = {
    login: 'KsmKayk',
    prsOpenedWeek: 3,
    prsOpenedMonth: 5,
    commits: [commit('c1', 'a/x', at(9, 29)), commit('c2', 'a/x', at(9, 2))],
    reviews: [{ pr: 'P1', submittedAt: at(9, 27) }],
    merged: [
      { createdAt: at(9, 10), mergedAt: at(9, 11), additions: 100, deletions: 40 },
      { createdAt: at(8, 28), mergedAt: at(8, 30), additions: 7, deletions: 7 },
    ],
    openPrs: [],
    reviewQueue: [],
    deploys: [],
  }
  const slow: GithubSlow = {
    prsOpenedYear: 195,
    // c2 also comes from the fast list: counted once
    commits: [commit('c2', 'a/x', at(9, 2)), commit('c3', 'a/y', at(5, 1)), commit('c4', 'a/y', at(5, 2)), commit('c5', 'a/x', at(4, 1))],
    reviews: [{ pr: 'P1', submittedAt: at(9, 27) }, { pr: 'P2', submittedAt: at(3, 1) }],
  }

  it('combines the fast and 12-month data', () => {
    const stats = buildGithubStats(fast, slow, now)
    expect(stats.prsOpened).toEqual({ week: 3, month: 5, avgMonth: 16.3 })
    expect(stats.prsReviewed).toEqual({ week: 1, month: 1, avgMonth: 0.2 })
    expect(stats.commits.week).toBe(1)
    expect(stats.commits.month).toBe(2)
    expect(stats.commits.weekly).toHaveLength(12)
    expect(stats.commits.weekly[11]).toBe(1)
    expect(stats.streak).toBe(1)
    expect(stats.topRepo).toEqual({ year: { repo: 'a/x', commits: 3 }, month: { repo: 'a/x', commits: 2 } })
    // only the 11 Oct merge is this month; both merges are within 30 days (24 h and 48 h)
    expect(stats.lines).toEqual({ added: 100, removed: 40 })
    expect(stats.mergeHours).toBe(36)
  })

  it('leaves 12-month figures empty until they are loaded', () => {
    const stats = buildGithubStats(fast, null, now)
    expect(stats.prsOpened.avgMonth).toBeNull()
    expect(stats.prsReviewed.avgMonth).toBeNull()
    expect(stats.topRepo.year).toBeNull()
    expect(stats.commits.month).toBe(2)
  })
})
```

- [ ] **Step 3: Run it and see it fail**

Run: `npx jest src/__tests__/lib/github-stats.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement**

`src/lib/github-stats.ts`:

```ts
import { periodStarts } from './periods'
import type { GithubCommit, GithubFast, GithubMergedPr, GithubReview, GithubSlow, GithubStats, RepoCount } from '@/types'

// Pure computations behind the GitHub part of the Work tab.

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

const since = (date: string, start: Date) => new Date(date).getTime() >= start.getTime()

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Map<string, T>()
  for (const item of items) seen.set(key(item), item)
  return [...seen.values()]
}

// Distinct PRs with at least one review submitted since `start`
export function reviewedPrs(reviews: GithubReview[], start: Date): number {
  return new Set(reviews.filter((r) => since(r.submittedAt, start)).map((r) => r.pr)).size
}

// Counts per week, oldest first; the last bucket is the week starting at `weekStart`
export function weeklyCounts(dates: string[], weekStart: Date, weeks = 12): number[] {
  const counts = new Array<number>(weeks).fill(0)
  for (const date of dates) {
    const t = new Date(date).getTime()
    const back = t >= weekStart.getTime() ? 0 : Math.ceil((weekStart.getTime() - t) / WEEK_MS)
    if (back < weeks) counts[weeks - 1 - back]++
  }
  return counts
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

// Consecutive days with a commit, ending today (or yesterday while today has none)
export function commitStreak(dates: string[], now: Date): number {
  const days = new Set(dates.map((d) => dayKey(new Date(d))))
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (!days.has(dayKey(day))) day.setDate(day.getDate() - 1)
  let streak = 0
  while (days.has(dayKey(day))) {
    streak++
    day.setDate(day.getDate() - 1)
  }
  return streak
}

export function topRepo(commits: GithubCommit[], start: Date): RepoCount | null {
  const counts = new Map<string, number>()
  for (const c of commits) if (since(c.date, start)) counts.set(c.repo, (counts.get(c.repo) ?? 0) + 1)
  let best: RepoCount | null = null
  for (const [repo, n] of counts) if (!best || n > best.commits) best = { repo, commits: n }
  return best
}

export function medianMergeHours(merged: GithubMergedPr[], start: Date): number | null {
  const hours = merged
    .filter((p) => since(p.mergedAt, start))
    .map((p) => (new Date(p.mergedAt).getTime() - new Date(p.createdAt).getTime()) / 3_600_000)
    .sort((a, b) => a - b)
  if (hours.length === 0) return null
  const mid = Math.floor(hours.length / 2)
  return hours.length % 2 ? hours[mid] : (hours[mid - 1] + hours[mid]) / 2
}

const perMonth = (yearCount: number) => Math.round((yearCount / 12) * 10) / 10

// `slow` is null until the first 12-month load finishes
export function buildGithubStats(fast: GithubFast, slow: GithubSlow | null, now: Date): GithubStats {
  const p = periodStarts(now)
  const commits = uniqueBy([...(slow?.commits ?? []), ...fast.commits], (c) => c.sha)
  const reviews = uniqueBy([...(slow?.reviews ?? []), ...fast.reviews], (r) => `${r.pr}@${r.submittedAt}`)
  const dates = commits.map((c) => c.date)
  const mergedThisMonth = fast.merged.filter((m) => since(m.mergedAt, p.month))
  return {
    login: fast.login,
    prsOpened: { week: fast.prsOpenedWeek, month: fast.prsOpenedMonth, avgMonth: slow ? perMonth(slow.prsOpenedYear) : null },
    prsReviewed: {
      week: reviewedPrs(reviews, p.week),
      month: reviewedPrs(reviews, p.month),
      avgMonth: slow ? perMonth(reviewedPrs(reviews, p.year)) : null,
    },
    commits: {
      week: dates.filter((d) => since(d, p.week)).length,
      month: dates.filter((d) => since(d, p.month)).length,
      weekly: weeklyCounts(dates, p.week),
    },
    streak: commitStreak(dates, now),
    topRepo: { year: slow ? topRepo(commits, p.year) : null, month: topRepo(commits, p.month) },
    mergeHours: medianMergeHours(fast.merged, new Date(now.getTime() - 30 * DAY_MS)),
    lines: {
      added: mergedThisMonth.reduce((sum, m) => sum + m.additions, 0),
      removed: mergedThisMonth.reduce((sum, m) => sum + m.deletions, 0),
    },
    openPrs: fast.openPrs,
    reviewQueue: fast.reviewQueue,
    deploys: fast.deploys,
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `npx jest src/__tests__/lib/github-stats.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/github.ts src/types/index.ts src/lib/github-stats.ts src/__tests__/lib/github-stats.test.ts
git commit -m "feat: GitHub figures for the Work tab"
```

### Task 7: GitHub fetching (`github.ts`)

**Files:**
- Create: `src/lib/github.ts`
- Create: `src/__tests__/lib/github.test.ts`

Searches verified on 2026-10-29 with the user's `gh` token: `search/issues` and `search/commits` return the `iclinic` org results; the profile `contributionsCollection` does not (it reports them as restricted), so it is not used.

- [ ] **Step 1: Write the failing test (pure mappers + one search)**

`src/__tests__/lib/github.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { toPr, toDeploy, searchCommits } from '@/lib/github'

describe('toPr', () => {
  it('maps a GraphQL pull request', () => {
    const pr = toPr({
      id: 'PR_1', number: 4982, title: 'Correção de bugs', createdAt: '2026-10-26T21:01:38Z',
      author: { login: 'KsmKayk' }, repository: { nameWithOwner: 'iclinic/iclinic-api' },
      reviews: { totalCount: 1 },
      commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] },
    })
    expect(pr).toEqual({
      repo: 'iclinic/iclinic-api', number: 4982, title: 'Correção de bugs', author: 'KsmKayk',
      createdAt: '2026-10-26T21:01:38Z', ci: 'failure', approvals: 1,
    })
  })

  it('has no CI state without checks', () => {
    const pr = toPr({
      id: 'PR_2', number: 1, title: 't', createdAt: '2026-10-26T00:00:00Z', author: null,
      repository: { nameWithOwner: 'a/b' }, reviews: { totalCount: 0 }, commits: { nodes: [{ commit: { statusCheckRollup: null } }] },
    })
    expect(pr.ci).toBeNull()
    expect(pr.author).toBe('ghost')
  })
})

describe('toDeploy', () => {
  it('maps the latest workflow run', () => {
    expect(toDeploy('a/b', undefined)).toEqual({ repo: 'a/b', state: null, at: null })
    expect(toDeploy('a/b', { status: 'in_progress', conclusion: null, created_at: 'c', updated_at: 'u' })).toEqual({ repo: 'a/b', state: 'running', at: 'c' })
    expect(toDeploy('a/b', { status: 'completed', conclusion: 'success', created_at: 'c', updated_at: 'u' })).toEqual({ repo: 'a/b', state: 'success', at: 'u' })
    expect(toDeploy('a/b', { status: 'completed', conclusion: 'cancelled', created_at: 'c', updated_at: 'u' })).toEqual({ repo: 'a/b', state: 'failure', at: 'u' })
  })
})

describe('searchCommits', () => {
  const item = (sha: string) => ({ sha, repository: { full_name: 'a/b' }, commit: { author: { date: '2026-10-01T00:00:00Z' } } })

  beforeEach(() => { process.env.GITHUB_TOKEN = 't' })

  it('follows pages until a short one', async () => {
    const pages = [Array.from({ length: 100 }, (_, i) => item(`s${i}`)), [item('last')]]
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ items: pages.shift() ?? [] }), { status: 200 }))
    const commits = await searchCommits('author:me', 0)
    expect(commits).toHaveLength(101)
    expect(commits[100]).toEqual({ sha: 'last', repo: 'a/b', date: '2026-10-01T00:00:00Z' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain('page=2')
    fetchMock.mockRestore()
  })
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx jest src/__tests__/lib/github.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/lib/github.ts`:

```ts
import { localDay, monthWindows, periodStarts, recentStart } from './periods'
import type { CiState, GithubCommit, GithubDeploy, GithubFast, GithubMergedPr, GithubPr, GithubReview, GithubSlow } from '@/types'

// GitHub data for the Work tab, through the token's own access (GITHUB_TOKEN, a
// classic PAT with `repo`). Search covers the user's org repos too.

const API = 'https://api.github.com'
// Search allows 30 requests per minute; the 12-month load spaces its requests out
const SEARCH_GAP_MS = 2_500
const LIST_SIZE = 3

function headers(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN is not set')
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
}

async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: headers(), cache: 'no-store' })
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}`)
  return res.json() as Promise<T>
}

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`)
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (body.errors?.length || !body.data) throw new Error(`GitHub GraphQL: ${body.errors?.[0]?.message ?? 'no data'}`)
  return body.data
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
// Search qualifier datetime: 2026-10-26T03:00:00+00:00
const searchTime = (d: Date) => `${d.toISOString().slice(0, 19)}+00:00`

let login: string | null = null

async function viewerLogin(): Promise<string> {
  login ??= (await graphql<{ viewer: { login: string } }>('query { viewer { login } }', {})).viewer.login
  return login
}

async function searchCount(q: string): Promise<number> {
  const body = await rest<{ total_count: number }>(`/search/issues?q=${encodeURIComponent(q)}&per_page=1`)
  return body.total_count
}

interface CommitItem { sha: string; repository: { full_name: string }; commit: { author: { date: string } } }

// Every page of a commit search (GitHub stops at 1000 results)
export async function searchCommits(q: string, gapMs = SEARCH_GAP_MS): Promise<GithubCommit[]> {
  const commits: GithubCommit[] = []
  for (let page = 1; page <= 10; page++) {
    if (page > 1) await sleep(gapMs)
    const body = await rest<{ items: CommitItem[] }>(`/search/commits?q=${encodeURIComponent(q)}&per_page=100&page=${page}`)
    commits.push(...body.items.map((item) => ({ sha: item.sha, repo: item.repository.full_name, date: item.commit.author.date })))
    if (body.items.length < 100) break
  }
  return commits
}

interface PrNode {
  id: string
  number: number
  title: string
  createdAt: string
  author: { login: string } | null
  repository: { nameWithOwner: string }
  reviews: { totalCount: number }
  commits: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] }
}

const PR_FIELDS = `
  ... on PullRequest {
    id number title createdAt
    author { login }
    repository { nameWithOwner }
    reviews(states: APPROVED) { totalCount }
    commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  }`

function ciState(state: string | null | undefined): CiState {
  if (state === 'SUCCESS') return 'success'
  if (state === 'FAILURE' || state === 'ERROR') return 'failure'
  if (state === 'PENDING' || state === 'EXPECTED') return 'pending'
  return null
}

export function toPr(node: PrNode): GithubPr {
  return {
    repo: node.repository.nameWithOwner,
    number: node.number,
    title: node.title,
    author: node.author?.login ?? 'ghost',
    createdAt: node.createdAt,
    ci: ciState(node.commits.nodes[0]?.commit.statusCheckRollup?.state),
    approvals: node.reviews.totalCount,
  }
}

async function searchPrs(q: string): Promise<GithubPr[]> {
  const data = await graphql<{ search: { nodes: PrNode[] } }>(
    `query($q: String!, $first: Int!) { search(query: $q, type: ISSUE, first: $first) { nodes { ${PR_FIELDS} } } }`,
    { q, first: LIST_SIZE }
  )
  return data.search.nodes.map(toPr)
}

// The user's reviews on other people's PRs updated since `start` (a PR reviewed
// in the period was updated at or after that review)
async function searchReviews(user: string, start: Date): Promise<GithubReview[]> {
  const q = `is:pr reviewed-by:${user} -author:${user} updated:>=${localDay(start)}`
  const reviews: GithubReview[] = []
  let after: string | null = null
  do {
    const data: { search: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: { id?: string; reviews?: { nodes: { submittedAt: string | null }[] } }[] } } = await graphql(
      `query($q: String!, $user: String!, $after: String) {
        search(query: $q, type: ISSUE, first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { ... on PullRequest { id reviews(author: $user, first: 50) { nodes { submittedAt } } } }
        }
      }`,
      { q, user, after }
    )
    for (const pr of data.search.nodes) {
      for (const review of pr.reviews?.nodes ?? []) {
        if (pr.id && review.submittedAt) reviews.push({ pr: pr.id, submittedAt: review.submittedAt })
      }
    }
    after = data.search.pageInfo.hasNextPage ? data.search.pageInfo.endCursor : null
  } while (after)
  return reviews
}

async function searchMerged(user: string, start: Date): Promise<GithubMergedPr[]> {
  const data = await graphql<{ search: { nodes: Partial<GithubMergedPr>[] } }>(
    `query($q: String!) { search(query: $q, type: ISSUE, first: 100) { nodes { ... on PullRequest { createdAt mergedAt additions deletions } } } }`,
    { q: `is:pr author:${user} is:merged merged:>=${localDay(start)}` }
  )
  return data.search.nodes.filter((n): n is GithubMergedPr => typeof n.mergedAt === 'string')
}

interface RunItem { status: string; conclusion: string | null; created_at: string; updated_at: string }

export function toDeploy(repo: string, run: RunItem | undefined): GithubDeploy {
  if (!run) return { repo, state: null, at: null }
  if (run.status !== 'completed') return { repo, state: 'running', at: run.created_at }
  return { repo, state: run.conclusion === 'success' ? 'success' : 'failure', at: run.updated_at }
}

async function latestDeploy(repo: string): Promise<GithubDeploy> {
  const { default_branch } = await rest<{ default_branch: string }>(`/repos/${repo}`)
  const { workflow_runs } = await rest<{ workflow_runs: RunItem[] }>(
    `/repos/${repo}/actions/runs?branch=${encodeURIComponent(default_branch)}&per_page=1`
  )
  return toDeploy(repo, workflow_runs[0])
}

function deployRepos(): string[] {
  return (process.env.GITHUB_DEPLOY_REPOS ?? '').split(',').map((r) => r.trim()).filter(Boolean)
}

export async function fetchGithubFast(now = new Date()): Promise<GithubFast> {
  const user = await viewerLogin()
  const p = periodStarts(now)
  const recent = recentStart(now)
  const [prsOpenedWeek, prsOpenedMonth, commits, reviews, merged, openPrs, reviewQueue, deploys] = await Promise.all([
    searchCount(`is:pr author:${user} created:>=${searchTime(p.week)}`),
    searchCount(`is:pr author:${user} created:>=${searchTime(p.month)}`),
    searchCommits(`author:${user} committer-date:>=${localDay(recent)}`),
    searchReviews(user, recent),
    searchMerged(user, new Date(now.getTime() - 31 * 86_400_000)),
    searchPrs(`is:pr is:open author:${user} archived:false sort:updated-desc`),
    searchPrs(`is:pr is:open review-requested:${user} archived:false sort:updated-desc`),
    Promise.all(deployRepos().map(latestDeploy)),
  ])
  return { login: user, prsOpenedWeek, prsOpenedMonth, commits, reviews, merged, openPrs, reviewQueue, deploys }
}

// About a minute of spaced-out searches: run it in the background (server-cache.ts)
export async function fetchGithubSlow(now = new Date()): Promise<GithubSlow> {
  const user = await viewerLogin()
  const { year } = periodStarts(now)
  const prsOpenedYear = await searchCount(`is:pr author:${user} created:>=${searchTime(year)}`)
  const commits: GithubCommit[] = []
  for (const [from, to] of monthWindows(now, 13)) {
    await sleep(SEARCH_GAP_MS)
    commits.push(...(await searchCommits(`author:${user} committer-date:${from}..${to}`)))
  }
  const reviews = await searchReviews(user, year)
  return { prsOpenedYear, commits: commits.filter((c) => new Date(c.date) >= year), reviews }
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `npx jest src/__tests__/lib/github.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

The real GitHub calls are checked through the Work PNG in Task 11, Step 10.

- [ ] **Step 5: Commit**

```bash
git add src/lib/github.ts src/__tests__/lib/github.test.ts
git commit -m "feat: fetch GitHub activity for the Work tab"
```

### Task 8: GitHub caching (`server-cache.ts`)

**Files:**
- Modify: `src/lib/server-cache.ts`
- Create: `src/__tests__/lib/server-cache-github.test.ts`

- [ ] **Step 1: Write the failing test**

`src/__tests__/lib/server-cache-github.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { getCachedGithubStats, resetCacheForTest, saveEntry, loadEntry } from '@/lib/server-cache'
import { fetchGithubFast, fetchGithubSlow } from '@/lib/github'
import type { GithubFast } from '@/types'

jest.mock('@/lib/github')
jest.mock('@/lib/steam')
jest.mock('@/lib/league')
jest.mock('@/lib/spotify')

const mockFast = fetchGithubFast as jest.MockedFunction<typeof fetchGithubFast>
const mockSlow = fetchGithubSlow as jest.MockedFunction<typeof fetchGithubSlow>

const fast: GithubFast = {
  login: 'me', prsOpenedWeek: 1, prsOpenedMonth: 2, commits: [], reviews: [], merged: [],
  openPrs: [], reviewQueue: [], deploys: [],
}

beforeEach(() => {
  process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'server-cache-gh-'))
  process.env.GITHUB_TOKEN = 't'
  jest.clearAllMocks()
  resetCacheForTest()
  mockFast.mockResolvedValue(fast)
})

afterAll(() => { delete process.env.GITHUB_TOKEN })

it('is null without a token', async () => {
  delete process.env.GITHUB_TOKEN
  expect(await getCachedGithubStats()).toBeNull()
  expect(mockFast).not.toHaveBeenCalled()
})

it('answers with the fast data while the 12 months load in the background', async () => {
  mockSlow.mockReturnValue(new Promise(() => {}))
  const stats = await getCachedGithubStats()
  expect(stats?.prsOpened).toEqual({ week: 1, month: 2, avgMonth: null })
  expect(mockSlow).toHaveBeenCalledTimes(1)
})

it('uses the 12 months once loaded', async () => {
  mockSlow.mockResolvedValue({ prsOpenedYear: 24, commits: [], reviews: [] })
  await getCachedGithubStats()
  await new Promise((resolve) => setImmediate(resolve))
  const stats = await getCachedGithubStats()
  expect(stats?.prsOpened.avgMonth).toBe(2)
  expect(mockSlow).toHaveBeenCalledTimes(1)
})

it('saves and loads plain entries', () => {
  saveEntry('report-x', { a: 1 })
  resetCacheForTest({ keepDisk: true })
  expect(loadEntry<{ a: number }>('report-x')?.data).toEqual({ a: 1 })
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx jest src/__tests__/lib/server-cache-github.test.ts`
Expected: FAIL, `getCachedGithubStats` / `saveEntry` / `loadEntry` are not exported.

- [ ] **Step 3: Implement**

In `src/lib/server-cache.ts`:

1. Add imports after the existing ones:

```ts
import { fetchGithubFast, fetchGithubSlow } from './github'
import { buildGithubStats } from './github-stats'
import type { GithubStats } from '@/types'
```

2. After the `savedEntry` function, add:

```ts
// Plain saved values (the reports pushed by claude-reporter/ and server-agent/)
export function saveEntry<T>(key: string, data: T) {
  const entry = { data, at: Date.now() }
  memory.set(key, entry)
  writeDisk(key, entry)
}

export function loadEntry<T>(key: string): Entry<T> | null {
  return savedEntry<T>(key) ?? null
}

// For slow builds: answers at once with what is saved (null before the first
// success) and refreshes in the background when that is older than ttlMs.
function cachedInBackground<T>(key: string, ttlMs: number, build: () => Promise<T>): T | null {
  const entry = savedEntry<T>(key)
  if (!entry || Date.now() - entry.at >= ttlMs) {
    cached(key, ttlMs, build).catch((err) => console.error(`[server-cache] ${key} background refresh failed`, err))
  }
  return entry?.data ?? null
}
```

3. After `getCachedLeagueData`, add:

```ts
function githubTtlMs() { return parseInt(process.env.GITHUB_UPDATE_RATE ?? '600', 10) * 1000 }
const GITHUB_SLOW_TTL_MS = 3_600_000

// null when GITHUB_TOKEN is not set. The 12-month figures fill in once their
// background load finishes (about a minute after the first request).
export async function getCachedGithubStats(): Promise<GithubStats | null> {
  if (!process.env.GITHUB_TOKEN) return null
  const slow = cachedInBackground('github-slow', GITHUB_SLOW_TTL_MS, () => fetchGithubSlow())
  const fast = await cached('github-fast', githubTtlMs(), () => fetchGithubFast())
  return buildGithubStats(fast, slow, new Date())
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/__tests__/lib/server-cache-github.test.ts src/__tests__/lib/server-cache.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server-cache.ts src/__tests__/lib/server-cache-github.test.ts
git commit -m "feat: cache GitHub activity, loading the 12 months in the background"
```

---

## Phase 3: Work tab, Claude

### Task 9: report types, validation and storage (`reports.ts`)

**Files:**
- Create: `src/types/reports.ts`
- Modify: `src/types/index.ts`
- Create: `src/lib/reports.ts`
- Create: `src/__tests__/lib/reports.test.ts`

- [ ] **Step 1: Add the types**

`src/types/reports.ts`:

```ts
// Reports pushed by claude-reporter/ (Claude usage) and server-agent/ (server status)

export interface ClaudeLimit { utilization: number; resetsAt: string }  // utilization: percent
export interface ClaudeLimits { fiveHour: ClaudeLimit | null; sevenDay: ClaudeLimit | null; at: string }

// One local day of Claude Code usage (tokens)
export interface ClaudeDay {
  date: string  // YYYY-MM-DD, the PC's local time
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
  byModel: Record<string, number>
  byProject: Record<string, number>
}

// limits: null when the usage endpoint could not be read this time
export interface ClaudeReport { limits: ClaudeLimits | null; days: ClaudeDay[] }
export interface StoredClaude { limits: ClaudeLimits | null; days: ClaudeDay[]; receivedAt: number }

export interface DiskHealth {
  device: string  // sdb
  healthy: boolean | null
  tempC: number | null
  reallocated: number | null
  pending: number | null
}

export interface RaidInfo {
  device: string  // md0
  level: string   // RAID 1
  state: string   // UU, U_ …
  active: number
  total: number
  members: string[]
  syncPct: number | null
}

export interface MountInfo {
  path: string    // /mnt/raid1
  device: string  // md0, dm-0, sda1
  totalBytes: number
  usedBytes: number
  raid: RaidInfo | null
  disks: DiskHealth[]
}

export interface ContainerInfo { name: string; state: string; status: string; ports: number[] }

export interface ServerReport {
  id: string
  name: string
  order: number
  hostname: string
  arch: string
  uptimeSec: number
  cpu: { pct: number; cores: number; load1: number; tempC: number | null }
  mem: { totalBytes: number; usedBytes: number }
  net: { rxBps: number; txBps: number }
  mounts: MountInfo[]
  containers: ContainerInfo[]
}

export interface StoredServer { report: ServerReport; receivedAt: number }
```

Append to `src/types/index.ts`:

```ts
export type { ClaudeLimit, ClaudeLimits, ClaudeDay, ClaudeReport, StoredClaude, DiskHealth, RaidInfo, MountInfo, ContainerInfo, ServerReport, StoredServer } from './reports'
```

- [ ] **Step 2: Write the failing test**

`src/__tests__/lib/reports.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { handleReport, isClaudeReport, isServerReport, saveClaudeReport, getClaudeReport, saveServerReport, getServerReports } from '@/lib/reports'
import { resetCacheForTest } from '@/lib/server-cache'
import type { ClaudeReport, ServerReport } from '@/types'

jest.mock('@/lib/steam')
jest.mock('@/lib/league')
jest.mock('@/lib/spotify')
jest.mock('@/lib/github')

const day = { date: '2026-10-29', input: 1, output: 2, cacheWrite: 3, cacheRead: 4, byModel: { 'claude-opus-5-5': 10 }, byProject: { 'kindle-dashboard': 10 } }
const limits = { fiveHour: { utilization: 42, resetsAt: '2026-10-29T19:40:00Z' }, sevenDay: { utilization: 61, resetsAt: '2026-11-05T06:59:59Z' }, at: '2026-10-29T17:52:00Z' }
const claude: ClaudeReport = { limits, days: [day] }

const server: ServerReport = {
  id: 'kayk-server', name: 'kayk-server', order: 2, hostname: 'kayk-server', arch: 'x64', uptimeSec: 1000,
  cpu: { pct: 23, cores: 4, load1: 0.5, tempC: 52 },
  mem: { totalBytes: 6e9, usedBytes: 2.4e9 },
  net: { rxBps: 3e6, txBps: 2e5 },
  mounts: [{
    path: '/mnt/raid1', device: 'md0', totalBytes: 1.8e12, usedBytes: 3.7e11,
    raid: { device: 'md0', level: 'RAID 1', state: 'UU', active: 2, total: 2, members: ['sdb1', 'sdc1'], syncPct: null },
    disks: [{ device: 'sdb', healthy: true, tempC: 35, reallocated: 0, pending: 0 }],
  }],
  containers: [{ name: 'jellyfin', state: 'running', status: 'Up 3 days', ports: [8096] }],
}

const post = (body: unknown, token = 'r3port') =>
  new Request('http://localhost/api/x/report', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

beforeEach(() => {
  process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'reports-'))
  process.env.REPORT_TOKEN = 'r3port'
  resetCacheForTest()
})

afterAll(() => { delete process.env.REPORT_TOKEN })

describe('validation', () => {
  it('accepts well-formed reports', () => {
    expect(isClaudeReport(claude)).toBe(true)
    expect(isClaudeReport({ limits: null, days: [] })).toBe(true)
    expect(isServerReport(server)).toBe(true)
  })

  it('rejects malformed reports', () => {
    expect(isClaudeReport({ limits: null, days: [{ ...day, date: '29/10' }] })).toBe(false)
    expect(isClaudeReport({ days: [] })).toBe(false)
    expect(isServerReport({ ...server, id: 'Bad Id!' })).toBe(false)
    expect(isServerReport({ ...server, cpu: { ...server.cpu, pct: 'high' } })).toBe(false)
  })
})

describe('handleReport', () => {
  const save = jest.fn()

  beforeEach(() => save.mockReset())

  it('is off without REPORT_TOKEN', async () => {
    delete process.env.REPORT_TOKEN
    expect((await handleReport(post(claude), isClaudeReport, save)).status).toBe(503)
  })

  it('rejects a wrong token, bad JSON and invalid bodies', async () => {
    expect((await handleReport(post(claude, 'nope'), isClaudeReport, save)).status).toBe(401)
    expect((await handleReport(post('{oops'), isClaudeReport, save)).status).toBe(400)
    expect((await handleReport(post({ days: 1 }), isClaudeReport, save)).status).toBe(400)
    expect(save).not.toHaveBeenCalled()
  })

  it('saves a valid report', async () => {
    const res = await handleReport(post(claude), isClaudeReport, save)
    expect(res.status).toBe(200)
    expect(save).toHaveBeenCalledWith(claude)
  })
})

describe('storage', () => {
  it('keeps the last limits when a report comes without them', () => {
    saveClaudeReport(claude)
    saveClaudeReport({ limits: null, days: [] })
    const stored = getClaudeReport()
    expect(stored?.limits).toEqual(limits)
    expect(stored?.days).toEqual([])
    expect(typeof stored?.receivedAt).toBe('number')
  })

  it('lists servers by order, then name', () => {
    saveServerReport({ ...server, id: 'b', name: 'B', order: 2 })
    saveServerReport({ ...server, id: 'a', name: 'A', order: 2 })
    saveServerReport({ ...server, id: 'oracle', name: 'Oracle', order: 1 })
    expect(getServerReports().map((s) => s.report.id)).toEqual(['oracle', 'a', 'b'])
  })
})
```

- [ ] **Step 3: Run it and see it fail**

Run: `npx jest src/__tests__/lib/reports.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Implement**

`src/lib/reports.ts`:

```ts
import { checkAccess } from './access-token'
import { loadEntry, saveEntry } from './server-cache'
import type { ClaudeReport, ServerReport, StoredClaude, StoredServer } from '@/types'

// Reports pushed to POST /api/claude/report (claude-reporter/) and
// POST /api/servers/report (server-agent/), authenticated with REPORT_TOKEN.

const MAX_BODY_CHARS = 512 * 1024
const CLAUDE_KEY = 'report-claude'
const SERVERS_KEY = 'report-servers'

export async function handleReport<T>(
  request: Request,
  validate: (body: unknown) => body is T,
  save: (report: T) => void
): Promise<Response> {
  const token = process.env.REPORT_TOKEN || null
  if (!token) return Response.json({ error: 'REPORT_TOKEN is not set on the server' }, { status: 503 })
  const access = checkAccess({ authorization: request.headers.get('authorization'), query: null, cookie: null }, token)
  if (access !== 'header') return Response.json({ error: 'Invalid report token' }, { status: 401 })

  const text = await request.text()
  if (text.length > MAX_BODY_CHARS) return Response.json({ error: 'Report too large' }, { status: 413 })
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!validate(body)) return Response.json({ error: 'Invalid report' }, { status: 400 })
  save(body)
  return Response.json({ ok: true })
}

// ── validation ────────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isNumOrNull = (v: unknown) => v === null || isNum(v)
const isStr = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length <= max
const isList = (v: unknown, max: number, each: (item: unknown) => boolean) => Array.isArray(v) && v.length <= max && v.every(each)
const isCounts = (v: unknown) => isObj(v) && Object.keys(v).length <= 200 && Object.values(v).every(isNum)

const isLimit = (v: unknown) => v === null || (isObj(v) && isNum(v.utilization) && isStr(v.resetsAt))

const isDay = (v: unknown) =>
  isObj(v) && isStr(v.date) && /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
  isNum(v.input) && isNum(v.output) && isNum(v.cacheWrite) && isNum(v.cacheRead) &&
  isCounts(v.byModel) && isCounts(v.byProject)

export function isClaudeReport(v: unknown): v is ClaudeReport {
  return isObj(v) &&
    (v.limits === null || (isObj(v.limits) && isLimit(v.limits.fiveHour) && isLimit(v.limits.sevenDay) && isStr(v.limits.at))) &&
    isList(v.days, 60, isDay)
}

const isDisk = (v: unknown) =>
  isObj(v) && isStr(v.device, 40) && (v.healthy === null || typeof v.healthy === 'boolean') &&
  isNumOrNull(v.tempC) && isNumOrNull(v.reallocated) && isNumOrNull(v.pending)

const isRaid = (v: unknown) =>
  v === null || (isObj(v) && isStr(v.device, 40) && isStr(v.level, 20) && isStr(v.state, 40) &&
    isNum(v.active) && isNum(v.total) && isList(v.members, 32, (m) => isStr(m, 40)) && isNumOrNull(v.syncPct))

const isMount = (v: unknown) =>
  isObj(v) && isStr(v.path) && isStr(v.device, 80) && isNum(v.totalBytes) && isNum(v.usedBytes) &&
  isRaid(v.raid) && isList(v.disks, 32, isDisk)

const isContainer = (v: unknown) =>
  isObj(v) && isStr(v.name) && isStr(v.state, 40) && isStr(v.status) && isList(v.ports, 64, isNum)

export function isServerReport(v: unknown): v is ServerReport {
  return isObj(v) && isStr(v.id, 40) && /^[a-z0-9-]+$/.test(v.id) && isStr(v.name, 60) && isNum(v.order) &&
    isStr(v.hostname) && isStr(v.arch, 20) && isNum(v.uptimeSec) &&
    isObj(v.cpu) && isNum(v.cpu.pct) && isNum(v.cpu.cores) && isNum(v.cpu.load1) && isNumOrNull(v.cpu.tempC) &&
    isObj(v.mem) && isNum(v.mem.totalBytes) && isNum(v.mem.usedBytes) &&
    isObj(v.net) && isNum(v.net.rxBps) && isNum(v.net.txBps) &&
    isList(v.mounts, 16, isMount) && isList(v.containers, 100, isContainer)
}

// ── storage ───────────────────────────────────────────────────────────────────

// A report without limits (usage endpoint unreadable) keeps the previous ones
export function saveClaudeReport(report: ClaudeReport) {
  const previous = loadEntry<Omit<StoredClaude, 'receivedAt'>>(CLAUDE_KEY)
  saveEntry(CLAUDE_KEY, { limits: report.limits ?? previous?.data.limits ?? null, days: report.days })
}

export function getClaudeReport(): StoredClaude | null {
  const entry = loadEntry<Omit<StoredClaude, 'receivedAt'>>(CLAUDE_KEY)
  return entry ? { ...entry.data, receivedAt: entry.at } : null
}

export function saveServerReport(report: ServerReport) {
  const servers = loadEntry<Record<string, StoredServer>>(SERVERS_KEY)?.data ?? {}
  saveEntry(SERVERS_KEY, { ...servers, [report.id]: { report, receivedAt: Date.now() } })
}

export function getServerReports(): StoredServer[] {
  const servers = loadEntry<Record<string, StoredServer>>(SERVERS_KEY)?.data ?? {}
  return Object.values(servers).sort((a, b) => a.report.order - b.report.order || a.report.name.localeCompare(b.report.name))
}
```

- [ ] **Step 5: Run the tests**

Run: `npx jest src/__tests__/lib/reports.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/reports.ts src/types/index.ts src/lib/reports.ts src/__tests__/lib/reports.test.ts
git commit -m "feat: authenticated report intake for Claude usage and server status"
```

### Task 10: report routes

**Files:**
- Create: `src/app/api/claude/report/route.ts`, `src/app/api/servers/report/route.ts`
- Create: `src/__tests__/api/reports.test.ts`

- [ ] **Step 1: Write the failing test**

`src/__tests__/api/reports.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { POST as claudePost } from '@/app/api/claude/report/route'
import { POST as serversPost } from '@/app/api/servers/report/route'
import { handleReport, isClaudeReport, isServerReport, saveClaudeReport, saveServerReport } from '@/lib/reports'

jest.mock('@/lib/reports')

const mockHandle = handleReport as jest.MockedFunction<typeof handleReport>

it('wires each route to its validator and store', async () => {
  mockHandle.mockResolvedValue(new Response('ok'))
  const request = new Request('http://localhost/api/claude/report', { method: 'POST' })
  await claudePost(request)
  expect(mockHandle).toHaveBeenLastCalledWith(request, isClaudeReport, saveClaudeReport)
  await serversPost(request)
  expect(mockHandle).toHaveBeenLastCalledWith(request, isServerReport, saveServerReport)
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx jest src/__tests__/api/reports.test.ts`
Expected: FAIL, route modules not found.

- [ ] **Step 3: Implement**

`src/app/api/claude/report/route.ts`:

```ts
import { handleReport, isClaudeReport, saveClaudeReport } from '@/lib/reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Claude usage pushed by claude-reporter/ from the PC that runs Claude Code
export function POST(request: Request): Promise<Response> {
  return handleReport(request, isClaudeReport, saveClaudeReport)
}
```

`src/app/api/servers/report/route.ts`:

```ts
import { handleReport, isServerReport, saveServerReport } from '@/lib/reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Server status pushed by server-agent/ every minute
export function POST(request: Request): Promise<Response> {
  return handleReport(request, isServerReport, saveServerReport)
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/__tests__/api/reports.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/claude/report/route.ts src/app/api/servers/report/route.ts src/__tests__/api/reports.test.ts
git commit -m "feat: report routes for claude-reporter and server-agent"
```

### Task 11: Claude summary and the Work image + route

**Files:**
- Create: `src/lib/claude-summary.ts`, `src/__tests__/lib/claude-summary.test.ts`
- Create: `src/lib/work-image.tsx`
- Create: `src/app/api/kindle/work.png/route.ts`, `src/__tests__/api/kindle-work-png.test.ts`
- Modify: `src/proxy.ts`, `src/__tests__/proxy.test.ts`

- [ ] **Step 1: Write the failing summary test**

`src/__tests__/lib/claude-summary.test.ts`:

```ts
import { summarizeClaude, modelFamily, dayTotal } from '@/lib/claude-summary'
import type { ClaudeDay, StoredClaude } from '@/types'

const now = new Date(2026, 9, 29, 14, 30)  // Wed; week from Mon 26, month from 1 Oct

const day = (date: string, tokens: number, model = 'claude-opus-5-5', project = 'kindle-dashboard'): ClaudeDay => ({
  date, input: 0, output: tokens / 2, cacheWrite: 0, cacheRead: tokens / 2,
  byModel: { [model]: tokens }, byProject: { [project]: tokens },
})

const stored: StoredClaude = {
  limits: null,
  receivedAt: now.getTime(),
  days: [
    day('2026-10-29', 100),
    day('2026-10-27', 300, 'claude-sonnet-5-5', 'portfolio'),
    day('2026-10-20', 600),
    day('2026-09-30', 5000),
  ],
}

it('modelFamily', () => {
  expect(modelFamily('claude-opus-5-5')).toBe('Opus')
  expect(modelFamily('claude-sonnet-5-5')).toBe('Sonnet')
  expect(modelFamily('claude-haiku-5-5')).toBe('Haiku')
  expect(modelFamily('other')).toBe('other')
})

it('dayTotal sums the four token kinds', () => {
  expect(dayTotal({ ...day('2026-10-29', 0), input: 1, output: 2, cacheWrite: 3, cacheRead: 4 })).toBe(10)
})

it('summarizes today, week, month and the month split', () => {
  const s = summarizeClaude(stored, now)
  expect(s.tokens).toEqual({ today: 100, week: 400, month: 1000 })
  expect(s.daily).toHaveLength(14)
  expect(s.daily[13]).toBe(100)
  expect(s.daily[11]).toBe(300)
  expect(s.cachePct).toBe(100)  // input and cacheWrite are 0 in the fixture
  expect(s.models).toEqual([{ name: 'Opus', pct: 70 }, { name: 'Sonnet', pct: 30 }])
  expect(s.topProject).toBe('kindle-dashboard')
})

it('is empty for a month without usage', () => {
  const s = summarizeClaude({ ...stored, days: [] }, now)
  expect(s.tokens).toEqual({ today: 0, week: 0, month: 0 })
  expect(s.cachePct).toBeNull()
  expect(s.models).toEqual([])
  expect(s.topProject).toBeNull()
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx jest src/__tests__/lib/claude-summary.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the summary**

`src/lib/claude-summary.ts`:

```ts
import { localDay, periodStarts } from './periods'
import type { ClaudeDay, ClaudeLimits, StoredClaude } from '@/types'

// Claude figures for the Work tab, from the last claude-reporter report.

export interface ClaudeSummary {
  limits: ClaudeLimits | null
  receivedAt: number
  tokens: { today: number; week: number; month: number }
  daily: number[]                          // last 14 days, oldest first
  cachePct: number | null                  // this month
  models: { name: string; pct: number }[]  // this month, biggest first
  topProject: string | null                // this month
}

export const dayTotal = (d: ClaudeDay) => d.input + d.output + d.cacheWrite + d.cacheRead

export function modelFamily(model: string): string {
  const family = ['Opus', 'Sonnet', 'Haiku', 'Fable'].find((f) => model.toLowerCase().includes(f.toLowerCase()))
  return family ?? model
}

function addCounts(into: Map<string, number>, counts: Record<string, number>, key: (k: string) => string = (k) => k) {
  for (const [k, v] of Object.entries(counts)) into.set(key(k), (into.get(key(k)) ?? 0) + v)
}

export function summarizeClaude(stored: StoredClaude, now: Date): ClaudeSummary {
  const p = periodStarts(now)
  const today = localDay(now)
  const week = localDay(p.week)
  const monthStart = localDay(p.month)
  const byDate = new Map(stored.days.map((d) => [d.date, d]))
  const month = stored.days.filter((d) => d.date >= monthStart)
  const sum = (days: ClaudeDay[]) => days.reduce((total, d) => total + dayTotal(d), 0)

  const daily: number[] = []
  for (let back = 13; back >= 0; back--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back)
    const d = byDate.get(localDay(date))
    daily.push(d ? dayTotal(d) : 0)
  }

  const cacheRead = month.reduce((t, d) => t + d.cacheRead, 0)
  const cacheBase = month.reduce((t, d) => t + d.input + d.cacheWrite + d.cacheRead, 0)

  const models = new Map<string, number>()
  const projects = new Map<string, number>()
  for (const d of month) {
    addCounts(models, d.byModel, modelFamily)
    addCounts(projects, d.byProject)
  }
  const modelTotal = [...models.values()].reduce((a, b) => a + b, 0)
  const topProject = [...projects.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    limits: stored.limits,
    receivedAt: stored.receivedAt,
    tokens: { today: sum(month.filter((d) => d.date === today)), week: sum(stored.days.filter((d) => d.date >= week)), month: sum(month) },
    daily,
    cachePct: cacheBase > 0 ? Math.round((cacheRead / cacheBase) * 100) : null,
    models: [...models.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, v]) => ({ name, pct: Math.round((v / modelTotal) * 100) })),
    topProject,
  }
}
```

- [ ] **Step 4: Run the summary test**

Run: `npx jest src/__tests__/lib/claude-summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing route test**

`src/__tests__/api/kindle-work-png.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { GET } from '@/app/api/kindle/work.png/route'
import { getCachedGithubStats } from '@/lib/server-cache'
import { getClaudeReport } from '@/lib/reports'
import { renderWorkPng } from '@/lib/work-image'

jest.mock('@/lib/server-cache')
jest.mock('@/lib/reports')
jest.mock('@/lib/work-image', () => ({ renderWorkPng: jest.fn() }))

const mockGithub = getCachedGithubStats as jest.MockedFunction<typeof getCachedGithubStats>
const mockClaude = getClaudeReport as jest.MockedFunction<typeof getClaudeReport>
const mockRender = renderWorkPng as jest.MockedFunction<typeof renderWorkPng>

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockRender.mockReset().mockResolvedValue(Buffer.from('png'))
})

it('renders with GitHub failing and no Claude report yet', async () => {
  mockGithub.mockRejectedValue(new Error('GitHub 502'))
  mockClaude.mockReturnValue(null)
  const res = await GET(new Request('http://localhost/api/kindle/work.png?w=600&h=700'))
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toBe('image/png')
  expect(mockRender).toHaveBeenCalledWith(null, null, { width: 600, height: 700 })
})

it('summarizes the Claude report', async () => {
  mockGithub.mockResolvedValue(null)
  mockClaude.mockReturnValue({ limits: null, days: [], receivedAt: Date.now() })
  await GET(new Request('http://localhost/api/kindle/work.png'))
  expect(mockRender.mock.calls[0][1]).toMatchObject({ tokens: { today: 0, week: 0, month: 0 } })
})
```

- [ ] **Step 6: Run it and see it fail**

Run: `npx jest src/__tests__/api/kindle-work-png.test.ts`
Expected: FAIL, route module not found.

- [ ] **Step 7: Implement the Work image**

`src/lib/work-image.tsx`:

```tsx
import { INK, INK_MUTED, PAPER, PAPER_LIGHT, PAPER_DARK, PAPER_DARKER, SERIF, SANS, card, darkCard, muted, Label, SectionHeader, Meter, Bars, Badge, Page, renderKindlePng } from './image-kit'
import { ageLabel, clockTime, compactNumber, durationLabel, untilLabel, weekdayTime } from './format'
import { DEFAULT_IMAGE_SIZE, type ImageSize } from './kindle-png'
import type { ClaudeSummary } from './claude-summary'
import type { GithubDeploy, GithubPr, GithubStats, PeriodCounts } from '@/types'

// Work tab of the KOReader plugin: GitHub on top, Claude below.

const CLAUDE_STALE_MS = 30 * 60_000

const repoName = (repo: string) => repo.split('/').pop() ?? repo

function Big({ children, size = 23, color }: { children: string; size?: number; color?: string }) {
  return <div style={{ display: 'flex', fontFamily: SERIF, fontSize: size, fontWeight: 700, lineHeight: 1.1, color }}>{children}</div>
}

function Stat3({ items, size = 23 }: { items: [string, string][]; size?: number }) {
  return (
    <div style={{ display: 'flex', marginTop: 3 }}>
      {items.map(([value, label], i) => (
        <div key={label} style={{
          display: 'flex', flexDirection: 'column', flex: 1,
          paddingLeft: i ? 8 : 0, borderLeft: i ? `1px solid ${PAPER_DARKER}` : 'none',
        }}>
          <Big size={size}>{value}</Big>
          <Label size={8}>{label}</Label>
        </div>
      ))}
    </div>
  )
}

function Note({ children }: { children: string }) {
  return (
    <div style={{ ...card, padding: '10px 12px' }}>
      <Label size={10} spacing={0.5}>{children}</Label>
    </div>
  )
}

function PrCounts({ title, counts }: { title: string; counts: PeriodCounts }) {
  const avg = counts.avgMonth === null ? '—' : String(counts.avgMonth)
  return (
    <div style={{ ...card, flex: 1, flexDirection: 'column', padding: '8px 12px' }}>
      <Label size={8}>{title}</Label>
      <Stat3 items={[[String(counts.week), 'SEMANA'], [String(counts.month), 'MÊS'], [avg, 'MÉDIA/MÊS']]} />
    </div>
  )
}

function Commits({ gh }: { gh: GithubStats }) {
  const merge = gh.mergeHours === null ? '—' : durationLabel(gh.mergeHours)
  const lines = `+${compactNumber(gh.lines.added)} / −${compactNumber(gh.lines.removed)}`
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ ...card, flex: 1, flexDirection: 'column', padding: '8px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Label size={8}>COMMITS · 12 SEMANAS</Label>
          <div style={{ display: 'flex', alignItems: 'flex-end', fontFamily: SANS, fontSize: 10 }}>
            <Big size={16}>{String(gh.commits.week)}</Big>
            <div style={{ display: 'flex', margin: '0 6px 2px 3px' }}>sem</div>
            <Big size={16}>{String(gh.commits.month)}</Big>
            <div style={{ display: 'flex', margin: '0 0 2px 3px' }}>mês</div>
          </div>
        </div>
        <div style={{ display: 'flex', margin: '4px 0' }}><Bars values={gh.commits.weekly} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 10, color: INK_MUTED }}>
          <div style={{ display: 'flex' }}>{`merge em ${merge}`}</div>
          <div style={{ display: 'flex' }}>{`mês ${lines}`}</div>
        </div>
      </div>
      <div style={{ ...darkCard, width: 112, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Big size={36} color={PAPER_LIGHT}>{String(gh.streak)}</Big>
        <Label size={8} color={PAPER_DARKER}>DIAS DE STREAK</Label>
      </div>
    </div>
  )
}

function KeyValue({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 11, padding: '2px 0', borderTop: `1px solid ${PAPER_DARK}` }}>
      <div style={{ display: 'flex' }}>{k}</div>
      <div style={{ display: 'flex', fontFamily: SERIF, fontWeight: 700 }}>{v}</div>
    </div>
  )
}

function deployText(d: GithubDeploy, now: Date): string {
  if (d.state === null || d.at === null) return 'sem execuções'
  const label = { success: 'OK', failure: 'FALHOU', running: 'RODANDO' }[d.state]
  return `${label} · ${ageLabel(d.at, now)}`
}

function ReposAndDeploys({ gh, now }: { gh: GithubStats; now: Date }) {
  const repo = (r: { repo: string; commits: number } | null) => (r ? `${repoName(r.repo)} · ${r.commits}` : '—')
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ ...card, flex: 1, flexDirection: 'column', padding: '6px 12px' }}>
        <Label size={8}>REPO MAIS CONTRIBUÍDO</Label>
        <KeyValue k="12 meses" v={repo(gh.topRepo.year)} />
        <KeyValue k="este mês" v={repo(gh.topRepo.month)} />
      </div>
      {gh.deploys.length ? (
        <div style={{ ...(gh.deploys.some((d) => d.state === 'failure') ? darkCard : card), flex: 1, flexDirection: 'column', padding: '6px 12px' }}>
          <Label size={8} color={muted(gh.deploys.some((d) => d.state === 'failure'))}>ÚLTIMOS DEPLOYS</Label>
          {gh.deploys.slice(0, 2).map((d) => (
            <div key={d.repo} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 11, padding: '2px 0', borderTop: `1px solid ${PAPER_DARK}` }}>
              <div style={{ display: 'flex' }}>{repoName(d.repo)}</div>
              <div style={{ display: 'flex', fontWeight: d.state === 'failure' ? 700 : 400 }}>{deployText(d, now)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ciBadge(pr: GithubPr) {
  if (pr.ci === 'success') return <Badge>CI OK</Badge>
  if (pr.ci === 'failure') return <Badge filled>CI FALHOU</Badge>
  if (pr.ci === 'pending') return <Badge>CI ...</Badge>
  return null
}

function PrRow({ pr, right }: { pr: GithubPr; right: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderTop: `1px solid ${PAPER_DARK}`, fontFamily: SANS, fontSize: 11 }}>
      <div style={{ display: 'flex', fontWeight: 700, flexShrink: 0 }}>{`${repoName(pr.repo)} #${pr.number}`}</div>
      <div style={{ display: 'flex', flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{pr.title}</div>
      {right === '' ? null : <div style={{ display: 'flex', flexShrink: 0, fontSize: 10, color: INK_MUTED }}>{right}</div>}
    </div>
  )
}

function PrLists({ gh, now }: { gh: GithubStats; now: Date }) {
  return (
    <div style={{ ...card, flexDirection: 'column', padding: '6px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
        <Label size={8}>{`MEUS PRS ABERTOS · ${gh.openPrs.length}`}</Label>
        <Label size={8}>CI · APROVAÇÕES · IDADE</Label>
      </div>
      {gh.openPrs.slice(0, 2).map((pr) => (
        <div key={`${pr.repo}#${pr.number}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', flex: 1, minWidth: 0 }}><PrRow pr={pr} right={`${pr.approvals} · ${ageLabel(pr.createdAt, now)}`} /></div>
          {ciBadge(pr)}
        </div>
      ))}
      <div style={{ display: 'flex', marginTop: 4 }}>
        <Label size={8}>{`ESPERANDO MEU REVIEW · ${gh.reviewQueue.length}`}</Label>
      </div>
      {gh.reviewQueue.slice(0, 2).map((pr) => (
        <PrRow key={`${pr.repo}#${pr.number}`} pr={pr} right={`@${pr.author} · ${ageLabel(pr.createdAt, now)}`} />
      ))}
    </div>
  )
}

function Github({ gh, now }: { gh: GithubStats | null; now: Date }) {
  if (!gh) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <SectionHeader label="GITHUB" meta="indisponível" marginBottom={0} />
        <Note>GITHUB_TOKEN não configurado ou GitHub fora do ar</Note>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <SectionHeader label="GITHUB" meta={gh.login} marginBottom={0} />
      <div style={{ display: 'flex', gap: 8 }}>
        <PrCounts title="PRS QUE ABRI" counts={gh.prsOpened} />
        <PrCounts title="PRS QUE REVISEI" counts={gh.prsReviewed} />
      </div>
      <Commits gh={gh} />
      <ReposAndDeploys gh={gh} now={now} />
      <PrLists gh={gh} now={now} />
    </div>
  )
}

function LimitCard({ title, pct, note, dark }: { title: string; pct: number | null; note: string; dark: boolean }) {
  return (
    <div style={{ ...(dark ? darkCard : card), flex: 1, alignItems: 'center', padding: '8px 12px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', marginRight: 12 }}>
        <Label size={8} color={muted(dark)}>{title}</Label>
        <Big size={30} color={dark ? PAPER_LIGHT : INK}>{pct === null ? '—' : `${Math.round(pct)}%`}</Big>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Meter pct={pct ?? 0} dark={dark} />
        <div style={{ display: 'flex', marginTop: 3 }}><Label size={8} color={muted(dark)}>{note}</Label></div>
      </div>
    </div>
  )
}

function Claude({ claude, now }: { claude: ClaudeSummary | null; now: Date }) {
  if (!claude) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <SectionHeader label="CLAUDE" meta="sem dados" marginBottom={0} />
        <Note>Aguardando o primeiro relatório do claude-reporter</Note>
      </div>
    )
  }
  const stale = now.getTime() - claude.receivedAt > CLAUDE_STALE_MS
  const limitsStale = claude.limits !== null && now.getTime() - new Date(claude.limits.at).getTime() > CLAUDE_STALE_MS
  const meta = [
    stale ? `sem dados há ${ageLabel(claude.receivedAt, now)}` : `atualizado ${clockTime(claude.receivedAt)}`,
    limitsStale && claude.limits ? `limites de ${clockTime(claude.limits.at)}` : null,
  ].filter(Boolean).join(' · ')
  const five = claude.limits?.fiveHour ?? null
  const seven = claude.limits?.sevenDay ?? null
  const split = [
    claude.cachePct === null ? null : `cache ${claude.cachePct}%`,
    claude.models[0] ? `${claude.models[0].name} ${claude.models[0].pct}%` : null,
    claude.topProject ? `top: ${claude.topProject}` : null,
  ].filter(Boolean).join(' · ').toUpperCase()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <SectionHeader label="CLAUDE" meta={meta} marginBottom={0} />
      <div style={{ display: 'flex', gap: 8 }}>
        <LimitCard title="SESSÃO 5H" pct={five?.utilization ?? null} note={five ? `reseta ${untilLabel(five.resetsAt, now)}` : 'sem leitura'} dark />
        <LimitCard title="SEMANAL" pct={seven?.utilization ?? null} note={seven ? `reseta ${weekdayTime(seven.resetsAt)}` : 'sem leitura'} dark={(seven?.utilization ?? 0) >= 90} />
      </div>
      <div style={{ ...card, alignItems: 'center', padding: '8px 12px', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 200 }}>
          <Label size={8}>TOKENS · CLAUDE CODE</Label>
          <Stat3 size={17} items={[[compactNumber(claude.tokens.today), 'HOJE'], [compactNumber(claude.tokens.week), 'SEMANA'], [compactNumber(claude.tokens.month), 'MÊS']]} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <Bars values={claude.daily} height={26} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 3 }}><Label size={8} spacing={1}>{split}</Label></div>
        </div>
      </div>
    </div>
  )
}

export async function renderWorkPng(
  github: GithubStats | null,
  claude: ClaudeSummary | null,
  size: ImageSize = DEFAULT_IMAGE_SIZE,
  now = new Date()
): Promise<Buffer> {
  return renderKindlePng(
    <Page gap={10}>
      <Github gh={github} now={now} />
      <Claude claude={claude} now={now} />
    </Page>,
    size
  )
}
```

`PAPER` is imported for consistency with the other renderers; if ESLint reports it unused, drop it from the import.

- [ ] **Step 8: Implement the route and guard it**

`src/app/api/kindle/work.png/route.ts`:

```ts
import { getCachedGithubStats } from '@/lib/server-cache'
import { getClaudeReport } from '@/lib/reports'
import { summarizeClaude } from '@/lib/claude-summary'
import { renderWorkPng } from '@/lib/work-image'
import { imageSizeFrom, pngResponse } from '@/lib/kindle-png'
import type { GithubStats } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Work tab (GitHub + Claude) as a grayscale PNG for the KOReader plugin.
export async function GET(request: Request): Promise<Response> {
  const size = imageSizeFrom(new URL(request.url).searchParams)
  const github = await getCachedGithubStats().catch((err): GithubStats | null => {
    console.error('[api/kindle/work.png] github', err)
    return null
  })
  const stored = getClaudeReport()
  const claude = stored ? summarizeClaude(stored, new Date()) : null
  return pngResponse('api/kindle/work.png', () => renderWorkPng(github, claude, size))
}
```

In `src/proxy.ts`, add these two lines at the end of the `matcher` array (and change the comment above `config` to start with `// The Spotify API, the players, the Work and Servers images and the OAuth start.`):

```ts
    '/api/kindle/work.png',
    '/api/kindle/servers.png',
```

In `src/__tests__/proxy.test.ts`, rename the test `'only guards the Spotify routes'` to `'guards the Spotify routes and the Work/Servers images'` and add inside it:

```ts
    expect(config.matcher).toContain('/api/kindle/work.png')
    expect(config.matcher).toContain('/api/kindle/servers.png')
    expect(config.matcher).not.toContain('/api/kindle/dashboard.png')
```

- [ ] **Step 9: Run the tests**

Run: `npx jest src/__tests__/api/kindle-work-png.test.ts src/__tests__/proxy.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS, no type or lint errors.

- [ ] **Step 10: Look at the real image**

In `.env` (local) set `GITHUB_TOKEN=` to the output of `gh auth token`, `GITHUB_DEPLOY_REPOS=KsmKayk/kindle-dashboard,KsmKayk/portfolio`, `TZ=America/Sao_Paulo`. Restart `npm run dev`, then:

```bash
curl -s "http://localhost:3000/api/kindle/work.png?w=600&h=744" -o .superpowers/preview/work-1.png
sleep 90
curl -s "http://localhost:3000/api/kindle/work.png?w=600&h=744" -o .superpowers/preview/work-2.png
```

(If `KINDLE_API_TOKEN` is set locally, add `&token=<it>`.) Expected: `work-1.png` has the GitHub section with `—` averages and a "Aguardando o primeiro relatório" Claude note; `work-2.png` (after the background load) has the 12-month averages and the most-contributed repo. Compare with the mockup `work-servers-v3.html`. Fix spacing until nothing overflows the 744 px height (Satori clips silently: check the last card is fully visible).

- [ ] **Step 11: Commit**

```bash
git add src/lib/claude-summary.ts src/lib/work-image.tsx src/app/api/kindle/work.png/route.ts src/proxy.ts src/__tests__/lib/claude-summary.test.ts src/__tests__/api/kindle-work-png.test.ts src/__tests__/proxy.test.ts
git commit -m "feat: Work tab image with GitHub and Claude usage"
```

### Task 12: Claude reporter, log parsing (`claude-reporter/lib.mjs`)

**Files:**
- Create: `claude-reporter/lib.mjs`, `claude-reporter/test/lib.test.mjs`
- Modify: `jest.config.ts`, `package.json`, `.gitignore`, `.dockerignore`

- [ ] **Step 1: Keep Jest out of the reporters and add a test script**

In `jest.config.ts`, add to `config`:

```ts
  // claude-reporter/, server-agent/ and the KOReader plugin have their own tests
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/claude-reporter/', '<rootDir>/server-agent/', '<rootDir>/koreader-plugin/'],
```

In `package.json` `scripts`, add:

```json
    "test:reporters": "node --test claude-reporter/test/lib.test.mjs server-agent/test/lib.test.mjs"
```

Append to `.gitignore`:

```
# reporter configs and state (secrets, per machine)
claude-reporter/config.json
claude-reporter/state.json
claude-reporter/last-run.log
server-agent/config.json
```

Append to `.dockerignore`:

```
claude-reporter
server-agent
koreader-plugin
trmnl-plugin
```

- [ ] **Step 2: Write the failing test**

`claude-reporter/test/lib.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { usageFromLine, emptyState, addUsage, pruneState, completeLines, daysForReport, limitsFromUsage, localDay } from '../lib.mjs'

const line = (overrides = {}) => JSON.stringify({
  type: 'assistant',
  timestamp: '2026-10-28T19:12:33.933Z',
  requestId: 'req_1',
  cwd: 'D:\\Workspace\\Node\\kindle-dashboard',
  message: {
    id: 'msg_1',
    model: 'claude-opus-5-5',
    usage: { input_tokens: 2, cache_creation_input_tokens: 21042, cache_read_input_tokens: 30417, output_tokens: 287 },
  },
  ...overrides,
})

test('usageFromLine reads an assistant entry', () => {
  const u = usageFromLine(line())
  assert.equal(u.key, 'msg_1:req_1')
  assert.equal(u.date, localDay(new Date('2026-10-28T19:12:33.933Z')))
  assert.equal(u.model, 'claude-opus-5-5')
  assert.equal(u.project, 'kindle-dashboard')
  assert.deepEqual([u.input, u.output, u.cacheWrite, u.cacheRead], [2, 287, 21042, 30417])
})

test('usageFromLine skips other entries', () => {
  assert.equal(usageFromLine('not json'), null)
  assert.equal(usageFromLine(JSON.stringify({ type: 'user', message: {} })), null)
  assert.equal(usageFromLine(line({ message: { id: 'm', model: '<synthetic>', usage: { input_tokens: 1 } } })), null)
})

test('addUsage counts each message once and splits by model and project', () => {
  const state = emptyState()
  addUsage(state, usageFromLine(line()))
  addUsage(state, usageFromLine(line()))  // same message, other file
  addUsage(state, usageFromLine(line({ requestId: 'req_2', message: { id: 'msg_2', model: 'claude-sonnet-5-5', usage: { output_tokens: 13 } } })))
  const day = state.days[localDay(new Date('2026-10-28T19:12:33.933Z'))]
  assert.equal(day.output, 300)
  assert.equal(day.byModel['claude-opus-5-5'], 2 + 287 + 21042 + 30417)
  assert.equal(day.byModel['claude-sonnet-5-5'], 13)
  assert.equal(day.byProject['kindle-dashboard'], 2 + 287 + 21042 + 30417 + 13)
})

test('pruneState drops days and seen keys older than 35 days', () => {
  const state = emptyState()
  addUsage(state, { key: 'old', date: '2026-09-01', model: 'm', project: 'p', input: 1, output: 0, cacheWrite: 0, cacheRead: 0 })
  addUsage(state, { key: 'new', date: '2026-10-20', model: 'm', project: 'p', input: 1, output: 0, cacheWrite: 0, cacheRead: 0 })
  pruneState(state, new Date(2026, 9, 29))
  assert.deepEqual(Object.keys(state.days), ['2026-10-20'])
  assert.deepEqual(Object.keys(state.seen), ['new'])
})

test('completeLines keeps a partial last line for the next run', () => {
  const text = 'a\nb\npart'
  const { lines, consumed } = completeLines(Buffer.from(text))
  assert.deepEqual(lines, ['a', 'b'])
  assert.equal(consumed, 4)
})

test('daysForReport sorts days', () => {
  const state = emptyState()
  addUsage(state, { key: '2', date: '2026-10-29', model: 'm', project: 'p', input: 1, output: 0, cacheWrite: 0, cacheRead: 0 })
  addUsage(state, { key: '1', date: '2026-10-28', model: 'm', project: 'p', input: 1, output: 0, cacheWrite: 0, cacheRead: 0 })
  assert.deepEqual(daysForReport(state).map((d) => d.date), ['2026-10-28', '2026-10-29'])
})

test('limitsFromUsage maps the usage endpoint', () => {
  const limits = limitsFromUsage({
    five_hour: { utilization: 4.0, resets_at: '2026-10-29T19:09:59.553598+00:00' },
    seven_day: { utilization: 0.0, resets_at: '2026-11-05T06:59:59.553619+00:00' },
    seven_day_opus: null,
  }, new Date('2026-10-29T15:00:00Z'))
  assert.deepEqual(limits, {
    fiveHour: { utilization: 4, resetsAt: '2026-10-29T19:09:59.553598+00:00' },
    sevenDay: { utilization: 0, resetsAt: '2026-11-05T06:59:59.553619+00:00' },
    at: '2026-10-29T15:00:00.000Z',
  })
  assert.equal(limitsFromUsage({ five_hour: null, seven_day: null }, new Date()).fiveHour, null)
})
```

- [ ] **Step 3: Run it and see it fail**

Run: `node --test claude-reporter/test/lib.test.mjs`
Expected: FAIL, `Cannot find module …/claude-reporter/lib.mjs`.

- [ ] **Step 4: Implement**

`claude-reporter/lib.mjs`:

```js
// Pure helpers of the Claude reporter: reading Claude Code's JSONL logs into
// per-day token totals, and mapping the /usage endpoint. See report.mjs.

const KEEP_DAYS = 35

const pad = (n) => String(n).padStart(2, '0')

export function localDay(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// One assistant message's usage, or null for any other line
export function usageFromLine(text) {
  let entry
  try {
    entry = JSON.parse(text)
  } catch {
    return null
  }
  const message = entry?.message
  const usage = message?.usage
  if (entry?.type !== 'assistant' || !usage || !message.id || !message.model || message.model === '<synthetic>') return null
  return {
    key: `${message.id}:${entry.requestId ?? ''}`,
    date: localDay(new Date(entry.timestamp)),
    model: message.model,
    project: String(entry.cwd ?? 'unknown').split(/[\\/]/).filter(Boolean).pop() ?? 'unknown',
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
  }
}

// files: byte offset read so far per log file; seen: message key → date
export function emptyState() {
  return { files: {}, seen: {}, days: {} }
}

export function addUsage(state, u) {
  if (!u || state.seen[u.key]) return
  state.seen[u.key] = u.date
  const day = (state.days[u.date] ??= { date: u.date, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, byModel: {}, byProject: {} })
  const total = u.input + u.output + u.cacheWrite + u.cacheRead
  day.input += u.input
  day.output += u.output
  day.cacheWrite += u.cacheWrite
  day.cacheRead += u.cacheRead
  day.byModel[u.model] = (day.byModel[u.model] ?? 0) + total
  day.byProject[u.project] = (day.byProject[u.project] ?? 0) + total
}

export function pruneState(state, now) {
  const oldest = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - KEEP_DAYS))
  for (const date of Object.keys(state.days)) if (date < oldest) delete state.days[date]
  for (const [key, date] of Object.entries(state.seen)) if (date < oldest) delete state.seen[key]
}

// Splits a chunk into complete lines; `consumed` is the byte count up to the
// last newline, so a line still being written is read again next run
export function completeLines(buffer) {
  const end = buffer.lastIndexOf(0x0a)
  if (end < 0) return { lines: [], consumed: 0 }
  return { lines: buffer.subarray(0, end).toString('utf8').split('\n').filter(Boolean), consumed: end + 1 }
}

export function daysForReport(state) {
  return Object.values(state.days).sort((a, b) => a.date.localeCompare(b.date))
}

const limit = (v) => (v && typeof v.utilization === 'number' ? { utilization: v.utilization, resetsAt: v.resets_at } : null)

export function limitsFromUsage(body, now) {
  return { fiveHour: limit(body.five_hour), sevenDay: limit(body.seven_day), at: now.toISOString() }
}
```

- [ ] **Step 5: Run the tests**

Run: `node --test claude-reporter/test/lib.test.mjs && npm test`
Expected: all pass (Jest ignores the reporter folders).

- [ ] **Step 6: Commit**

```bash
git add claude-reporter/lib.mjs claude-reporter/test/lib.test.mjs jest.config.ts package.json .gitignore .dockerignore
git commit -m "feat: Claude Code log parsing for the Claude reporter"
```

### Task 13: Claude reporter, main script and Windows install

**Files:**
- Create: `claude-reporter/report.mjs`, `claude-reporter/run-hidden.vbs`, `claude-reporter/install.ps1`, `claude-reporter/config.example.json`, `claude-reporter/README.md`

- [ ] **Step 1: Write the main script**

`claude-reporter/report.mjs`:

```js
// Sends Claude usage to the kindle-dashboard server (POST /api/claude/report):
// the 5-hour and weekly limits from the endpoint Claude Code uses for /usage,
// and per-day token totals from Claude Code's logs (~/.claude/projects).
// Run every 5 minutes by Task Scheduler (install.ps1). Never refreshes the
// login token: that would rotate it and could sign Claude Code out.

import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { addUsage, completeLines, daysForReport, emptyState, limitsFromUsage, pruneState, usageFromLine } from './lib.mjs'

const here = new URL('.', import.meta.url)
const config = JSON.parse(readFileSync(new URL('config.json', here), 'utf8'))
const statePath = new URL('state.json', here)
const claudeDir = config.claudeDir ?? join(homedir(), '.claude')

function loadState() {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'))
  } catch {
    return emptyState()
  }
}

function logFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return logFiles(path)
    return entry.name.endsWith('.jsonl') ? [path] : []
  })
}

// Reads what was appended to each log since the last run
function scanLogs(state) {
  for (const file of logFiles(join(claudeDir, 'projects'))) {
    const size = statSync(file).size
    let offset = state.files[file] ?? 0
    if (size < offset) offset = 0  // file was rewritten: read it again (seen keys prevent double counts)
    if (size === offset) continue
    const buffer = Buffer.alloc(size - offset)
    const fd = openSync(file, 'r')
    try {
      readSync(fd, buffer, 0, buffer.length, offset)
    } finally {
      closeSync(fd)
    }
    const { lines, consumed } = completeLines(buffer)
    for (const line of lines) addUsage(state, usageFromLine(line))
    state.files[file] = offset + consumed
  }
}

async function readLimits() {
  try {
    const credentials = JSON.parse(readFileSync(join(claudeDir, '.credentials.json'), 'utf8'))
    const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: { Authorization: `Bearer ${credentials.claudeAiOauth.accessToken}`, 'anthropic-beta': 'oauth-2025-04-20' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`usage endpoint answered ${res.status}`)
    return limitsFromUsage(await res.json(), new Date())
  } catch (err) {
    console.error('limits unavailable:', err.message)
    return null
  }
}

const state = loadState()
scanLogs(state)
pruneState(state, new Date())
// Saved before sending: totals are re-sent in full next time if this send fails
writeFileSync(statePath, JSON.stringify(state))

const report = { limits: await readLimits(), days: daysForReport(state) }
const res = await fetch(`${config.dashboardUrl.replace(/\/+$/, '')}/api/claude/report`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${config.reportToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(report),
  signal: AbortSignal.timeout(15_000),
})
if (!res.ok) {
  console.error(`dashboard answered ${res.status}: ${await res.text()}`)
  process.exit(1)
}
console.log(`${new Date().toISOString()} sent ${report.days.length} days, limits ${report.limits ? 'ok' : 'missing'}`)
```

`claude-reporter/config.example.json`:

```json
{
  "dashboardUrl": "https://kindle.ksmkayk.com.br",
  "reportToken": "same value as REPORT_TOKEN in the server's .env"
}
```

`claude-reporter/run-hidden.vbs`:

```vbs
' Runs report.mjs without a console window (Task Scheduler starts this with wscript)
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "cmd /c node """ & dir & "\report.mjs"" > """ & dir & "\last-run.log"" 2>&1", 0, False
```

`claude-reporter/install.ps1`:

```powershell
# Registers a Task Scheduler task that runs the Claude reporter every 5 minutes,
# hidden, as the current user. Run again to update it; remove it with:
#   Unregister-ScheduledTask -TaskName KindleDashClaudeReporter -Confirm:$false
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path "$dir\config.json")) { throw "Create $dir\config.json from config.example.json first" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "node is not on PATH" }

$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$dir\run-hidden.vbs`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 4) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'KindleDashClaudeReporter' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName 'KindleDashClaudeReporter'
Write-Host "Installed. Output of each run: $dir\last-run.log"
```

`claude-reporter/README.md`:

```markdown
# Claude reporter

Sends Claude usage to the dashboard's Work tab every 5 minutes: the **5-hour session** and **weekly**
limits (from the endpoint Claude Code uses for `/usage`) and **tokens per day** from Claude Code's logs
(`~/.claude/projects/**/*.jsonl`). Runs on the Windows PC that uses Claude Code; plain Node, no packages.

1. `copy config.example.json config.json` and fill in the dashboard URL and the server's `REPORT_TOKEN`.
2. Try it once: `node report.mjs` (prints `sent N days, limits ok`).
3. Install the scheduled task: `powershell -ExecutionPolicy Bypass -File install.ps1`.

Notes
- It reads the login token Claude Code keeps in `~/.claude/.credentials.json` and never refreshes it. When
  that token has expired (PC woke up with Claude Code closed), the report goes out without limits and the
  dashboard keeps the last ones, labelled with their time.
- The `/usage` endpoint is undocumented and may change; tokens keep working if it does.
- `state.json` remembers how far each log was read; delete it to recount the last 35 days.
```

- [ ] **Step 2: Try it against the local dev server**

With `npm run dev` running and `REPORT_TOKEN=test-report` in the local `.env` (restart dev after adding it):

```bash
cd claude-reporter
printf '{ "dashboardUrl": "http://localhost:3000", "reportToken": "test-report" }' > config.json
node report.mjs
cd ..
curl -s "http://localhost:3000/api/kindle/work.png?w=600&h=744" -o .superpowers/preview/work-3.png
```

Expected: `… sent N days, limits ok` (first run reads all logs, may take ~10 s); the PNG's Claude section now shows both limits and the token figures. Run `node claude-reporter/report.mjs` again: it should finish in about a second (incremental).

- [ ] **Step 3: Commit**

```bash
git add claude-reporter/report.mjs claude-reporter/run-hidden.vbs claude-reporter/install.ps1 claude-reporter/config.example.json claude-reporter/README.md
git commit -m "feat: Claude reporter for the Work tab"
```

---

## Phase 4: Servers tab

### Task 14: server agent parsers (`server-agent/lib.mjs`)

**Files:**
- Create: `server-agent/lib.mjs`, `server-agent/test/lib.test.mjs`

Samples below were captured from kayk-server on 2026-10-29.

- [ ] **Step 1: Write the failing test**

`server-agent/test/lib.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMdstat, parseCpu, cpuPct, parseMeminfo, parseNetDev, netRate, smartFromJson, containerFromApi, mountDevice } from '../lib.mjs'

const MDSTAT = `Personalities : [raid1] [raid0] [raid6] [raid5] [raid4] [raid10]
md0 : active raid1 sdb1[2] sdc1[0]
      1953381376 blocks super 1.2 [2/2] [UU]
      bitmap: 0/15 pages [0KB], 65536KB chunk

unused devices: <none>
`

const MDSTAT_DEGRADED = `md0 : active raid1 sdc1[0] sdb1[2](F)
      1953381376 blocks super 1.2 [2/1] [U_]
      [=>...................]  recovery = 7.5% (147000/1953381376) finish=200min speed=150000K/sec
`

test('parseMdstat reads a healthy RAID 1', () => {
  assert.deepEqual(parseMdstat(MDSTAT), [{ device: 'md0', level: 'RAID 1', state: 'UU', active: 2, total: 2, members: ['sdb1', 'sdc1'], syncPct: null }])
})

test('parseMdstat reads a degraded, recovering array', () => {
  const [md] = parseMdstat(MDSTAT_DEGRADED)
  assert.equal(md.state, 'U_')
  assert.equal(md.active, 1)
  assert.equal(md.total, 2)
  assert.equal(md.syncPct, 7.5)
})

test('cpu usage from two /proc/stat samples', () => {
  const a = parseCpu('cpu  100 0 100 700 100 0 0 0 0 0\ncpu0 1 2 3')
  const b = parseCpu('cpu  150 0 150 750 150 0 0 0 0 0\n')
  assert.deepEqual(a, { idle: 800, total: 1000 })
  assert.equal(cpuPct(a, b), 50)
})

test('parseMeminfo uses MemAvailable', () => {
  const mem = parseMeminfo('MemTotal:        5883984 kB\nMemFree:          129000 kB\nMemAvailable:    3429288 kB\n')
  assert.deepEqual(mem, { totalBytes: 5883984 * 1024, usedBytes: (5883984 - 3429288) * 1024 })
})

test('network counters only for the given interfaces', () => {
  const text = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 386263116 1973208    0    0    0     0          0         0 386263116 1973208    0    0    0     0       0          0
enp2s0f0: 90053037150 71513284    0 485844    0     0          0     10575 52113023114 57981406    1    0    0     0       0          0
nordlynx: 74492947644 60207200    0    0    0     0          0         0 30870636412 43474506    0 14734    0     0       0          0
`
  const a = parseNetDev(text, new Set(['enp2s0f0']))
  assert.deepEqual(a, { rx: 90053037150, tx: 52113023114 })
  assert.deepEqual(netRate(a, { rx: a.rx + 2048, tx: a.tx + 1024 }, 2), { rxBps: 1024, txBps: 512 })
})

test('smartFromJson reads health, temperature and sector counts', () => {
  const json = {
    smart_status: { passed: true },
    temperature: { current: 35 },
    ata_smart_attributes: { table: [{ id: 5, raw: { value: 0 } }, { id: 197, raw: { value: 2 } }] },
  }
  assert.deepEqual(smartFromJson('sdb', json), { device: 'sdb', healthy: true, tempC: 35, reallocated: 0, pending: 2 })
  assert.deepEqual(smartFromJson('sda', {}), { device: 'sda', healthy: null, tempC: null, reallocated: null, pending: null })
})

test('containerFromApi lists unique published ports', () => {
  const c = containerFromApi({
    Id: 'abc', Names: ['/kindle-dashboard-dashboard-1'], State: 'running', Status: 'Up 3 days',
    Ports: [{ PrivatePort: 3000, PublicPort: 3400 }, { PrivatePort: 3000, PublicPort: 3400 }, { PrivatePort: 5432 }],
  })
  assert.deepEqual(c, { name: 'kindle-dashboard-dashboard-1', state: 'running', status: 'Up 3 days', ports: [3400] })
})

test('mountDevice finds the device of a mount point', () => {
  const mounts = '/dev/mapper/ubuntu--vg-ubuntu--lv / ext4 rw 0 0\n/dev/md0 /mnt/raid1 ext4 rw 0 0\nproc /proc proc rw 0 0\n'
  assert.equal(mountDevice(mounts, '/mnt/raid1'), '/dev/md0')
  assert.equal(mountDevice(mounts, '/'), '/dev/mapper/ubuntu--vg-ubuntu--lv')
  assert.equal(mountDevice(mounts, '/nope'), null)
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test server-agent/test/lib.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`server-agent/lib.mjs`:

```js
// Pure parsers of the server agent (/proc files, smartctl JSON, Docker API).

// /proc/mdstat → [{ device, level, state, active, total, members, syncPct }]
export function parseMdstat(text) {
  const arrays = []
  let current = null
  for (const line of text.split('\n')) {
    const head = line.match(/^(md\d+)\s*:\s*\w+(?:\s+\([^)]*\))?\s+(raid\d+|linear)\s+(.*)$/)
    if (head) {
      current = {
        device: head[1],
        level: head[2].replace(/^raid(\d+)$/, 'RAID $1'),
        state: '',
        active: 0,
        total: 0,
        members: [...head[3].matchAll(/(\w+)\[\d+\]/g)].map((m) => m[1]).sort(),
        syncPct: null,
      }
      arrays.push(current)
      continue
    }
    if (!current) continue
    const counts = line.match(/\[(\d+)\/(\d+)\]\s+\[([U_]+)\]/)
    if (counts) {
      current.total = Number(counts[1])
      current.active = Number(counts[2])
      current.state = counts[3]
    }
    const sync = line.match(/(?:resync|recovery|reshape|check)\s*=\s*([\d.]+)%/)
    if (sync) current.syncPct = Number(sync[1])
  }
  return arrays
}

// First line of /proc/stat → { idle, total } jiffies
export function parseCpu(text) {
  const fields = text.split('\n')[0].trim().split(/\s+/).slice(1).map(Number)
  return { idle: fields[3] + (fields[4] ?? 0), total: fields.reduce((a, b) => a + b, 0) }
}

export function cpuPct(a, b) {
  const total = b.total - a.total
  return total > 0 ? Math.round((1 - (b.idle - a.idle) / total) * 1000) / 10 : 0
}

export function parseMeminfo(text) {
  const kb = (name) => Number(text.match(new RegExp(`^${name}:\\s+(\\d+)`, 'm'))?.[1] ?? 0)
  const total = kb('MemTotal')
  return { totalBytes: total * 1024, usedBytes: (total - kb('MemAvailable')) * 1024 }
}

// Sum of received/sent bytes over `interfaces` in /proc/net/dev
export function parseNetDev(text, interfaces) {
  let rx = 0
  let tx = 0
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*([^:\s]+):\s*(.*)$/)
    if (!match || !interfaces.has(match[1])) continue
    const fields = match[2].trim().split(/\s+/).map(Number)
    rx += fields[0]
    tx += fields[8]
  }
  return { rx, tx }
}

export function netRate(a, b, seconds) {
  return { rxBps: Math.max(0, Math.round((b.rx - a.rx) / seconds)), txBps: Math.max(0, Math.round((b.tx - a.tx) / seconds)) }
}

// `smartctl -j -H -A /dev/<device>` output → disk health
export function smartFromJson(device, json) {
  const table = json.ata_smart_attributes?.table ?? []
  const raw = (id) => table.find((a) => a.id === id)?.raw?.value ?? null
  const passed = json.smart_status?.passed
  return {
    device,
    healthy: typeof passed === 'boolean' ? passed : null,
    tempC: json.temperature?.current ?? null,
    reallocated: raw(5),
    pending: raw(197),
  }
}

// Docker Engine API /containers/json item → { name, state, status, ports }
export function containerFromApi(c) {
  const ports = [...new Set((c.Ports ?? []).filter((p) => p.PublicPort).map((p) => p.PublicPort))].sort((a, b) => a - b)
  return { name: (c.Names?.[0] ?? c.Id.slice(0, 12)).replace(/^\//, ''), state: c.State, status: c.Status, ports }
}

// Device mounted at `path` in a /proc/<pid>/mounts text (the last match wins)
export function mountDevice(mountsText, path) {
  let device = null
  for (const line of mountsText.split('\n')) {
    const [dev, point] = line.split(' ')
    if (point === path) device = dev
  }
  return device
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test server-agent/test/lib.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server-agent/lib.mjs server-agent/test/lib.test.mjs
git commit -m "feat: parsers for the server agent"
```

### Task 15: server agent, collector and container

**Files:**
- Create: `server-agent/agent.mjs`, `server-agent/Dockerfile`, `server-agent/compose.yaml`, `server-agent/config.example.json`, `server-agent/README.md`

- [ ] **Step 1: Write the collector**

`server-agent/agent.mjs`:

```js
// Reports this server's status to the kindle-dashboard server every minute
// (POST /api/servers/report). Runs in the container from compose.yaml, which
// gives it the host's /proc, /sys, network, disks (for SMART) and Docker socket,
// and the host's / read-only at /host.

import { execFile } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, realpathSync, statfsSync } from 'node:fs'
import { request } from 'node:http'
import { arch, cpus } from 'node:os'
import { basename, dirname } from 'node:path'
import { promisify } from 'node:util'
import { containerFromApi, cpuPct, mountDevice, netRate, parseCpu, parseMdstat, parseMeminfo, parseNetDev, smartFromJson } from './lib.mjs'

const config = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'))
const HOST = process.env.HOST_ROOT ?? '/host'
const INTERVAL_MS = (config.intervalSec ?? 60) * 1000
const SAMPLE_MS = 1000
const CPU_SENSORS = ['coretemp', 'k10temp', 'zenpower', 'cpu_thermal', 'soc_thermal']

const run = promisify(execFile)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const read = (path) => readFileSync(path, 'utf8')

function tryRead(path) {
  try {
    return read(path).trim()
  } catch {
    return null
  }
}

const list = (dir) => (existsSync(dir) ? readdirSync(dir) : [])

// Physical network interfaces (skips lo, docker, veth, VPN tunnels such as nordlynx)
function interfaces() {
  return new Set(list('/sys/class/net').filter((name) => existsSync(`/sys/class/net/${name}/device`)))
}

function cpuTemp() {
  for (const hw of list('/sys/class/hwmon')) {
    if (!CPU_SENSORS.includes(tryRead(`/sys/class/hwmon/${hw}/name`))) continue
    const milli = Number(tryRead(`/sys/class/hwmon/${hw}/temp1_input`))
    if (milli) return Math.round(milli / 1000)
  }
  const zone = Number(tryRead('/sys/class/thermal/thermal_zone0/temp'))
  return zone ? Math.round(zone / 1000) : null
}

// "/dev/mapper/vg-lv" → "dm-0", "/dev/sda1" → "sda1"
function blockName(devPath) {
  if (devPath.startsWith('/dev/mapper/')) {
    const name = basename(devPath)
    const dm = list('/sys/block').find((d) => d.startsWith('dm-') && tryRead(`/sys/block/${d}/dm/name`) === name)
    if (dm) return dm
  }
  return basename(devPath)
}

// Physical disks under a block device, through LVM/RAID (slaves) and partitions
function physicalDisks(name) {
  const slaves = list(`/sys/class/block/${name}/slaves`)
  if (slaves.length) return [...new Set(slaves.flatMap(physicalDisks))].sort()
  if (existsSync(`/sys/class/block/${name}/partition`)) return [basename(dirname(realpathSync(`/sys/class/block/${name}`)))]
  return existsSync(`/sys/class/block/${name}`) ? [name] : []
}

async function smart(disk) {
  try {
    // smartctl exits non-zero for warnings too; its JSON is still on stdout
    const { stdout } = await run('smartctl', ['-j', '-H', '-A', `/dev/${disk}`]).catch((err) => ({ stdout: err.stdout ?? '' }))
    return smartFromJson(disk, JSON.parse(stdout))
  } catch {
    return smartFromJson(disk, {})
  }
}

function dockerContainers() {
  return new Promise((resolve) => {
    const req = request({ socketPath: '/var/run/docker.sock', path: '/containers/json?all=1' }, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        try {
          resolve(JSON.parse(body).map(containerFromApi))
        } catch {
          resolve([])
        }
      })
    })
    req.on('error', () => resolve([]))
    req.end()
  })
}

async function mountInfo(path, mountsText, arrays) {
  const stats = statfsSync(path === '/' ? HOST : `${HOST}${path}`)
  const device = mountDevice(mountsText, path)
  const name = device ? blockName(device) : '?'
  const disks = device && config.smart !== false ? await Promise.all(physicalDisks(name).map(smart)) : []
  return {
    path,
    device: name,
    totalBytes: stats.blocks * stats.bsize,
    usedBytes: (stats.blocks - stats.bfree) * stats.bsize,
    raid: arrays.find((a) => a.device === name) ?? null,
    disks,
  }
}

async function collect() {
  const ifaces = interfaces()
  const cpuA = parseCpu(read('/proc/stat'))
  const netA = parseNetDev(read('/proc/net/dev'), ifaces)
  await sleep(SAMPLE_MS)
  const cpuB = parseCpu(read('/proc/stat'))
  const netB = parseNetDev(read('/proc/net/dev'), ifaces)

  const arrays = existsSync('/proc/mdstat') ? parseMdstat(read('/proc/mdstat')) : []
  const mountsText = read('/proc/1/mounts')
  const mounts = []
  for (const path of config.mounts ?? ['/']) mounts.push(await mountInfo(path, mountsText, arrays))

  return {
    id: config.id,
    name: config.name ?? config.id,
    order: config.order ?? 100,
    hostname: tryRead(`${HOST}/etc/hostname`) ?? config.id,
    arch: arch(),
    uptimeSec: Math.round(Number(read('/proc/uptime').split(' ')[0])),
    cpu: { pct: cpuPct(cpuA, cpuB), cores: cpus().length, load1: Number(read('/proc/loadavg').split(' ')[0]), tempC: cpuTemp() },
    mem: parseMeminfo(read('/proc/meminfo')),
    net: netRate(netA, netB, SAMPLE_MS / 1000),
    mounts,
    containers: await dockerContainers(),
  }
}

async function send(report) {
  const res = await fetch(`${config.dashboardUrl.replace(/\/+$/, '')}/api/servers/report`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.reportToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`dashboard answered ${res.status}: ${await res.text()}`)
}

if (process.argv.includes('--once')) {
  console.log(JSON.stringify(await collect(), null, 2))
} else {
  for (;;) {
    const started = Date.now()
    try {
      await send(await collect())
    } catch (err) {
      console.error(new Date().toISOString(), err.message)
    }
    await sleep(Math.max(1000, INTERVAL_MS - (Date.now() - started)))
  }
}
```

- [ ] **Step 2: Container files**

`server-agent/Dockerfile`:

```dockerfile
FROM node:22-alpine
RUN apk add --no-cache smartmontools
WORKDIR /agent
COPY lib.mjs agent.mjs ./
CMD ["node", "agent.mjs"]
```

`server-agent/compose.yaml`:

```yaml
# Server agent for the dashboard's Servers tab. On each server:
#   cp config.example.json config.json  (and edit it), then  docker compose up -d --build
services:
  agent:
    build: .
    restart: unless-stopped
    # SMART needs raw disk access; host network/pid give the host's counters and mounts
    privileged: true
    network_mode: host
    pid: host
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/host:ro
      - ./config.json:/agent/config.json:ro
```

`server-agent/config.example.json`:

```json
{
  "id": "kayk-server",
  "name": "kayk-server",
  "order": 2,
  "dashboardUrl": "https://kindle.ksmkayk.com.br",
  "reportToken": "same value as REPORT_TOKEN in the server's .env",
  "mounts": ["/", "/mnt/raid1"],
  "intervalSec": 60,
  "smart": true
}
```

`server-agent/README.md`:

```markdown
# Server agent

Sends this server's status to the dashboard's Servers tab every minute: CPU, RAM, temperature, network,
the disks listed in `mounts` (with RAID state from `/proc/mdstat` and SMART per physical disk) and the
Docker containers with their published ports. Outbound HTTPS only: no open port, no VPN needed.

    cp config.example.json config.json   # id, name, order, dashboardUrl, reportToken, mounts
    sudo docker compose up -d --build
    sudo docker compose logs -f          # errors only; silent when reports go through

Check what it would send: `sudo docker compose run --rm agent node agent.mjs --once`.

| config | |
|---|---|
| `id` | lowercase letters, digits and `-`; one per server |
| `name` / `order` | title on the Servers tab and its position (lower first) |
| `dashboardUrl` | the dashboard's URL (`http://127.0.0.1:<HOST_PORT>` on the server that runs it) |
| `reportToken` | the dashboard's `REPORT_TOKEN` |
| `mounts` | mount points to show, e.g. `["/", "/mnt/raid1"]` |
| `smart` | `false` to skip SMART (e.g. on cloud VMs without real disks) |

The container is privileged (SMART), uses the host network and PID namespace, mounts the Docker socket
read-only and the host's `/` read-only at `/host`. It never writes to the host.
```

- [ ] **Step 3: Try it on kayk-server**

```bash
ssh kayk@192.168.1.64 'test -d ~/kindle-dashboard || git clone https://github.com/KsmKayk/kindle-dashboard.git ~/kindle-dashboard'
scp server-agent/agent.mjs server-agent/lib.mjs server-agent/Dockerfile server-agent/compose.yaml server-agent/config.example.json kayk@192.168.1.64:~/kindle-dashboard/server-agent/
ssh kayk@192.168.1.64 'cd ~/kindle-dashboard/server-agent && cp -n config.example.json config.json && sudo docker compose build && sudo docker compose run --rm agent node agent.mjs --once'
```

(The `scp` is only for trying it before the branch is pushed; after merging, `git pull` replaces it.) `sudo` asks for kayk's password: run that last command yourself with `! ssh -t kayk@192.168.1.64 '…'` if the tool cannot prompt.

Expected JSON: `arch: "x64"`, `cpu.cores: 4`, `mem.totalBytes` ≈ 6 GB, `mounts` with `/` (`device: "dm-0"`, `disks: [ { device: "sda", … } ]`) and `/mnt/raid1` (`device: "md0"`, `raid.state: "UU"`, `disks` = `sdb`, `sdc` with `healthy: true` and temperatures), `net.rxBps` > 0 (not counting `nordlynx`), and the real container list.

- [ ] **Step 4: Commit**

```bash
git add server-agent/agent.mjs server-agent/Dockerfile server-agent/compose.yaml server-agent/config.example.json server-agent/README.md
git commit -m "feat: server agent for the Servers tab"
```

### Task 16: attention rules and health checks

**Files:**
- Create: `src/lib/servers.ts`, `src/__tests__/lib/servers.test.ts`
- Create: `src/lib/healthcheck.ts`, `src/__tests__/lib/healthcheck.test.ts`
- Modify: `src/lib/server-cache.ts`

- [ ] **Step 1: Write the failing tests**

`src/__tests__/lib/servers.test.ts`:

```ts
import { isStale, diskNeedsAttention, raidNeedsAttention, mountNeedsAttention, ramNeedsAttention, containerDown, usedPct, STALE_MS } from '@/lib/servers'
import type { MountInfo, ServerReport } from '@/types'

const mount: MountInfo = {
  path: '/mnt/raid1', device: 'md0', totalBytes: 100, usedBytes: 22,
  raid: { device: 'md0', level: 'RAID 1', state: 'UU', active: 2, total: 2, members: ['sdb1', 'sdc1'], syncPct: null },
  disks: [{ device: 'sdb', healthy: true, tempC: 35, reallocated: 0, pending: 0 }],
}

it('staleness after 3 minutes without a report', () => {
  const now = 1_000_000_000
  expect(isStale({ receivedAt: now - STALE_MS + 1 } as never, now)).toBe(false)
  expect(isStale({ receivedAt: now - STALE_MS - 1 } as never, now)).toBe(true)
})

it('disk attention: failed SMART or bad sectors', () => {
  expect(diskNeedsAttention(mount.disks[0])).toBe(false)
  expect(diskNeedsAttention({ ...mount.disks[0], healthy: false })).toBe(true)
  expect(diskNeedsAttention({ ...mount.disks[0], pending: 1 })).toBe(true)
  expect(diskNeedsAttention({ device: 'sda', healthy: null, tempC: null, reallocated: null, pending: null })).toBe(false)
})

it('raid attention: degraded or syncing', () => {
  expect(raidNeedsAttention(mount.raid!)).toBe(false)
  expect(raidNeedsAttention({ ...mount.raid!, state: 'U_', active: 1 })).toBe(true)
  expect(raidNeedsAttention({ ...mount.raid!, syncPct: 40 })).toBe(true)
})

it('mount attention: 90% full, RAID or disks', () => {
  expect(usedPct(22, 100)).toBe(22)
  expect(mountNeedsAttention(mount)).toBe(false)
  expect(mountNeedsAttention({ ...mount, usedBytes: 90 })).toBe(true)
  expect(mountNeedsAttention({ ...mount, raid: { ...mount.raid!, state: '_U' } })).toBe(true)
})

it('ram attention at 90%', () => {
  expect(ramNeedsAttention({ mem: { totalBytes: 100, usedBytes: 89 } } as ServerReport)).toBe(false)
  expect(ramNeedsAttention({ mem: { totalBytes: 100, usedBytes: 90 } } as ServerReport)).toBe(true)
})

it('containerDown', () => {
  expect(containerDown({ name: 'a', state: 'running', status: '', ports: [] })).toBe(false)
  expect(containerDown({ name: 'a', state: 'exited', status: '', ports: [] })).toBe(true)
})
```

`src/__tests__/lib/healthcheck.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { parseHealthTargets, checkTarget } from '@/lib/healthcheck'

it('parses label=url pairs', () => {
  expect(parseHealthTargets('site=https://a.com, dash = https://b.com/x ,bad')).toEqual([
    { label: 'site', url: 'https://a.com' },
    { label: 'dash', url: 'https://b.com/x' },
  ])
  expect(parseHealthTargets('')).toEqual([])
})

it('maps responses, redirects and failures', async () => {
  const target = { label: 'site', url: 'https://a.com' }
  const answer = (status: number) => jest.fn().mockResolvedValue(new Response(null, { status }))
  expect(await checkTarget(target, answer(200))).toMatchObject({ label: 'site', ok: true, status: 200 })
  expect(await checkTarget(target, answer(301))).toMatchObject({ ok: true, status: 301 })
  expect(await checkTarget(target, answer(502))).toMatchObject({ ok: false, status: 502 })
  expect(await checkTarget(target, jest.fn().mockRejectedValue(new Error('timeout')))).toEqual({ label: 'site', ok: false, status: null, ms: null })
})
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest src/__tests__/lib/servers.test.ts src/__tests__/lib/healthcheck.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/lib/servers.ts`:

```ts
import type { ContainerInfo, DiskHealth, MountInfo, RaidInfo, ServerReport, StoredServer } from '@/types'

// When a Servers tab card switches to its dark (attention) state.

export const STALE_MS = 3 * 60_000
const FULL_PCT = 90

export const usedPct = (used: number, total: number) => (total > 0 ? (used / total) * 100 : 0)

export const isStale = (server: StoredServer, now: number) => now - server.receivedAt > STALE_MS

export const diskNeedsAttention = (d: DiskHealth) => d.healthy === false || (d.reallocated ?? 0) > 0 || (d.pending ?? 0) > 0

export const raidNeedsAttention = (r: RaidInfo) => r.state.includes('_') || r.active < r.total || r.syncPct !== null

export const mountNeedsAttention = (m: MountInfo) =>
  usedPct(m.usedBytes, m.totalBytes) >= FULL_PCT || (m.raid !== null && raidNeedsAttention(m.raid)) || m.disks.some(diskNeedsAttention)

export const ramNeedsAttention = (r: ServerReport) => usedPct(r.mem.usedBytes, r.mem.totalBytes) >= FULL_PCT

export const containerDown = (c: ContainerInfo) => c.state !== 'running'
```

`src/lib/healthcheck.ts`:

```ts
// HTTP checks of the sites in HEALTHCHECK_URLS ("label=url,label=url"), shown
// at the bottom of the Servers tab. 2xx/3xx = up; errors, 4xx/5xx and timeouts = down.

export interface HealthTarget { label: string; url: string }
export interface HealthResult { label: string; ok: boolean; status: number | null; ms: number | null }

const TIMEOUT_MS = 5_000

export function parseHealthTargets(value = process.env.HEALTHCHECK_URLS ?? ''): HealthTarget[] {
  return value.split(',').flatMap((entry) => {
    const i = entry.indexOf('=')
    if (i <= 0) return []
    return [{ label: entry.slice(0, i).trim(), url: entry.slice(i + 1).trim() }]
  })
}

export async function checkTarget(target: HealthTarget, fetchImpl: typeof fetch = fetch): Promise<HealthResult> {
  const started = Date.now()
  try {
    const res = await fetchImpl(target.url, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
    return { label: target.label, ok: res.status < 400, status: res.status, ms: Date.now() - started }
  } catch {
    return { label: target.label, ok: false, status: null, ms: null }
  }
}
```

In `src/lib/server-cache.ts`, add the import `import { checkTarget, parseHealthTargets, type HealthResult } from './healthcheck'` and, after `getCachedGithubStats`:

```ts
const HEALTH_TTL_MS = 60_000

export function getCachedHealth(): Promise<HealthResult[]> {
  return cached('health', HEALTH_TTL_MS, () => Promise.all(parseHealthTargets().map((t) => checkTarget(t))))
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/__tests__/lib/servers.test.ts src/__tests__/lib/healthcheck.test.ts src/__tests__/lib/server-cache.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/servers.ts src/lib/healthcheck.ts src/lib/server-cache.ts src/__tests__/lib/servers.test.ts src/__tests__/lib/healthcheck.test.ts
git commit -m "feat: attention rules and site health checks for the Servers tab"
```

### Task 17: Servers image and route

**Files:**
- Create: `src/lib/servers-image.tsx`
- Create: `src/app/api/kindle/servers.png/route.ts`, `src/__tests__/api/kindle-servers-png.test.ts`

- [ ] **Step 1: Write the failing route test**

`src/__tests__/api/kindle-servers-png.test.ts`:

```ts
/**
 * @jest-environment node
 */

import { GET } from '@/app/api/kindle/servers.png/route'
import { getCachedHealth } from '@/lib/server-cache'
import { getServerReports } from '@/lib/reports'
import { renderServersPng } from '@/lib/servers-image'

jest.mock('@/lib/server-cache')
jest.mock('@/lib/reports')
jest.mock('@/lib/servers-image', () => ({ renderServersPng: jest.fn() }))

const mockHealth = getCachedHealth as jest.MockedFunction<typeof getCachedHealth>
const mockServers = getServerReports as jest.MockedFunction<typeof getServerReports>
const mockRender = renderServersPng as jest.MockedFunction<typeof renderServersPng>

it('renders the saved reports, with failed health checks as none', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockHealth.mockRejectedValue(new Error('dns'))
  mockServers.mockReturnValue([])
  mockRender.mockResolvedValue(Buffer.from('png'))
  const res = await GET(new Request('http://localhost/api/kindle/servers.png?w=600&h=744'))
  expect(res.status).toBe(200)
  expect(mockRender).toHaveBeenCalledWith([], [], { width: 600, height: 744 })
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx jest src/__tests__/api/kindle-servers-png.test.ts`
Expected: FAIL, route module not found.

- [ ] **Step 3: Implement the image**

`src/lib/servers-image.tsx`:

```tsx
import type { ReactNode } from 'react'
import { INK, INK_MUTED, PAPER, PAPER_LIGHT, PAPER_DARK, SANS, SERIF, card, darkCard, muted, Label, SectionHeader, Meter, Badge, Page, renderKindlePng } from './image-kit'
import { ageLabel, bytesLabel, rateLabel, uptimeLabel } from './format'
import { DEFAULT_IMAGE_SIZE, type ImageSize } from './kindle-png'
import { containerDown, diskNeedsAttention, isStale, mountNeedsAttention, ramNeedsAttention, usedPct } from './servers'
import type { HealthResult } from './healthcheck'
import type { ContainerInfo, DiskHealth, MountInfo, RaidInfo, StoredServer } from '@/types'

// Servers tab of the KOReader plugin: one section per reporting server, then
// the site health checks. Cards turn dark when something needs attention.

const MAX_CONTAINERS = 10

const archLabel = (arch: string) => (arch === 'x64' ? 'x86_64' : arch)
// Compose names end in -1: kindle-dashboard-dashboard-1 → kindle-dashboard-dashboard
const containerName = (name: string) => name.replace(/-\d+$/, '')

function Row({ children, dark = false, top = true }: { children: ReactNode; dark?: boolean; top?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0',
      borderTop: top ? `1px solid ${dark ? '#4a443c' : PAPER_DARK}` : 'none', fontFamily: SANS, fontSize: 11,
    }}>
      {children}
    </div>
  )
}

function CardHeader({ left, right, dark }: { left: string; right: string; dark: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
      <Label size={8} color={muted(dark)}>{left}</Label>
      <Label size={8} color={muted(dark)}>{right}</Label>
    </div>
  )
}

function MeterCell({ label, value, pct, dark }: { label: string; value: string; pct: number | null; dark: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 3 }}>
        <Label size={8} color={muted(dark)}>{label}</Label>
        <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 12, fontWeight: 700 }}>{value}</div>
      </div>
      {pct === null ? <div style={{ display: 'flex', height: 9 }} /> : <Meter pct={pct} dark={dark} />}
    </div>
  )
}

function smartLabel(d: DiskHealth): string {
  const parts = [d.healthy === null ? null : diskNeedsAttention(d) ? 'FALHA' : 'OK', d.tempC === null ? null : `${d.tempC}°C`]
  return parts.filter(Boolean).join(' ')
}

function usage(m: MountInfo) {
  return `${bytesLabel(m.usedBytes)} / ${bytesLabel(m.totalBytes)}`
}

function MountRow({ mount, label, health, dark }: { mount: MountInfo; label: string; health: string; dark: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '2px 0', fontFamily: SANS, fontSize: 11 }}>
      <div style={{ display: 'flex', width: 132, fontWeight: 700 }}>{label}</div>
      <Meter pct={usedPct(mount.usedBytes, mount.totalBytes)} dark={dark} />
      <div style={{ display: 'flex', width: 148, justifyContent: 'flex-end', fontSize: 10, color: muted(dark) }}>
        {[usage(mount), health].filter(Boolean).join(' · ')}
      </div>
    </div>
  )
}

function RaidBlock({ mount, raid, dark }: { mount: MountInfo; raid: RaidInfo; dark: boolean }) {
  const members = mount.disks.map((d) => [d.device, smartLabel(d)].filter(Boolean).join(' ')).join(' · ')
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', marginTop: 3, padding: '5px 8px', borderRadius: 8,
      border: `1.5px solid ${dark ? PAPER_LIGHT : INK}`, background: dark ? INK : PAPER,
    }}>
      <MountRow mount={mount} label={`${mount.path} · ${raid.device}`} health="" dark={dark} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3, fontFamily: SANS, fontSize: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Badge filled dark={dark}>{`${raid.level} · [${raid.state}]`}</Badge>
          <div style={{ display: 'flex', marginLeft: 6 }}>{members}</div>
        </div>
        <div style={{ display: 'flex', color: muted(dark) }}>
          {raid.syncPct !== null ? `sincronizando ${raid.syncPct}%` : `${raid.active} de ${raid.total} discos ativos`}
        </div>
      </div>
    </div>
  )
}

function Storage({ mounts }: { mounts: MountInfo[] }) {
  const dark = mounts.some(mountNeedsAttention)
  return (
    <div style={{ ...(dark ? darkCard : card), flexDirection: 'column', padding: '7px 12px' }}>
      <CardHeader left="ARMAZENAMENTO" right="USADO / TOTAL · SMART" dark={dark} />
      {mounts.map((m) =>
        m.raid ? (
          <RaidBlock key={m.path} mount={m} raid={m.raid} dark={dark} />
        ) : (
          <MountRow key={m.path} mount={m} dark={dark}
            label={`${m.path} · ${m.disks.map((d) => d.device).join('+') || m.device}`}
            health={m.disks.length === 1 ? smartLabel(m.disks[0]) : ''} />
        )
      )}
    </div>
  )
}

function Containers({ containers }: { containers: ContainerInfo[] }) {
  if (!containers.length) return null
  const dark = containers.some(containerDown)
  const running = containers.filter((c) => !containerDown(c)).length
  const shown = [...containers]
    .sort((a, b) => Number(containerDown(b)) - Number(containerDown(a)) || a.name.localeCompare(b.name))
    .slice(0, MAX_CONTAINERS)
  const hidden = containers.length - shown.length
  const fg = dark ? PAPER_LIGHT : INK
  return (
    <div style={{ ...(dark ? darkCard : card), flexDirection: 'column', padding: '6px 12px' }}>
      <CardHeader left={`CONTAINERS · ${running}/${containers.length} RODANDO`} right={hidden ? `+${hidden} OCULTOS` : 'PORTA NO HOST'} dark={dark} />
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {shown.map((c) => {
          const down = containerDown(c)
          return (
            <div key={c.name} style={{ display: 'flex', width: '48%' }}>
              <Row dark={dark}>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', width: 7, height: 7, borderRadius: 9999, marginRight: 5, flexShrink: 0, border: `1.5px solid ${fg}`, background: down ? 'transparent' : fg }} />
                  <div style={{ display: 'flex', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontWeight: down ? 700 : 400 }}>{containerName(c.name)}</div>
                </div>
                <div style={{ display: 'flex', flexShrink: 0, marginLeft: 4, fontSize: 10, color: muted(dark) }}>
                  {down ? 'parado' : c.ports.length ? c.ports.join(' ') : 'interna'}
                </div>
              </Row>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Server({ server, now }: { server: StoredServer; now: Date }) {
  const r = server.report
  const stale = isStale(server, now.getTime())
  const single = r.mounts.length === 1 && !r.mounts[0].raid ? r.mounts[0] : null
  const meta = stale
    ? `sem dados há ${ageLabel(server.receivedAt, now)}`
    : [archLabel(r.arch), `up ${uptimeLabel(r.uptimeSec)}`, r.cpu.tempC === null ? null : `CPU ${r.cpu.tempC}°C`, `rx ${rateLabel(r.net.rxBps)} · tx ${rateLabel(r.net.txBps)}`]
        .filter(Boolean).join(' · ')
  const metersDark = stale || ramNeedsAttention(r) || (single !== null && mountNeedsAttention(single))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <SectionHeader label={r.name.toUpperCase()} meta={meta} marginBottom={0} />
      <div style={{ ...(metersDark ? darkCard : card), padding: '8px 12px', gap: 12 }}>
        <MeterCell label={`CPU · ${r.cpu.cores}`} value={`${Math.round(r.cpu.pct)}%`} pct={r.cpu.pct} dark={metersDark} />
        <MeterCell label="RAM" value={`${bytesLabel(r.mem.usedBytes)} / ${bytesLabel(r.mem.totalBytes)}`} pct={usedPct(r.mem.usedBytes, r.mem.totalBytes)} dark={metersDark} />
        {single ? (
          <MeterCell label={`DISCO ${single.path}`} value={usage(single)} pct={usedPct(single.usedBytes, single.totalBytes)} dark={metersDark} />
        ) : (
          <MeterCell label="LOAD" value={`${r.cpu.load1.toFixed(2)} · ${r.cpu.cores} cores`} pct={(r.cpu.load1 / r.cpu.cores) * 100} dark={metersDark} />
        )}
      </div>
      {single ? null : <Storage mounts={r.mounts} />}
      <Containers containers={r.containers} />
    </div>
  )
}

function Health({ results }: { results: HealthResult[] }) {
  if (!results.length) return null
  const dark = results.some((r) => !r.ok)
  return (
    <div style={{ ...(dark ? darkCard : card), flexDirection: 'column', padding: '6px 12px' }}>
      <CardHeader left="SITES · HEALTH CHECK" right="STATUS · LATÊNCIA" dark={dark} />
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {results.map((r) => (
          <div key={r.label} style={{ display: 'flex', width: '48%' }}>
            <Row dark={dark}>
              <div style={{ display: 'flex' }}>{r.label}</div>
              <div style={{ display: 'flex', fontWeight: r.ok ? 400 : 700 }}>
                {r.ok ? `OK ${r.ms}ms` : r.status ? `ERRO ${r.status}` : 'FORA DO AR'}
              </div>
            </Row>
          </div>
        ))}
      </div>
    </div>
  )
}

export async function renderServersPng(
  servers: StoredServer[],
  health: HealthResult[],
  size: ImageSize = DEFAULT_IMAGE_SIZE,
  now = new Date()
): Promise<Buffer> {
  return renderKindlePng(
    <Page gap={10}>
      {servers.length ? (
        servers.map((s) => <Server key={s.report.id} server={s} now={now} />)
      ) : (
        <div style={{ ...card, padding: '10px 12px' }}>
          <Label size={10} spacing={0.5} color={INK_MUTED}>Nenhum servidor enviou dados ainda (server-agent)</Label>
        </div>
      )}
      <Health results={health} />
    </Page>,
    size
  )
}
```

- [ ] **Step 4: Implement the route**

`src/app/api/kindle/servers.png/route.ts`:

```ts
import { getCachedHealth } from '@/lib/server-cache'
import { getServerReports } from '@/lib/reports'
import { renderServersPng } from '@/lib/servers-image'
import { imageSizeFrom, pngResponse } from '@/lib/kindle-png'
import type { HealthResult } from '@/lib/healthcheck'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Servers tab (server-agent reports + site health checks) as a grayscale PNG
export async function GET(request: Request): Promise<Response> {
  const size = imageSizeFrom(new URL(request.url).searchParams)
  const health = await getCachedHealth().catch((err): HealthResult[] => {
    console.error('[api/kindle/servers.png] health checks', err)
    return []
  })
  return pngResponse('api/kindle/servers.png', () => renderServersPng(getServerReports(), health, size))
}
```

- [ ] **Step 5: Run the tests, type check, lint**

Run: `npx jest src/__tests__/api/kindle-servers-png.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS, no errors.

- [ ] **Step 6: Look at the real image**

With `npm run dev` running and `REPORT_TOKEN=test-report`, `HEALTHCHECK_URLS=ksmkayk.com.br=https://ksmkayk.com.br,dashboard=https://kindle.ksmkayk.com.br,godrinking=https://godrinking.ksmkayk.com.br,larapaper=https://trmnl.ksmkayk.com.br` in `.env`, post the two real reports captured from the servers:

```bash
ssh kayk@192.168.1.64 'cd ~/kindle-dashboard/server-agent && sudo docker compose run --rm agent node agent.mjs --once' > .superpowers/preview/kayk.json
curl -s -X POST http://localhost:3000/api/servers/report -H "Authorization: Bearer test-report" -H "Content-Type: application/json" --data @.superpowers/preview/kayk.json
curl -s "http://localhost:3000/api/kindle/servers.png?w=600&h=744" -o .superpowers/preview/servers-1.png
```

Expected: `{"ok":true}`, and the PNG shows the kayk-server section (meters, storage with `/` and the RAID block, containers) and the health card. Edit a copy of the JSON to fake a degraded RAID (`"state": "U_"`, `"active": 1`) and post it under another id: that storage card must turn dark. Check nothing is clipped at the bottom with two servers.

- [ ] **Step 7: Commit**

```bash
git add src/lib/servers-image.tsx src/app/api/kindle/servers.png/route.ts src/__tests__/api/kindle-servers-png.test.ts
git commit -m "feat: Servers tab image"
```

---

## Phase 5: configuration, docs and rollout

### Task 18: environment and README

**Files:**
- Modify: `.env.example`, `README.md`

- [ ] **Step 1: `.env.example`**

Add before `# Update rates in seconds`:

```
# GitHub (Work tab): classic personal access token with the "repo" scope
GITHUB_TOKEN=
# Repos whose latest GitHub Actions run is shown under "Últimos deploys"
GITHUB_DEPLOY_REPOS=KsmKayk/kindle-dashboard,KsmKayk/portfolio

# Shared secret of claude-reporter/ and server-agent/ (POST /api/*/report); unset = reports off
REPORT_TOKEN=

# Sites checked at the bottom of the Servers tab: label=url,label=url
HEALTHCHECK_URLS=site=https://example.com

# Timezone for "this week" / "this month" on the Work tab
TZ=America/Sao_Paulo
```

And under `# Update rates in seconds` add `GITHUB_UPDATE_RATE=600`.

- [ ] **Step 2: `README.md`**

1. In the environment variables table (around the `RIOT_ID` row), add rows for `GITHUB_TOKEN`, `GITHUB_DEPLOY_REPOS`, `GITHUB_UPDATE_RATE`, `REPORT_TOKEN`, `HEALTHCHECK_URLS` and `TZ` with the descriptions above.
2. In the routes table (around `/api/kindle/dashboard.png`), add:

```markdown
| `http://localhost:3000/api/kindle/work.png` | Work tab image for the KOReader plugin (GitHub + Claude) |
| `http://localhost:3000/api/kindle/servers.png` | Servers tab image for the KOReader plugin |
| `POST /api/claude/report`, `POST /api/servers/report` | Reports from `claude-reporter/` and `server-agent/` (Bearer `REPORT_TOKEN`) |
```

3. Add a section after "Deploying (GitHub Actions)":

```markdown
## Work and Servers tabs

The KOReader plugin's **Work** and **Servers** tabs need a little setup besides the app itself:

- **GitHub** — set `GITHUB_TOKEN` (classic PAT, `repo` scope) and optionally `GITHUB_DEPLOY_REPOS`.
  The 12-month figures appear about a minute after the first request. Commit counts only include
  commits on each repository's default branch (a GitHub search limitation).
- **Claude** — on the PC that runs Claude Code, set up [`claude-reporter/`](claude-reporter/README.md).
- **Servers** — on each server, run [`server-agent/`](server-agent/README.md) with Docker.
- Both reporters authenticate with `REPORT_TOKEN`; set it on the server first (`openssl rand -hex 24`).
- `HEALTHCHECK_URLS` lists the sites checked at the bottom of the Servers tab.
- The two images are guarded by `KINDLE_API_TOKEN` like the Spotify routes.
```

- [ ] **Step 3: Full check**

Run: `npm test && npm run test:reporters && npx tsc --noEmit && npm run lint && npm run build`
Expected: everything passes and the production build succeeds.

- [ ] **Step 4: Commit**

```bash
git add .env.example README.md
git commit -m "docs: configure the Work and Servers tabs"
```

### Task 19: rollout (manual, with the user)

Nothing here is committed. Ask the user before each server change; `sudo` on kayk-server needs their password.

- [ ] **Step 1: Server `.env` on Oracle**

```bash
TOKEN=$(openssl rand -hex 24); echo "REPORT_TOKEN: $TOKEN"
ssh -i ~/.ssh/kindle_actions_key ubuntu@129.148.25.68 "cd ~/kindle-dashboard && cp .env .env.bak && cat >> .env" <<EOF
GITHUB_TOKEN=<token from the user: a classic PAT with repo scope, or the output of gh auth token>
GITHUB_DEPLOY_REPOS=KsmKayk/kindle-dashboard,KsmKayk/portfolio
REPORT_TOKEN=$TOKEN
HEALTHCHECK_URLS=ksmkayk.com.br=https://ksmkayk.com.br,dashboard=https://kindle.ksmkayk.com.br,godrinking=https://godrinking.ksmkayk.com.br,larapaper=https://trmnl.ksmkayk.com.br
TZ=America/Sao_Paulo
EOF
```

Keep `$TOKEN` for the reporters. After the branch is merged and the deploy workflow has run (push to `master`), check the timezone and the new route:

```bash
ssh -i ~/.ssh/kindle_actions_key ubuntu@129.148.25.68 'docker exec kindle-dashboard-dashboard-1 node -e "console.log(new Date().toString())"'
```

Expected: a `GMT-0300` time. If it prints UTC, add `RUN apk add --no-cache tzdata` to the `runner` stage of the root `Dockerfile` and redeploy.

- [ ] **Step 2: Agent on Oracle**

```bash
ssh -i ~/.ssh/kindle_actions_key ubuntu@129.148.25.68 'cd ~/kindle-dashboard/server-agent && cat > config.json' <<EOF
{ "id": "oracle", "name": "Oracle", "order": 1, "dashboardUrl": "http://127.0.0.1:3400",
  "reportToken": "$TOKEN", "mounts": ["/"], "intervalSec": 60, "smart": false }
EOF
ssh -i ~/.ssh/kindle_actions_key ubuntu@129.148.25.68 'cd ~/kindle-dashboard/server-agent && docker compose up -d --build && sleep 70 && docker compose logs --tail 20'
```

Expected: no errors in the logs. (`git reset --hard` in the deploy workflow keeps the untracked `config.json`.)

- [ ] **Step 3: Agent on kayk-server**

```bash
ssh kayk@192.168.1.64 'cd ~/kindle-dashboard && git pull && cd server-agent && cat > config.json' <<EOF
{ "id": "kayk-server", "name": "kayk-server", "order": 2, "dashboardUrl": "https://kindle.ksmkayk.com.br",
  "reportToken": "$TOKEN", "mounts": ["/", "/mnt/raid1"], "intervalSec": 60, "smart": true }
EOF
```

Then the user runs (it asks for the sudo password): `! ssh -t kayk@192.168.1.64 'cd ~/kindle-dashboard/server-agent && sudo docker compose up -d --build'`.
Expected: within two minutes the Servers image shows both servers.

- [ ] **Step 4: Claude reporter on this PC**

```bash
cd claude-reporter
printf '{ "dashboardUrl": "https://kindle.ksmkayk.com.br", "reportToken": "%s" }' "$TOKEN" > config.json
node report.mjs
powershell -ExecutionPolicy Bypass -File install.ps1
```

Expected: `sent N days, limits ok`, then `Installed.`; ten minutes later `last-run.log` shows a fresh run.

- [ ] **Step 5: Kindle**

The user copies `koreader-plugin/kindledash.koplugin` to `koreader/plugins/` on the Kindle (replacing the old folder, which removes `kdash_dashboard.lua`) and restarts KOReader. Check: four tabs fit the bar, swiping moves through them in order, Work and Servers load (set the access token in the plugin menu if the server has `KINDLE_API_TOKEN`).
