/**
 * @jest-environment node
 */

import { parseLrcLibResponse, formatFallback, spotifyRedirectUri, controlPlayback, getLyrics, pickLrcLibResult } from '@/lib/spotify'

describe('Spotify utility functions', () => {
  it('parseLrcLibResponse parses synced lyrics', () => {
    const raw = '[00:12.50] Hello world\n[00:15.20] Second line\n'
    const result = parseLrcLibResponse(raw)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ time: 12.5, text: 'Hello world' })
    expect(result[1]).toEqual({ time: 15.2, text: 'Second line' })
  })

  it('parseLrcLibResponse skips metadata lines', () => {
    const raw = '[ar:Artist]\n[ti:Title]\n[00:05.00] Actual lyric\n'
    const result = parseLrcLibResponse(raw)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('Actual lyric')
  })

  it('formatFallback truncates artist name', () => {
    expect(formatFallback('The Beatles')).toBe('THE\nBEATLES')
    expect(formatFallback('Taylor Swift - Red')).toBe('TAYLOR\nSWIFT')
  })

  it('spotifyRedirectUri uses the public host behind a proxy', () => {
    const req = new Request('http://0.0.0.0:3000/api/spotify/auth', {
      headers: { host: 'kindle.example.com', 'x-forwarded-proto': 'https' },
    })
    expect(spotifyRedirectUri(req)).toBe('https://kindle.example.com/api/spotify/callback')
  })

  it('spotifyRedirectUri falls back to the request URL locally', () => {
    const req = new Request('http://localhost:3000/api/spotify/auth')
    expect(spotifyRedirectUri(req)).toBe('http://localhost:3000/api/spotify/callback')
  })

  describe('controlPlayback', () => {
    afterEach(() => jest.restoreAllMocks())

    it('resolves when Spotify accepts the command', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
      await expect(controlPlayback('next', 'token')).resolves.toBeUndefined()
    })

    it('explains a 403 as Premium required', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 403 }))
      await expect(controlPlayback('pause', 'token')).rejects.toThrow('Premium')
    })

    it('explains a 404 as no active device', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 404 }))
      await expect(controlPlayback('play', 'token')).rejects.toThrow('No active Spotify device')
    })
  })

  describe('lyrics lookup', () => {
    afterEach(() => jest.restoreAllMocks())

    it('pickLrcLibResult prefers a duration match with synced lyrics', () => {
      const results = [
        { duration: 300, syncedLyrics: '[00:01.00] wrong version' },
        { duration: 184, plainLyrics: 'plain only' },
        { duration: 185, syncedLyrics: '[00:01.00] right' },
      ]
      expect(pickLrcLibResult(results, 184004)).toBe(results[2])
    })

    it('pickLrcLibResult skips results without lyrics', () => {
      expect(pickLrcLibResult([{ duration: 184 }], 184000)).toBeNull()
    })

    it('falls back to a search by the first artist when the exact lookup misses', async () => {
      const fetchMock = jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response('{}', { status: 404 }))
        .mockResolvedValueOnce(Response.json([{ duration: 184, plainLyrics: 'Line one\nLine two' }]))
      const lyrics = await getLyrics('Diamante', 'TheFox, Dri, Fenyx', 'Diamante', 184004)
      expect(lyrics).toEqual({ synced: [], plain: ['Line one', 'Line two'] })
      const searchUrl = new URL(String(fetchMock.mock.calls[1][0]))
      expect(searchUrl.pathname).toBe('/api/search')
      expect(searchUrl.searchParams.get('artist_name')).toBe('TheFox')
    })

    it('throws when LRCLIB is unavailable so the caller can retry', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 503 }))
      await expect(getLyrics('Song', 'Artist', 'Album')).rejects.toThrow('LRCLIB unavailable')
    })

    it('uses the exact lookup when it has lyrics', async () => {
      const fetchMock = jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce(Response.json({ syncedLyrics: '[00:05.00] Hello' }))
      const lyrics = await getLyrics('Song', 'Artist', 'Album')
      expect(lyrics?.synced).toEqual([{ time: 5, text: 'Hello' }])
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})
