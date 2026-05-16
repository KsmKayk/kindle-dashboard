import type { SteamData, LeagueData, SpotifyPlayback, LyricLine } from '@/types'

describe('type imports', () => {
  it('SteamData shape is correct', () => {
    const data: SteamData = {
      nowPlaying: null,
      topGames: [],
      totalGames: 0,
      isOnline: false,
      personaname: 'test',
    }
    expect(data.totalGames).toBe(0)
  })

  it('LyricLine has time and text', () => {
    const line: LyricLine = { time: 12.5, text: 'hello' }
    expect(line.time).toBe(12.5)
  })
})
