import { buildGameFallback, minutesToHours, getSteamHeaderImageUrl, getSteamLibraryImageUrl, pickLastPlayed, daysAgo } from '@/lib/steam'

describe('Steam utility functions', () => {
  it('minutesToHours converts correctly', () => {
    expect(minutesToHours(120)).toBe(2)
    expect(minutesToHours(90)).toBe(1.5)
    expect(minutesToHours(0)).toBe(0)
  })

  it('buildGameFallback truncates and uppercases long names', () => {
    expect(buildGameFallback('Elden Ring')).toBe('ELDEN\nRING')
    expect(buildGameFallback('Dark Souls II: Scholar of the First Sin')).toBe('DARK\nSOULS\nII:')
  })

  it('getSteamHeaderImageUrl formats correctly', () => {
    expect(getSteamHeaderImageUrl(1245620)).toBe(
      'https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg'
    )
  })

  it('getSteamLibraryImageUrl formats correctly', () => {
    expect(getSteamLibraryImageUrl(335300)).toBe(
      'https://cdn.cloudflare.steamstatic.com/steam/apps/335300/library_600x900.jpg'
    )
  })

  it('pickLastPlayed returns the most recently played game', () => {
    const last = pickLastPlayed([
      { appid: 1, name: 'Old', rtime_last_played: 100 },
      { appid: 2, name: 'Recent', rtime_last_played: 300 },
      { appid: 3, name: 'Never', rtime_last_played: 0 },
      { appid: 4, name: 'Unknown' },
    ])
    expect(last).toEqual({
      name: 'Recent',
      appid: 2,
      headerImg: 'https://cdn.cloudflare.steamstatic.com/steam/apps/2/header.jpg',
      fallback: 'RECENT',
      playedAt: 300,
    })
  })

  it('pickLastPlayed returns null when no game was ever played', () => {
    expect(pickLastPlayed([{ appid: 1, name: 'Never', rtime_last_played: 0 }])).toBeNull()
  })

  it('daysAgo formats relative days', () => {
    const now = Date.UTC(2026, 9, 20, 12)
    const hoursAgo = (h: number) => (now - h * 3_600_000) / 1000
    expect(daysAgo(hoursAgo(5), now)).toBe('today')
    expect(daysAgo(hoursAgo(30), now)).toBe('yesterday')
    expect(daysAgo(hoursAgo(24 * 17 + 2), now)).toBe('17 days ago')
  })
})
