import { DashImg } from '@/components/ui/DashImg'
import { PlayerControls } from './PlayerControls'
import type { SpotifyTrackInfo } from '@/types'

const INK = '#1a1612'
const INK_MUTED = '#7a7268'
const PAPER_LIGHT = '#f1ede2'
const PAPER_DARK = '#d8d2c4'
const PAPER_DARKER = '#c4bdac'

interface SpotifyPlayerProps {
  track: SpotifyTrackInfo | null
  isPlaying: boolean
  liveProgressMs: number
  onAction: (action: 'play' | 'pause' | 'next' | 'previous') => void
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function SpotifyPlayer({ track, isPlaying, liveProgressMs, onAction }: SpotifyPlayerProps) {
  const cardStyle: React.CSSProperties = {
    background: PAPER_LIGHT,
    border: `1px solid ${INK}`,
    borderRadius: 10,
    boxSizing: 'border-box',
    padding: 14,
    marginBottom: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  }

  if (!track) {
    return (
      <div style={cardStyle}>
        <div style={{ height: 110, width: 110, background: PAPER_DARK, borderRadius: 6, marginBottom: 10, border: `1px solid ${INK}` }} />
        <div style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: 11, color: INK_MUTED, letterSpacing: 2 }}>
          NOTHING PLAYING
        </div>
      </div>
    )
  }

  const progressFraction = track.durationMs > 0 ? liveProgressMs / track.durationMs : 0
  const progressPct = Math.min(100, Math.max(0, progressFraction * 100))

  return (
    <div style={cardStyle}>
      <div style={{ width: 110, height: 110, borderRadius: 6, overflow: 'hidden', border: `1px solid ${INK}`, marginBottom: 10 }}>
        <DashImg src={track.coverUrl} fallback={track.fallback} alt={track.title} radius={6} />
      </div>

      <div style={{ textAlign: 'center', lineHeight: 1.15, marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Georgia, serif', letterSpacing: -0.3 }}>
          {track.title}
        </div>
        <div style={{ fontSize: 12, color: INK, marginTop: 3, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
          {track.artist}
        </div>
        <div style={{ fontSize: 9, color: INK_MUTED, marginTop: 4, fontFamily: '"Helvetica Neue", Arial, sans-serif', letterSpacing: 1.5 }}>
          {track.album.toUpperCase()}
        </div>
      </div>

      <div style={{ width: '100%', marginBottom: 14 }}>
        <div style={{ position: 'relative', width: '100%', height: 4, background: PAPER_DARKER, borderRadius: 2, border: `1px solid ${INK}` }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: INK }} />
          <div style={{ position: 'absolute', left: `${progressPct}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 10, height: 10, background: INK, borderRadius: 9999, border: `2px solid ${PAPER_LIGHT}` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: 9, letterSpacing: 1, color: INK_MUTED }}>
          <span>{formatTime(liveProgressMs)}</span>
          <span>{formatTime(track.durationMs)}</span>
        </div>
      </div>

      <PlayerControls isPlaying={isPlaying} onAction={onAction} />
    </div>
  )
}
