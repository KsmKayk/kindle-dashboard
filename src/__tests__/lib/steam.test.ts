import { buildGameFallback, minutesToHours, getSteamHeaderImageUrl, getSteamLibraryImageUrl } from '@/lib/steam'

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
})
