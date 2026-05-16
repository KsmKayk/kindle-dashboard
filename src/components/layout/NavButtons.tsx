'use client'

import { useRouter } from 'next/navigation'

const INK = '#1a1612'
const PAPER = '#e8e3d8'

interface NavButtonsProps {
  activePage: 'dashboard' | 'spotify'
}

export function NavButtons({ activePage }: NavButtonsProps) {
  const router = useRouter()

  const baseStyle: React.CSSProperties = {
    height: 34,
    border: `1px solid ${INK}`,
    borderRadius: 10,
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.5,
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
      <button
        onClick={() => router.push('/')}
        style={{
          ...baseStyle,
          background: activePage === 'dashboard' ? INK : 'transparent',
          color: activePage === 'dashboard' ? PAPER : INK,
        }}
      >
        {activePage === 'dashboard' && (
          <span style={{ width: 6, height: 6, background: PAPER, borderRadius: 9999, display: 'inline-block' }} />
        )}
        {activePage !== 'dashboard' && (
          <span style={{ fontSize: 14, lineHeight: 1, marginTop: -1 }}>‹</span>
        )}
        Main Dashboard
      </button>
      <button
        onClick={() => router.push('/spotify')}
        style={{
          ...baseStyle,
          background: activePage === 'spotify' ? INK : 'transparent',
          color: activePage === 'spotify' ? PAPER : INK,
        }}
      >
        {activePage === 'spotify' && (
          <span style={{ width: 6, height: 6, background: PAPER, borderRadius: 9999, display: 'inline-block' }} />
        )}
        Spotify View
        {activePage !== 'spotify' && (
          <span style={{ fontSize: 14, lineHeight: 1, marginTop: -1 }}>›</span>
        )}
      </button>
    </div>
  )
}
