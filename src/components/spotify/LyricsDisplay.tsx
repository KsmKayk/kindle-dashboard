import type { LyricLine } from '@/types'

const INK = '#1a1612'
const INK_MUTED = '#7a7268'

const LYRICS_LOOKAHEAD_SECONDS = 12

interface LyricsDisplayProps {
  lyrics: LyricLine[]
  currentTimeSeconds: number
}

function getCurrentLineIndex(lyrics: LyricLine[], timeSeconds: number): number {
  let idx = 0
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time <= timeSeconds) idx = i
    else break
  }
  return idx
}

function fontSizeForOffset(offset: number): number {
  if (offset === 0) return 21
  if (offset === 1) return 16
  if (offset === 2) return 13
  return 11
}

function opacityForOffset(offset: number, isPast: boolean): number {
  if (offset === 0) return 1
  if (isPast) return 0.35
  if (offset === 1) return 0.85
  if (offset === 2) return 0.65
  return 0.45
}

export function LyricsDisplay({ lyrics, currentTimeSeconds }: LyricsDisplayProps) {
  const containerStyle: React.CSSProperties = {
    flex: 1,
    border: `1px dashed ${INK}`,
    borderRadius: 10,
    padding: '16px 24px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    gap: 2,
    background: 'transparent',
    marginBottom: 12,
    overflow: 'hidden',
  }

  if (lyrics.length === 0) {
    return (
      <div style={{ ...containerStyle, justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', fontFamily: 'Georgia, serif', fontSize: 14, fontStyle: 'italic', color: INK_MUTED }}>
          No lyrics available
        </div>
      </div>
    )
  }

  const currentIdx = getCurrentLineIndex(lyrics, currentTimeSeconds)
  const windowEnd = currentTimeSeconds + LYRICS_LOOKAHEAD_SECONDS

  const pastIdx = Math.max(0, currentIdx - 1)
  let endIdx = currentIdx + 1
  while (endIdx < lyrics.length && lyrics[endIdx].time <= windowEnd) {
    endIdx++
  }

  const visible = lyrics.slice(pastIdx, endIdx)

  return (
    <div style={containerStyle}>
      {visible.map((line, i) => {
        const actualIdx = pastIdx + i
        const isCurrent = actualIdx === currentIdx
        const isPast = actualIdx < currentIdx
        const offset = actualIdx - currentIdx

        return (
          <div
            key={actualIdx}
            style={{
              textAlign: 'center',
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: fontSizeForOffset(Math.abs(offset)),
              fontWeight: isCurrent ? 700 : 400,
              fontStyle: isCurrent ? 'normal' : 'italic',
              color: INK,
              opacity: opacityForOffset(Math.abs(offset), isPast),
              lineHeight: 1.35,
              letterSpacing: isCurrent ? -0.3 : 0,
              padding: isCurrent ? '6px 0' : '2px 0',
            }}
          >
            {line.text}
          </div>
        )
      })}
    </div>
  )
}
