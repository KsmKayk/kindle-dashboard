'use client'

const INK = '#1a1612'
const PAPER = '#e8e3d8'

const IconPrev = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 5h2.2v14H6V5zM21 5v14L9.5 12 21 5z" />
  </svg>
)
const IconNext = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.8 5H18v14h-2.2V5zM3 19V5l11.5 7L3 19z" />
  </svg>
)
const IconPlay = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 5v14l13-7L7 5z" />
  </svg>
)
const IconPause = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4.5h3.5v15H7v-15zM13.5 4.5H17v15h-3.5v-15z" />
  </svg>
)

interface PlayerControlsProps {
  isPlaying: boolean
  onAction: (action: 'play' | 'pause' | 'next' | 'previous') => void
}

function ControlButton({
  children,
  primary = false,
  size = 36,
  onClick,
}: {
  children: React.ReactNode
  primary?: boolean
  size?: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        border: `1px solid ${INK}`,
        background: primary ? INK : 'transparent',
        color: primary ? PAPER : INK,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

export function PlayerControls({ isPlaying, onAction }: PlayerControlsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <ControlButton size={32} onClick={() => onAction('previous')}>
        <IconPrev size={14} />
      </ControlButton>
      <ControlButton size={44} primary onClick={() => onAction(isPlaying ? 'pause' : 'play')}>
        {isPlaying ? <IconPause size={20} /> : <IconPlay size={20} />}
      </ControlButton>
      <ControlButton size={32} onClick={() => onAction('next')}>
        <IconNext size={14} />
      </ControlButton>
    </div>
  )
}
