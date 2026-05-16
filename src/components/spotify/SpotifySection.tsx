import { SectionHeader } from '@/components/ui/SectionHeader'
import { SpotifyPlayer } from './SpotifyPlayer'
import { LyricsDisplay } from './LyricsDisplay'
import type { SpotifyPlayback, LyricsData } from '@/types'

interface SpotifySectionProps {
  playback: SpotifyPlayback | null
  lyrics: LyricsData | null
  liveProgressMs: number
  onAction: (action: 'play' | 'pause' | 'next' | 'previous') => void
}

export function SpotifySection({ playback, lyrics, liveProgressMs, onAction }: SpotifySectionProps) {
  const currentTimeSeconds = liveProgressMs / 1000
  const synced = lyrics?.synced ?? []

  return (
    <>
      <SectionHeader label="SPOTIFY" meta="autumnfaun · streaming" />
      <SpotifyPlayer
        track={playback?.track ?? null}
        isPlaying={playback?.isPlaying ?? false}
        liveProgressMs={liveProgressMs}
        onAction={onAction}
      />
      <SectionHeader label="LYRICS" meta={synced.length > 0 ? 'synced' : 'plain'} />
      <LyricsDisplay lyrics={synced} currentTimeSeconds={currentTimeSeconds} />
    </>
  )
}
