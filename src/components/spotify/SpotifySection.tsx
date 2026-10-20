import { SectionHeader } from '@/components/ui/SectionHeader'
import { SpotifyPlayer } from './SpotifyPlayer'
import { LyricsDisplay } from './LyricsDisplay'
import type { SpotifyPlayback, LyricsData } from '@/types'

interface SpotifySectionProps {
  playback: SpotifyPlayback | null
  lyrics: LyricsData | null
  liveProgressMs: number
  controlError?: string | null
  onAction: (action: 'play' | 'pause' | 'next' | 'previous') => void
}

export function SpotifySection({ playback, lyrics, liveProgressMs, controlError, onAction }: SpotifySectionProps) {
  const currentTimeSeconds = liveProgressMs / 1000
  const synced = lyrics?.synced ?? []
  const plain = lyrics?.plain ?? []
  const status = !playback?.track ? 'idle' : playback.isPlaying ? 'now playing' : 'paused · last played'

  return (
    <>
      <SectionHeader label="SPOTIFY" meta={status} />
      <SpotifyPlayer
        track={playback?.track ?? null}
        isPlaying={playback?.isPlaying ?? false}
        liveProgressMs={liveProgressMs}
        onAction={onAction}
      />
      {controlError && (
        <div role="alert" style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif', fontSize: 11, textAlign: 'center', margin: '-4px 0 10px' }}>
          {controlError}
        </div>
      )}
      <SectionHeader label="LYRICS" meta={synced.length > 0 ? 'synced' : plain.length > 0 ? 'plain' : ''} />
      <LyricsDisplay lyrics={synced} plainLyrics={plain} currentTimeSeconds={currentTimeSeconds} />
    </>
  )
}
