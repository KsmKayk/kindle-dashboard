import { parseLrcLibResponse, formatFallback } from '@/lib/spotify'

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
})
