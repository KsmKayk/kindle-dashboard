/* eslint-disable @next/next/no-img-element -- Satori (ImageResponse) renders plain <img>, not next/image */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { fetchAndGrayscale } from './image'
import { daysAgo } from './steam'
import type { SteamData, LeagueData, MatchResult, ChampionStat, SteamTopGame } from '@/types'

// Steam + League dashboard as a PNG for the KOReader plugin. Same look as the
// /kindle page, rebuilt with flexbox only (Satori, behind ImageResponse, has no tables).

const INK = '#1a1612'
const INK_MUTED = '#7a7268'
const PAPER = '#e8e3d8'
const PAPER_LIGHT = '#f1ede2'
const PAPER_DARK = '#d8d2c4'
const PAPER_DARKER = '#c4bdac'

const SERIF = 'Noto Serif'
const SANS = 'Noto Sans'

export const DEFAULT_IMAGE_SIZE = { width: 600, height: 744 }

const card = {
  display: 'flex',
  background: PAPER_LIGHT,
  border: `1px solid ${INK}`,
  borderRadius: 10,
} as const

// Images are embedded as grayscale data URIs: fetched once per URL, and a failed
// fetch just leaves the frame empty instead of failing the whole render.
const imageCache = new Map<string, string>()

async function loadImage(url: string): Promise<string | null> {
  const hit = imageCache.get(url)
  if (hit) return hit
  try {
    const png = await fetchAndGrayscale(url)
    const uri = `data:image/png;base64,${png.toString('base64')}`
    imageCache.set(url, uri)
    return uri
  } catch (err) {
    console.error('[dashboard-image] image fetch failed', url, err)
    return null
  }
}

type Images = Map<string, string | null>

async function loadImages(urls: string[]): Promise<Images> {
  const unique = [...new Set(urls.filter(Boolean))]
  const loaded = await Promise.all(unique.map(loadImage))
  return new Map(unique.map((url, i) => [url, loaded[i]]))
}

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

function Frame({ src, size, round = false }: { src: string | null | undefined; size: number; round?: boolean }) {
  return (
    <div style={{
      display: 'flex', width: size, height: size, flexShrink: 0, overflow: 'hidden',
      border: `1px solid ${INK}`, borderRadius: round ? 9999 : 6, background: PAPER_DARK,
    }}>
      {src ? <img src={src} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: 'cover' }} /> : null}
    </div>
  )
}

function Label({ children, size = 9, color = INK_MUTED, bold = false, spacing = 1.8 }: { children: string; size?: number; color?: string; bold?: boolean; spacing?: number }) {
  return (
    <div style={{ display: 'flex', fontFamily: SANS, fontSize: size, letterSpacing: spacing, color, fontWeight: bold ? 700 : 400 }}>
      {children}
    </div>
  )
}

function SectionHeader({ label, meta }: { label: string; meta: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
      <Label size={10} color={INK} bold>{label}</Label>
      <div style={{ display: 'flex', flex: 1, height: 1, background: INK, margin: '0 10px' }} />
      <Label>{meta}</Label>
    </div>
  )
}

function SteamGameCard({ steam, images }: { steam: SteamData; images: Images }) {
  const game = steam.nowPlaying ?? steam.lastPlayed
  if (!game) {
    return (
      <div style={{ ...card, height: 64, alignItems: 'center', padding: '0 12px', marginBottom: 8 }}>
        <Label size={11}>NOT PLAYING</Label>
      </div>
    )
  }
  const status = steam.nowPlaying ? 'NOW PLAYING' : 'LAST PLAYED'
  const meta = steam.nowPlaying ? '• LIVE' : steam.lastPlayed ? daysAgo(steam.lastPlayed.playedAt).toUpperCase() : ''
  return (
    <div style={{ ...card, height: 64, alignItems: 'center', padding: '0 10px', marginBottom: 8 }}>
      <div style={{ display: 'flex', width: 92, height: 43, flexShrink: 0, overflow: 'hidden', border: `1px solid ${INK}`, borderRadius: 6, background: PAPER_DARK, marginRight: 12 }}>
        {images.get(game.headerImg) ? <img src={images.get(game.headerImg)!} alt="" width={92} height={43} style={{ objectFit: 'cover' }} /> : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Label size={8} bold>{status}</Label>
          <Label size={8} color={INK} bold>{meta}</Label>
        </div>
        <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 18, fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {game.name}
        </div>
      </div>
    </div>
  )
}

function TopGameCard({ game, images }: { game: SteamTopGame; images: Images }) {
  return (
    <div style={{ ...card, width: 274, height: 82, padding: 8 }}>
      <Frame src={images.get(game.coverImg)} size={64} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginLeft: 10, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 12, fontWeight: 700, lineHeight: 1.2, maxHeight: 30, overflow: 'hidden' }}>{game.name}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Label size={8}>PLAYED</Label>
          <div style={{ display: 'flex', alignItems: 'baseline', fontFamily: SERIF, fontSize: 18, fontWeight: 700 }}>
            {String(game.hours)}<span style={{ fontSize: 11, fontWeight: 400 }}>h</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function TotalGamesCard({ total }: { total: number }) {
  return (
    <div style={{ ...card, width: 274, height: 82, padding: 10, alignItems: 'center', background: INK, color: PAPER }}>
      <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 44, fontWeight: 700, letterSpacing: -2 }}>{String(total)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${PAPER}`, paddingLeft: 12, marginLeft: 12 }}>
        <Label size={9} color={PAPER}>TOTAL</Label>
        <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 13, fontWeight: 700 }}>Games Owned</div>
      </div>
    </div>
  )
}

function Steam({ steam, images }: { steam: SteamData | null; images: Images }) {
  if (!steam) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 12 }}>
        <SectionHeader label="STEAM" meta="unavailable" />
        <Label size={12}>Steam data unavailable</Label>
      </div>
    )
  }
  const cells = [
    ...steam.topGames.slice(0, 3).map((g) => <TopGameCard key={g.appid} game={g} images={images} />),
    <TotalGamesCard key="total" total={steam.totalGames} />,
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 12 }}>
      <SectionHeader label="STEAM" meta={`${steam.personaname} · ${steam.isOnline ? 'online' : 'offline'}`} />
      <SteamGameCard steam={steam} images={images} />
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>{cells}</div>
    </div>
  )
}

function MatchCard({ match, images }: { match: MatchResult; images: Images }) {
  return (
    <div style={{ ...card, width: 274, height: 56, padding: 8, alignItems: 'center', background: match.win ? PAPER_LIGHT : PAPER_DARK }}>
      <Frame src={images.get(match.championImg)} size={38} round />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginLeft: 10 }}>
        <Label size={8}>{match.queueType.toUpperCase()}</Label>
        <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 14, fontWeight: 700 }}>
          {`${match.kills} / ${match.deaths} / ${match.assists}`}
        </div>
      </div>
      <div style={{
        display: 'flex', fontFamily: SANS, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
        border: `1px solid ${INK}`, background: match.win ? INK : 'transparent', color: match.win ? PAPER : INK,
      }}>
        {match.win ? 'W' : 'L'}
      </div>
    </div>
  )
}

function ChampionRow({ champ, rank, images }: { champ: ChampionStat; rank: number; images: Images }) {
  const pct = Math.min(100, Math.max(0, champ.winrate))
  return (
    <div style={{ ...card, height: 44, padding: '0 8px', alignItems: 'center', marginBottom: 6 }}>
      <div style={{
        display: 'flex', width: 20, height: 20, borderRadius: 9999, border: `1px solid ${INK}`, alignItems: 'center', justifyContent: 'center',
        fontFamily: SERIF, fontSize: 10, fontWeight: 700, background: rank === 1 ? INK : 'transparent', color: rank === 1 ? PAPER : INK,
      }}>
        {String(rank)}
      </div>
      <div style={{ display: 'flex', marginLeft: 8 }}><Frame src={images.get(champ.championImg)} size={32} round /></div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginLeft: 10 }}>
        <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 14, fontWeight: 700 }}>{champ.name}</div>
        <Label size={9} spacing={0.5}>{`${champ.games} games played`}</Label>
      </div>
      <div style={{ display: 'flex', width: 110, height: 6, border: `1px solid ${INK}`, borderRadius: 3, background: PAPER_DARKER }}>
        <div style={{ display: 'flex', width: `${pct}%`, background: INK }} />
      </div>
      <div style={{ display: 'flex', width: 44, justifyContent: 'flex-end', fontFamily: SERIF, fontSize: 13, fontWeight: 700 }}>{`${champ.winrate}%`}</div>
    </div>
  )
}

function League({ league, images }: { league: LeagueData | null; images: Images }) {
  const meta = `All Game Modes · ${new Date().getFullYear()}`
  if (!league) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <SectionHeader label="LEAGUE OF LEGENDS" meta={meta} />
        <Label size={12}>League data unavailable</Label>
      </div>
    )
  }
  const { profile } = league
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <SectionHeader label="LEAGUE OF LEGENDS" meta={meta} />
      <div style={{ ...card, height: 60, padding: '0 12px', alignItems: 'center', marginBottom: 8 }}>
        <Frame src={images.get(profile.iconUrl)} size={42} round />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginLeft: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', fontFamily: SERIF, fontSize: 18, fontWeight: 700 }}>
            {profile.name}<span style={{ fontSize: 13, fontWeight: 400, color: INK_MUTED }}>{profile.tag}</span>
          </div>
          <Label size={9}>SUMMONER LEVEL</Label>
        </div>
        <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 28, fontWeight: 700 }}>{String(profile.level)}</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginBottom: 8 }}>
        {league.matches.slice(0, 4).map((m) => <MatchCard key={m.matchId} match={m} images={images} />)}
      </div>
      {league.topChamps.slice(0, 3).map((c, i) => <ChampionRow key={c.name} champ={c} rank={i + 1} images={images} />)}
    </div>
  )
}

function imageUrls(steam: SteamData | null, league: LeagueData | null): string[] {
  const urls: string[] = []
  if (steam) {
    const game = steam.nowPlaying ?? steam.lastPlayed
    if (game) urls.push(game.headerImg)
    urls.push(...steam.topGames.slice(0, 3).map((g) => g.coverImg))
  }
  if (league) {
    urls.push(league.profile.iconUrl)
    urls.push(...league.matches.slice(0, 4).map((m) => m.championImg))
    urls.push(...league.topChamps.slice(0, 3).map((c) => c.championImg))
  }
  return urls
}

// Returns an 8-bit grayscale PNG (the Kindle shows 16 grays; smaller to download)
export async function renderDashboardPng(
  steam: SteamData | null,
  league: LeagueData | null,
  size = DEFAULT_IMAGE_SIZE
): Promise<Buffer> {
  const [images, fontList] = await Promise.all([loadImages(imageUrls(steam, league)), loadFonts()])
  const response = new ImageResponse(
    (
      <div style={{
        display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
        padding: '14px 22px', background: PAPER, color: INK, fontFamily: SERIF,
      }}>
        <Steam steam={steam} images={images} />
        <League league={league} images={images} />
      </div>
    ),
    { ...size, fonts: fontList }
  )
  const png = Buffer.from(await response.arrayBuffer())
  return sharp(png).grayscale().png({ compressionLevel: 9 }).toBuffer()
}
