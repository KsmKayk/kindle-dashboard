import { renderKindlePage, escapeHtml } from '@/lib/kindle-render'
import type { SteamData, LeagueData, SpotifyPlayback } from '@/types'

const BASE = 'http://localhost:3000'

const steam: SteamData = {
  nowPlaying: { name: 'Elden Ring', appid: '1245620', headerImg: 'http://cdn/1245620/header.jpg', fallback: 'ELDEN\nRING' },
  topGames: [
    { name: 'Elden Ring', appid: 1245620, hours: 120, coverImg: 'http://cdn/1245620/library.jpg', fallback: 'ELDEN\nRING' },
    { name: 'Dark Souls III', appid: 374320, hours: 80, coverImg: 'http://cdn/374320/library.jpg', fallback: 'DARK\nSOULS' },
    { name: 'Sekiro', appid: 814380, hours: 60, coverImg: 'http://cdn/814380/library.jpg', fallback: 'SEKIRO' },
  ],
  totalGames: 200,
  isOnline: true,
  personaname: 'AutumnFaun',
}

const league: LeagueData = {
  profile: { name: 'AutumnFaun', tag: '#SH4C0', level: 312, iconUrl: 'http://dd/icon/123.png', fallback: 'AU' },
  matches: [
    { matchId: 'BR1_1', champion: 'Jinx', win: true, kills: 10, deaths: 2, assists: 5, queueType: 'Ranked Solo', championImg: 'http://dd/Jinx.png', fallback: 'JINX' },
    { matchId: 'BR1_2', champion: 'Caitlyn', win: false, kills: 3, deaths: 7, assists: 2, queueType: 'Normal Draft', championImg: 'http://dd/Caitlyn.png', fallback: 'CAITLYN' },
  ],
  topChamps: [
    { name: 'Jinx', games: 15, winrate: 67, championImg: 'http://dd/Jinx.png', fallback: 'JINX' },
  ],
  ddVersion: '14.0.1',
}

const spotify: SpotifyPlayback = {
  isPlaying: true,
  track: {
    title: 'Song Title',
    artist: 'Artist Name',
    album: 'Album',
    durationMs: 200000,
    progressMs: 50000,
    coverUrl: 'http://spotify/cover.jpg',
    fallback: 'ARTIST\nNAME',
    id: 'track123',
  },
}

describe('renderKindlePage', () => {
  it('returns a complete HTML document', () => {
    const html = renderKindlePage(null, null, null, BASE)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('</html>')
  })

  it('includes meta refresh tag with configurable interval', () => {
    process.env.STEAM_UPDATE_RATE = '120'
    process.env.LEAGUE_UPDATE_RATE = '600'
    const html = renderKindlePage(null, null, null, BASE)
    expect(html).toContain('http-equiv="refresh"')
    expect(html).toContain('content="120"')
    delete process.env.STEAM_UPDATE_RATE
    delete process.env.LEAGUE_UPDATE_RATE
  })

  it('includes personaname when Steam data is provided', () => {
    const html = renderKindlePage(steam, null, null, BASE)
    expect(html).toContain('AutumnFaun')
    expect(html).toContain('online')
    expect(html).toContain('Elden Ring')
    expect(html).toContain('120h')
  })

  it('uses image proxy URL for Steam game images', () => {
    const html = renderKindlePage(steam, null, null, BASE)
    expect(html).toContain('/api/image-proxy?url=')
    expect(html).toContain(encodeURIComponent('http://cdn/1245620/library.jpg'))
  })

  it('includes player name and match results when League data is provided', () => {
    const html = renderKindlePage(null, league, null, BASE)
    expect(html).toContain('AutumnFaun')
    expect(html).toContain('#SH4C0')
    expect(html).toContain('Level 312')
    expect(html).toContain('Jinx')
    expect(html).toContain('WIN')
    expect(html).toContain('LOSS')
    expect(html).toContain('67% WR')
  })

  it('includes Spotify track when playing', () => {
    const html = renderKindlePage(null, null, spotify, BASE)
    expect(html).toContain('Song Title')
    expect(html).toContain('Artist Name')
  })

  it('omits Spotify section when not playing', () => {
    const noSpotify: SpotifyPlayback = { isPlaying: false, track: null }
    const html = renderKindlePage(null, null, noSpotify, BASE)
    expect(html).not.toContain('♫')
  })

  it('shows unavailable message when data is null', () => {
    const html = renderKindlePage(null, null, null, BASE)
    expect(html).toContain('unavailable')
  })
})

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry')
  })

  it('returns plain strings unchanged', () => {
    expect(escapeHtml('AutumnFaun')).toBe('AutumnFaun')
  })
})
