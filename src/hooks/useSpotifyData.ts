'use client'

import { useState, useEffect, useRef } from 'react'
import type { SpotifyPlayback, LyricsData } from '@/types'

interface SpotifyState {
  playback: SpotifyPlayback | null
  lyrics: LyricsData | null
  liveProgressMs: number
}

export function useSpotifyData(): SpotifyState & {
  sendControl: (action: 'play' | 'pause' | 'next' | 'previous') => Promise<void>
} {
  const [playback, setPlayback] = useState<SpotifyPlayback | null>(null)
  const [lyrics, setLyrics] = useState<LyricsData | null>(null)
  const [liveProgressMs, setLiveProgressMs] = useState(0)
  const lastTrackId = useRef<string | null>(null)
  const lastPollMs = useRef<number>(0)
  const interval = parseInt(process.env.NEXT_PUBLIC_SPOTIFY_UPDATE_RATE ?? '5', 10) * 1000

  async function sendControl(action: 'play' | 'pause' | 'next' | 'previous') {
    await fetch('/api/spotify/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    await fetchPlayback()
  }

  async function fetchPlayback() {
    try {
      const res = await fetch('/api/spotify')
      if (!res.ok) return
      const data: SpotifyPlayback = await res.json()
      setPlayback(data)
      setLiveProgressMs(data.track?.progressMs ?? 0)
      lastPollMs.current = Date.now()

      if (data.track && data.track.id !== lastTrackId.current) {
        lastTrackId.current = data.track.id
        fetchLyrics(data.track.title, data.track.artist, data.track.album)
      }
    } catch {
      // keep previous state on network error
    }
  }

  async function fetchLyrics(title: string, artist: string, album: string) {
    try {
      const params = new URLSearchParams({ title, artist, album })
      const res = await fetch(`/api/spotify/lyrics?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLyrics(data)
      } else {
        setLyrics(null)
      }
    } catch {
      setLyrics(null)
    }
  }

  useEffect(() => {
    fetchPlayback()
    const pollId = setInterval(fetchPlayback, interval)
    return () => clearInterval(pollId)
  }, [interval])

  // Smooth progress interpolation between polls (updates every second)
  useEffect(() => {
    const tickId = setInterval(() => {
      setPlayback((current) => {
        if (!current?.isPlaying || !current.track) return current
        const elapsed = Date.now() - lastPollMs.current
        const interpolated = Math.min(
          (current.track.progressMs + elapsed),
          current.track.durationMs
        )
        setLiveProgressMs(interpolated)
        return current
      })
    }, 1000)
    return () => clearInterval(tickId)
  }, [])

  return { playback, lyrics, liveProgressMs, sendControl }
}
