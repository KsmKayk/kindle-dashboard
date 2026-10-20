import { renderKindleSpotifyPage, parseRefreshSeconds, refreshSecondsFor } from '@/lib/kindle-spotify-render'
import type { SpotifyPlayback, LyricsData } from '@/types'

const playing: SpotifyPlayback = {
  isPlaying: true,
  track: {
    title: 'Song <Title>',
    artist: 'Artist Name',
    album: 'Album',
    durationMs: 200000,
    progressMs: 50000,
    coverUrl: 'http://spotify/cover.jpg',
    fallback: 'ARTIST\nNAME',
    id: 'track123',
  },
}
const paused: SpotifyPlayback = { ...playing, isPlaying: false }

const lyrics: LyricsData = {
  synced: Array.from({ length: 20 }, (_, i) => ({ time: i * 5, text: `line ${i}` })),
  plain: [],
}

describe('parseRefreshSeconds', () => {
  it('defaults to 5 seconds', () => {
    expect(parseRefreshSeconds(null)).toBe(5)
    expect(parseRefreshSeconds('abc')).toBe(5)
  })

  it('clamps to the allowed range', () => {
    expect(parseRefreshSeconds('0')).toBe(2)
    expect(parseRefreshSeconds('10')).toBe(10)
    expect(parseRefreshSeconds('99999')).toBe(600)
  })
})

describe('refreshSecondsFor', () => {
  it('uses the interval while playing', () => {
    expect(refreshSecondsFor(playing, 5)).toBe(5)
  })

  it('reloads right after the track ends', () => {
    const ending = { ...playing, track: { ...playing.track!, progressMs: 198500 } }
    expect(refreshSecondsFor(ending, 10)).toBe(3)
  })

  it('reloads less often while paused', () => {
    expect(refreshSecondsFor(paused, 5)).toBe(30)
    expect(refreshSecondsFor(null, 5)).toBe(30)
  })
})

describe('renderKindleSpotifyPage', () => {
  it('renders the track, escaped, with a meta refresh', () => {
    const html = renderKindleSpotifyPage(playing, null, 5)
    expect(html).toContain('Song &lt;Title&gt;')
    expect(html).toContain('Artist Name')
    expect(html).toContain('NOW PLAYING')
    expect(html).toContain('<meta http-equiv="refresh" content="5">')
  })

  it('posts the controls as forms, with pause while playing', () => {
    const html = renderKindleSpotifyPage(playing, null, 7)
    expect(html).toContain('action="/kindle/spotify/control"')
    expect(html).toContain('value="pause"')
    expect(html).not.toContain('value="play"')
    expect(html).toContain('name="r" value="7"')
  })

  it('offers play when paused', () => {
    const html = renderKindleSpotifyPage(paused, null, 5)
    expect(html).toContain('PAUSED')
    expect(html).toContain('value="play"')
  })

  it('highlights the current lyric line with context around it', () => {
    const html = renderKindleSpotifyPage(playing, lyrics, 5) // 50s -> line 10
    expect(html).toMatch(/font-weight:bold;[^>]*>line 10</)
    expect(html).toContain('line 6<')
    expect(html).toContain('line 14<')
    expect(html).not.toContain('line 5<')
    expect(html).not.toContain('line 15<')
  })

  it('shows unsynced lyrics and the no-lyrics message', () => {
    expect(renderKindleSpotifyPage(playing, { synced: [], plain: ['plain line'] }, 5)).toContain('plain line')
    expect(renderKindleSpotifyPage(playing, null, 5)).toContain('No lyrics available')
  })

  it('shows a control error', () => {
    expect(renderKindleSpotifyPage(playing, null, 5, 'No active <device>')).toContain('No active &lt;device&gt;')
  })

  it('handles nothing played yet', () => {
    const html = renderKindleSpotifyPage(null, null, 5)
    expect(html).toContain('Nothing played yet')
    expect(html).not.toContain('/kindle/spotify/control')
  })

  it('links between the Kindle pages', () => {
    const html = renderKindleSpotifyPage(null, null, 5)
    expect(html).toContain('href="/kindle"')
    expect(html).toContain('href="/kindle/spotify"')
  })
})
