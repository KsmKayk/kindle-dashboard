const INK = '#1a1612'
const PAPER = '#e8e3d8'

interface TotalGamesCardProps {
  total: number
}

export function TotalGamesCard({ total }: TotalGamesCardProps) {
  return (
    <div style={{ background: INK, color: PAPER, border: `1px solid ${INK}`, borderRadius: 10, boxSizing: 'border-box', padding: 10, height: 86, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 48, fontWeight: 700, lineHeight: 1, letterSpacing: -2 }}>
        {total}
      </div>
      <div style={{ flex: 1, borderLeft: `1px solid ${PAPER}`, paddingLeft: 12 }}>
        <div style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: 9, letterSpacing: 2, opacity: 0.75, marginBottom: 2 }}>TOTAL</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.2 }}>
          Games<br />Owned
        </div>
      </div>
    </div>
  )
}
