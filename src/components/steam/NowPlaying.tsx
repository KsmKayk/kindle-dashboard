import { DashImg } from '@/components/ui/DashImg'
import type { SteamNowPlaying } from '@/types'

const INK = '#1a1612'
const INK_MUTED = '#7a7268'
const PAPER_LIGHT = '#f1ede2'

interface NowPlayingProps {
  game: SteamNowPlaying | null
}

export function NowPlaying({ game }: NowPlayingProps) {
  const cardStyle: React.CSSProperties = {
    background: PAPER_LIGHT,
    border: `1px solid ${INK}`,
    borderRadius: 10,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    padding: 9,
    gap: 12,
    height: 70,
    marginBottom: 10,
  }

  if (!game) {
    return (
      <div style={cardStyle}>
        <div style={{ flex: 1, fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: 11, color: INK_MUTED, letterSpacing: 1.5 }}>
          NOT PLAYING
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <div style={{ width: 52, height: 52, borderRadius: 6, overflow: 'hidden', border: `1px solid ${INK}`, flexShrink: 0 }}>
        <DashImg src={game.headerImg} fallback={game.fallback} alt={game.name} radius={6} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: 8, fontWeight: 700, letterSpacing: 2.2, color: INK_MUTED }}>
            NOW PLAYING
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: 8, fontWeight: 700, letterSpacing: 1.5, color: INK }}>
            <span style={{ width: 6, height: 6, background: INK, borderRadius: 9999, display: 'inline-block' }} />
            LIVE
          </div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.15, fontFamily: 'Georgia, serif', letterSpacing: -0.3, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {game.name}
        </div>
      </div>
    </div>
  )
}
