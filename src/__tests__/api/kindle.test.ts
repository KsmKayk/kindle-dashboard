/**
 * @jest-environment node
 */

import { GET } from '@/app/kindle/route'
import { getCachedSteamData, getCachedLeagueData } from '@/lib/server-cache'
import { getAccessToken, getCurrentlyPlaying } from '@/lib/spotify'

jest.mock('@/lib/server-cache')
jest.mock('@/lib/spotify')

const mockSteamCache = getCachedSteamData as jest.MockedFunction<typeof getCachedSteamData>
const mockLeagueCache = getCachedLeagueData as jest.MockedFunction<typeof getCachedLeagueData>
const mockToken = getAccessToken as jest.MockedFunction<typeof getAccessToken>
const mockNowPlaying = getCurrentlyPlaying as jest.MockedFunction<typeof getCurrentlyPlaying>

const fakeSteam = {
  nowPlaying: null,
  topGames: [],
  totalGames: 10,
  isOnline: false,
  personaname: 'Tester',
}

const fakeLeague = {
  profile: { name: 'Tester', tag: '#TEST', level: 1, iconUrl: 'http://x/icon.png', fallback: 'TE' },
  matches: [],
  topChamps: [],
  ddVersion: '14.0.1',
}

beforeEach(() => {
  mockSteamCache.mockResolvedValue(fakeSteam as never)
  mockLeagueCache.mockResolvedValue(fakeLeague as never)
  mockToken.mockResolvedValue('mock-token')
  mockNowPlaying.mockResolvedValue({ isPlaying: false, track: null })
})

it('returns 200 with text/html content type', async () => {
  const req = new Request('http://localhost:3000/kindle')
  const res = await GET(req)
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toContain('text/html')
})

it('returns HTML document with meta refresh', async () => {
  const req = new Request('http://localhost:3000/kindle')
  const res = await GET(req)
  const html = await res.text()
  expect(html).toContain('<!DOCTYPE html>')
  expect(html).toContain('http-equiv="refresh"')
})

it('includes Steam personaname in HTML output', async () => {
  const req = new Request('http://localhost:3000/kindle')
  const res = await GET(req)
  const html = await res.text()
  expect(html).toContain('Tester')
})

it('returns valid HTML even when Steam cache throws', async () => {
  mockSteamCache.mockRejectedValue(new Error('Steam unavailable'))
  const req = new Request('http://localhost:3000/kindle')
  const res = await GET(req)
  expect(res.status).toBe(200)
  const html = await res.text()
  expect(html).toContain('<!DOCTYPE html>')
})

it('returns valid HTML even when League cache throws', async () => {
  mockLeagueCache.mockRejectedValue(new Error('League unavailable'))
  const req = new Request('http://localhost:3000/kindle')
  const res = await GET(req)
  expect(res.status).toBe(200)
})

it('returns valid HTML when Spotify is not configured', async () => {
  mockToken.mockRejectedValue(new Error('SPOTIFY_REFRESH_TOKEN not set'))
  const req = new Request('http://localhost:3000/kindle')
  const res = await GET(req)
  expect(res.status).toBe(200)
})
