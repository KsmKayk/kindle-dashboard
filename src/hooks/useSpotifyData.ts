'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { SpotifyPlayback, LyricsData } from '@/types'

// How often the browser player polls /api/spotify
const POLL_INTERVAL_MS = 5000
// Spotify applies a command asynchronously; poll again after this delay
const CONTROL_SETTLE_MS = 800
// The progress clock ticks locally; it only re-syncs to Spotify's position when
// they drift further apart than this (polled positions arrive with network lag,
// and resetting on every poll made the lyrics jump back and forth).
const RESYNC_DRIFT_MS = 1500
const CLOCK_TICK_MS = 100

interface PlaybackClock {
  trackId: string | null
  positionMs: number // position at `at`
  at: number
  playing: boolean
  durationMs: number
}

function clockPosition(clock: PlaybackClock, now = Date.now()): number {
  if (!clock.playing) return clock.positionMs
  return Math.min(clock.positionMs + (now - clock.at), clock.durationMs)
}

type ControlAction = 'play' | 'pause' | 'next' | 'previous'

interface SpotifyState {
  playback: SpotifyPlayback | null
  lyrics: LyricsData | null
  liveProgressMs: number
  controlError: string | null
}

export function useSpotifyData(): SpotifyState & {
  sendControl: (action: ControlAction) => Promise<void>
} {
  const [playback, setPlayback] = useState<SpotifyPlayback | null>(null)
  const [lyrics, setLyrics] = useState<LyricsData | null>(null)
  const [liveProgressMs, setLiveProgressMs] = useState(0)
  const [controlError, setControlError] = useState<string | null>(null)
  const lastTrackId = useRef<string | null>(null)
  const clock = useRef<PlaybackClock>({ trackId: null, positionMs: 0, at: 0, playing: false, durationMs: 0 })

  const fetchLyrics = useCallback(async (title: string, artist: string, album: string, durationMs: number) => {
    try {
      const params = new URLSearchParams({ title, artist, album, durationMs: String(durationMs) })
      const res = await fetch(`/api/spotify/lyrics?${params}`)
      if (!res.ok) throw new Error(`lyrics ${res.status}`)
      setLyrics(await res.json())
    } catch {
      // Lyrics service unavailable: forget the track so the next poll retries
      lastTrackId.current = null
    }
  }, [])

  const fetchPlayback = useCallback(async () => {
    try {
      const res = await fetch('/api/spotify')
      if (!res.ok) return
      const data: SpotifyPlayback = await res.json()
      setPlayback(data)

      const polledMs = data.track?.progressMs ?? 0
      const current = clock.current
      const drifted = Math.abs(clockPosition(current) - polledMs) > RESYNC_DRIFT_MS
      if (current.trackId !== (data.track?.id ?? null) || current.playing !== data.isPlaying || drifted) {
        clock.current = {
          trackId: data.track?.id ?? null,
          positionMs: polledMs,
          at: Date.now(),
          playing: data.isPlaying,
          durationMs: data.track?.durationMs ?? 0,
        }
        setLiveProgressMs(polledMs)
      }

      if (data.track && data.track.id !== lastTrackId.current) {
        lastTrackId.current = data.track.id
        setLyrics(null)
        fetchLyrics(data.track.title, data.track.artist, data.track.album, data.track.durationMs)
      }
    } catch {
      // keep previous state on network error
    }
  }, [fetchLyrics])

  async function sendControl(action: ControlAction) {
    setControlError(null)
    if (action === 'play' || action === 'pause') {
      // Optimistic: flip the button right away, the next poll confirms it
      setPlayback((current) => current && { ...current, isPlaying: action === 'play' })
      const now = Date.now()
      clock.current = { ...clock.current, positionMs: clockPosition(clock.current, now), at: now, playing: action === 'play' }
    }
    try {
      const res = await fetch('/api/spotify/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setControlError(body?.error ?? 'Playback control failed')
      }
    } catch {
      setControlError('Playback control failed')
    }
    setTimeout(fetchPlayback, CONTROL_SETTLE_MS)
  }

  useEffect(() => {
    const firstId = setTimeout(fetchPlayback, 0)
    const pollId = setInterval(fetchPlayback, POLL_INTERVAL_MS)
    return () => {
      clearTimeout(firstId)
      clearInterval(pollId)
    }
  }, [fetchPlayback])

  // Advance the progress (and so the lyrics) locally between polls; stops while paused
  useEffect(() => {
    const tickId = setInterval(() => setLiveProgressMs(clockPosition(clock.current)), CLOCK_TICK_MS)
    return () => clearInterval(tickId)
  }, [])

  return { playback, lyrics, liveProgressMs, controlError, sendControl }
}
