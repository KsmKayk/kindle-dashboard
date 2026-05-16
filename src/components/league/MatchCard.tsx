import { DashImg } from '@/components/ui/DashImg'
import type { MatchResult } from '@/types'

const INK = '#1a1612'
const INK_MUTED = '#7a7268'
const PAPER_LIGHT = '#f1ede2'
const PAPER_DARK = '#d8d2c4'
const PAPER = '#e8e3d8'

interface MatchCardProps {
  match: MatchResult
}

export function MatchCard({ match }: MatchCardProps) {
  return (
    <div style={{ background: match.win ? PAPER_LIGHT : PAPER_DARK, border: `1px solid ${INK}`, borderRadius: 10, boxSizing: 'border-box', padding: 8, height: 60, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 40, height: 40, borderRadius: 9999, overflow: 'hidden', border: `1px solid ${INK}`, flexShrink: 0 }}>
        <DashImg src={match.championImg} fallback={match.fallback} alt={match.champion} radius={9999} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 8, letterSpacing: 1.2, fontFamily: '"Helvetica Neue", Arial, sans-serif', color: INK_MUTED }}>
          {match.queueType.toUpperCase()}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Georgia, serif', lineHeight: 1.1, letterSpacing: -0.2, marginTop: 1 }}>
          {match.kills}<span style={{ color: INK_MUTED, margin: '0 2px' }}>/</span>
          {match.deaths}<span style={{ color: INK_MUTED, margin: '0 2px' }}>/</span>
          {match.assists}
        </div>
      </div>
      <div style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: '3px 8px', borderRadius: 9999, background: match.win ? INK : 'transparent', color: match.win ? PAPER : INK, border: match.win ? 'none' : `1px solid ${INK}`, flexShrink: 0 }}>
        {match.win ? 'W' : 'L'}
      </div>
    </div>
  )
}
