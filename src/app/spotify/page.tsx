'use client'

import { SpotifySection } from '@/components/spotify/SpotifySection'
import { NavButtons } from '@/components/layout/NavButtons'
import { Footer } from '@/components/layout/Footer'
import { useSpotifyData } from '@/hooks/useSpotifyData'

const INK = '#1a1612'
const PAPER = '#e8e3d8'

export default function SpotifyPage() {
  const { playback, lyrics, liveProgressMs, sendControl } = useSpotifyData()

  return (
    <div
      style={{
        width: 600,
        height: 800,
        background: PAPER,
        fontFamily: 'Georgia, "Times New Roman", serif',
        color: INK,
        padding: '20px 22px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        backgroundImage:
          'radial-gradient(circle at 20% 20%, rgba(0,0,0,0.015) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(0,0,0,0.02) 0%, transparent 50%)',
      }}
    >
      <SpotifySection
        playback={playback}
        lyrics={lyrics}
        liveProgressMs={liveProgressMs}
        onAction={sendControl}
      />
      <NavButtons activePage="spotify" />
      <Footer />
    </div>
  )
}
