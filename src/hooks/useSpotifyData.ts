'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { SpotifyPlayback, LyricsData } from '@/types'

// How often the browser player polls /api/spotify
const POLL_INTERVAL_MS = 5000
// Spotify applies a command asynchronously; poll again after this delay
const CONTROL_SETTLE_MS = 800

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
  const lastPollMs = useRef<number>(0)

  const fetchLyrics = useCallback(async (title: string, artist: string, album: string, durationMs: number) => {
    try {
      const params = new URLSearchParams({ title, artist, album, durationMs: String(durationMs) })
      const res = await fetch(`/api/spotify/lyrics?${params}`)
      setLyrics(res.ok ? await res.json() : null)
    } catch {
      setLyrics(null)
    }
  }, [])

  const fetchPlayback = useCallback(async () => {
    try {
      const res = await fetch('/api/spotify')
      if (!res.ok) return
      const data: SpotifyPlayback = await res.json()
      setPlayback(data)
      setLiveProgressMs(data.track?.progressMs ?? 0)
      lastPollMs.current = Date.now()

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
      lastPollMs.current = Date.now()
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

  // Smooth progress interpolation between polls (updates every second)
  useEffect(() => {
    const tickId = setInterval(() => {
      setPlayback((current) => {
        if (!current?.isPlaying || !current.track) return current
        const elapsed = Date.now() - lastPollMs.current
        setLiveProgressMs(Math.min(current.track.progressMs + elapsed, current.track.durationMs))
        return current
      })
    }, 1000)
    return () => clearInterval(tickId)
  }, [])

  return { playback, lyrics, liveProgressMs, controlError, sendControl }
}
