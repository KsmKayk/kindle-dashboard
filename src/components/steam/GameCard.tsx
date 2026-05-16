import { DashImg } from '@/components/ui/DashImg'
import type { SteamTopGame } from '@/types'

const INK = '#1a1612'
const INK_MUTED = '#7a7268'
const PAPER_LIGHT = '#f1ede2'

interface GameCardProps {
  game: SteamTopGame
}

export function GameCard({ game }: GameCardProps) {
  return (
    <div style={{ background: PAPER_LIGHT, border: `1px solid ${INK}`, borderRadius: 10, boxSizing: 'border-box', padding: 10, height: 86, display: 'flex', alignItems: 'stretch', gap: 10 }}>
      <div style={{ width: 66, height: 66, borderRadius: 6, overflow: 'hidden', border: `1px solid ${INK}`, flexShrink: 0 }}>
        <DashImg src={game.coverImg} fallback={game.fallback} alt={game.name} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 2, paddingBottom: 2 }}>
        <div style={{ fontSize: 12, lineHeight: 1.2, fontWeight: 700, fontFamily: 'Georgia, serif', color: INK, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', letterSpacing: -0.1 }}>
          {game.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontFamily: '"Helvetica Neue", Arial, sans-serif' }}>
          <span style={{ fontSize: 8, letterSpacing: 1.5, color: INK_MUTED }}>PLAYED</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Georgia, serif', color: INK, letterSpacing: -0.5 }}>
            {game.hours}<span style={{ fontSize: 11, fontWeight: 400 }}>h</span>
          </span>
        </div>
      </div>
    </div>
  )
}
