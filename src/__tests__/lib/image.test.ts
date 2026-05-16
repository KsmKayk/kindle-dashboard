import { fetchAndGrayscale, isAllowedImageUrl } from '@/lib/image'

global.fetch = jest.fn()

describe('isAllowedImageUrl', () => {
  it('allows Steam CDN', () => {
    expect(isAllowedImageUrl('https://cdn.cloudflare.steamstatic.com/steam/apps/123/header.jpg')).toBe(true)
  })
  it('allows Data Dragon', () => {
    expect(isAllowedImageUrl('https://ddragon.leagueoflegends.com/cdn/14.10.1/img/champion/Ahri.png')).toBe(true)
  })
  it('allows Spotify CDN', () => {
    expect(isAllowedImageUrl('https://i.scdn.co/image/abc123')).toBe(true)
  })
  it('blocks arbitrary URLs', () => {
    expect(isAllowedImageUrl('https://evil.com/malware.png')).toBe(false)
  })
  it('blocks internal IP ranges', () => {
    expect(isAllowedImageUrl('http://192.168.1.1/image.png')).toBe(false)
  })
})
