/**
 * @jest-environment node
 */

import { GET } from '@/app/api/trmnl/route'

jest.mock('@/lib/server-cache', () => ({
  getCachedSteamData: jest.fn().mockResolvedValue({
    nowPlaying: { name: 'Elden Ring', appid: '1245620', headerImg: 'http://cdn/header.jpg', fallback: 'ELDEN' },
    topGames: [
      { name: 'Elden Ring', appid: 1245620, hours: 120, coverImg: 'http://cdn/cover.jpg', fallback: 'ELDEN' },
      { name: 'Dark Souls III', appid: 374320, hours: 80, coverImg: 'http://cdn/ds3.jpg', fallback: 'DS3' },
      { name: 'Sekiro', appid: 814380, hours: 60, coverImg: 'http://cdn/sekiro.jpg', fallback: 'SEK' },
    ],
    totalGames: 200,
    isOnline: true,
    personaname: 'AutumnFaun',
  }),
  getCachedLeagueData: jest.fn().mockResolvedValue({
    profile: { name: 'AutumnFaun', tag: '#SH4C0', level: 312, iconUrl: 'http://dd/icon.png', fallback: 'AU' },
    matches: [
      { matchId: 'BR1_1', champion: 'Jinx', win: true, kills: 10, deaths: 2, assists: 5, queueType: 'Ranked Solo', championImg: 'http://dd/Jinx.png', fallback: 'JINX' },
      { matchId: 'BR1_2', champion: 'Caitlyn', win: false, kills: 3, deaths: 7, assists: 2, queueType: 'Normal Draft', championImg: 'http://dd/Caitlyn.png', fallback: 'CAITLYN' },
    ],
    topChamps: [
      { name: 'Jinx', games: 15, winrate: 67, championImg: 'http://dd/Jinx.png', fallback: 'JINX' },
    ],
    ddVersion: '14.0.1',
  }),
}))

describe('GET /api/trmnl', () => {
  it('returns 200 with application/json content-type', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
  })

  it('includes steam fields', async () => {
    const res = await GET()
    const body = await res.json()
    expect(body.steam_online).toBe(true)
    expect(body.steam_username).toBe('AutumnFaun')
    expect(body.steam_now_playing).toBe('Elden Ring')
    expect(body.steam_now_playing_img).toBe('http://cdn/header.jpg')
    expect(body.steam_total_games).toBe(200)
    expect(body.steam_games).toHaveLength(3)
    expect(body.steam_games[0]).toMatchObject({ name: 'Elden Ring', hours: 120, img: 'http://cdn/cover.jpg' })
  })

  it('includes league fields', async () => {
    const res = await GET()
    const body = await res.json()
    expect(body.league_name).toBe('AutumnFaun')
    expect(body.league_tag).toBe('#SH4C0')
    expect(body.league_level).toBe(312)
    expect(body.league_icon).toBe('http://dd/icon.png')
    expect(body.league_matches).toHaveLength(2)
    expect(body.league_matches[0]).toMatchObject({ champion: 'Jinx', win: true, kda: '10/2/5', queue: 'Ranked Solo' })
    expect(body.league_top_champs).toHaveLength(1)
    expect(body.league_top_champs[0]).toMatchObject({ rank: 1, name: 'Jinx', games: 15, winrate: 67 })
  })

  it('returns partial data with nulls when Steam throws', async () => {
    const { getCachedSteamData } = jest.requireMock('@/lib/server-cache')
    getCachedSteamData.mockRejectedValueOnce(new Error('Steam API down'))
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.steam_username).toBeNull()
    expect(body.steam_games).toEqual([])
    expect(body.league_name).toBe('AutumnFaun')
  })

  it('returns partial data with nulls when League throws', async () => {
    const { getCachedLeagueData } = jest.requireMock('@/lib/server-cache')
    getCachedLeagueData.mockRejectedValueOnce(new Error('Riot API down'))
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.league_name).toBeNull()
    expect(body.league_matches).toEqual([])
    expect(body.steam_username).toBe('AutumnFaun')
  })
})
