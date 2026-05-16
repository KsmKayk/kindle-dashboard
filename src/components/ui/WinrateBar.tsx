const INK = '#1a1612'
const PAPER_DARKER = '#c4bdac'

interface WinrateBarProps {
  value: number
  radius?: number
}

export function WinrateBar({ value, radius = 2 }: WinrateBarProps) {
  return (
    <div
      style={{
        width: '100%',
        height: 4,
        background: PAPER_DARKER,
        borderRadius: radius,
        overflow: 'hidden',
        border: `1px solid ${INK}`,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: `${Math.min(100, Math.max(0, value))}%`, height: '100%', background: INK }} />
    </div>
  )
}
