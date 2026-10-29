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
