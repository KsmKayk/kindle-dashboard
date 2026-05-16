export interface LyricLine {
  time: number
  text: string
}

export interface LyricsData {
  synced: LyricLine[]
  plain: string[]
}

export interface SpotifyTrackInfo {
  title: string
  artist: string
  album: string
  durationMs: number
  progressMs: number
  coverUrl: string | null
  fallback: string
  id: string
}

export interface SpotifyPlayback {
  isPlaying: boolean
  track: SpotifyTrackInfo | null
}
