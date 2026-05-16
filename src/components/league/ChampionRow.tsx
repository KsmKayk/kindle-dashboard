import { DashImg } from '@/components/ui/DashImg'
import { WinrateBar } from '@/components/ui/WinrateBar'
import type { ChampionStat } from '@/types'

const INK = '#1a1612'
const INK_MUTED = '#7a7268'
const PAPER_LIGHT = '#f1ede2'
const PAPER = '#e8e3d8'

interface ChampionRowProps {
  champ: ChampionStat
  rank: number
}

export function ChampionRow({ champ, rank }: ChampionRowProps) {
  return (
    <div style={{ background: PAPER_LIGHT, border: `1px solid ${INK}`, borderRadius: 10, boxSizing: 'border-box', padding: 7, height: 50, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 20, height: 20, borderRadius: 9999, border: `1px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, fontFamily: 'Georgia, serif', background: rank === 1 ? INK : 'transparent', color: rank === 1 ? PAPER : INK, flexShrink: 0 }}>
        {rank}
      </div>
      <div style={{ width: 34, height: 34, borderRadius: 9999, overflow: 'hidden', border: `1px solid ${INK}`, flexShrink: 0 }}>
        <DashImg src={champ.championImg} fallback={champ.fallback} alt={champ.name} radius={9999} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Georgia, serif', lineHeight: 1, letterSpacing: -0.2 }}>
          {champ.name}
        </div>
        <div style={{ fontSize: 9, letterSpacing: 0.5, fontFamily: '"Helvetica Neue", Arial, sans-serif', color: INK_MUTED, marginTop: 2 }}>
          {champ.games} games played
        </div>
      </div>
      <div style={{ width: 140, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <WinrateBar value={champ.winrate} radius={2} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Georgia, serif', letterSpacing: -0.3, minWidth: 32, textAlign: 'right' }}>
          {champ.winrate}%
        </span>
      </div>
    </div>
  )
}
