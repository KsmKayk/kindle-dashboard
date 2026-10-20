'use client'

import { useLayoutEffect, useRef } from 'react'
import type { LyricLine } from '@/types'

const INK = '#1a1612'
const INK_MUTED = '#7a7268'

// Line switches animate: the column slides so the current line stays centred,
// and lines scale/fade (transform + opacity only, so measurements stay stable).
const TRANSITION = 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1), opacity 450ms ease'
const FADE_EDGES = 'linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%)'

interface LyricsDisplayProps {
  lyrics: LyricLine[]
  plainLyrics?: string[] // shown when there are no synced lyrics
  currentTimeSeconds: number
}

// Index of the line being sung, or -1 before the first line starts.
export function getCurrentLineIndex(lyrics: LyricLine[], timeSeconds: number): number {
  let idx = -1
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time <= timeSeconds) idx = i
    else break
  }
  return idx
}

function scaleForOffset(offset: number): number {
  if (offset === 0) return 1
  if (offset === 1) return 0.82
  return 0.74
}

function opacityForOffset(offset: number, isPast: boolean): number {
  if (offset === 0) return 1
  if (isPast) return 0.3
  if (offset === 1) return 0.7
  if (offset === 2) return 0.5
  return 0.35
}

const containerStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  position: 'relative',
  border: `1px dashed ${INK}`,
  borderRadius: 10,
  boxSizing: 'border-box',
  background: 'transparent',
  marginBottom: 12,
  overflow: 'hidden',
}

const lineStyle: React.CSSProperties = {
  textAlign: 'center',
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 22,
  lineHeight: 1.3,
  color: INK,
  padding: '5px 0',
  transformOrigin: 'center',
  transition: TRANSITION,
}

export function LyricsDisplay({ lyrics, plainLyrics = [], currentTimeSeconds }: LyricsDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])

  const currentIdx = getCurrentLineIndex(lyrics, currentTimeSeconds)

  // Slide the column so the current line (or the first one, before it starts)
  // sits in the vertical centre of the box.
  useLayoutEffect(() => {
    const container = containerRef.current
    const column = columnRef.current
    const line = lineRefs.current[Math.max(0, currentIdx)]
    if (!container || !column || !line) return
    const y = container.clientHeight / 2 - (line.offsetTop + line.offsetHeight / 2)
    column.style.transform = `translateY(${y}px)`
  }, [currentIdx, lyrics])

  if (lyrics.length === 0 && plainLyrics.length > 0) {
    return (
      // margin: auto centres the text when it fits and lets it scroll when it doesn't
      <div style={{ ...containerStyle, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '16px 24px' }}>
        <div style={{ margin: 'auto 0' }}>
          {plainLyrics.map((line, i) => (
            <div key={i} style={{ textAlign: 'center', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 14, color: INK, lineHeight: 1.45 }}>
              {line}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (lyrics.length === 0) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', fontFamily: 'Georgia, serif', fontSize: 14, fontStyle: 'italic', color: INK_MUTED }}>
          No lyrics available
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {/* The fade lives on an inner layer so it doesn't erase the dashed border */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', maskImage: FADE_EDGES, WebkitMaskImage: FADE_EDGES }}>
        <div
          ref={columnRef}
          style={{ position: 'absolute', top: 0, left: 24, right: 24, transition: TRANSITION, willChange: 'transform' }}
        >
          {lyrics.map((line, i) => {
            const offset = Math.abs(i - Math.max(0, currentIdx))
            const isCurrent = i === currentIdx
            const isPast = i < currentIdx
            return (
              <div
                key={i}
                ref={(el) => { lineRefs.current[i] = el }}
                style={{
                  ...lineStyle,
                  fontWeight: isCurrent ? 700 : 400,
                  transform: `scale(${isCurrent ? 1 : scaleForOffset(offset || 1)})`,
                  opacity: isCurrent ? 1 : opacityForOffset(offset || 1, isPast),
                }}
              >
                {line.text}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
