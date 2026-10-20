/**
 * @jest-environment node
 */

import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { getCachedSteamData, getCachedLeagueData, getSpotifyNowOrLast, resetCacheForTest } from '@/lib/server-cache'
import { buildSteamData } from '@/lib/steam'
import { buildLeagueData } from '@/lib/league'
import { getAccessToken, getCurrentlyPlaying } from '@/lib/spotify'
import type { SteamData, LeagueData, SpotifyPlayback } from '@/types'

jest.mock('@/lib/steam')
jest.mock('@/lib/league')
jest.mock('@/lib/spotify')

const mockSteam = buildSteamData as jest.MockedFunction<typeof buildSteamData>
const mockLeague = buildLeagueData as jest.MockedFunction<typeof buildLeagueData>
const mockToken = getAccessToken as jest.MockedFunction<typeof getAccessToken>
const mockPlaying = getCurrentlyPlaying as jest.MockedFunction<typeof getCurrentlyPlaying>

const fakeSteam: SteamData = {
  nowPlaying: null,
  topGames: [],
  totalGames: 42,
  isOnline: true,
  personaname: 'TestUser',
}

const fakeLeague: LeagueData = {
  profile: { name: 'Summoner', tag: '#TEST', level: 100, iconUrl: 'http://x.com/icon.png', fallback: 'SU' },
  matches: [],
  topChamps: [],
  ddVersion: '14.0.1',
}

beforeEach(() => {
  process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'server-cache-'))
  jest.clearAllMocks()
  resetCacheForTest()
  mockSteam.mockResolvedValue(fakeSteam)
  mockLeague.mockResolvedValue(fakeLeague)
  mockToken.mockResolvedValue('token')
})

describe('getCachedSteamData', () => {
  it('fetches and returns data on first call', async () => {
    const data = await getCachedSteamData()
    expect(data).toEqual(fakeSteam)
    expect(mockSteam).toHaveBeenCalledTimes(1)
  })

  it('returns cached data on second call without fetching again', async () => {
    await getCachedSteamData()
    await getCachedSteamData()
    expect(mockSteam).toHaveBeenCalledTimes(1)
  })

  it('refetches after TTL expires', async () => {
    process.env.STEAM_UPDATE_RATE = '1'
    await getCachedSteamData()
    await new Promise((r) => setTimeout(r, 1100))
    await getCachedSteamData()
    expect(mockSteam).toHaveBeenCalledTimes(2)
    delete process.env.STEAM_UPDATE_RATE
  })
})

describe('getCachedLeagueData', () => {
  it('fetches and returns data on first call', async () => {
    const data = await getCachedLeagueData()
    expect(data).toEqual(fakeLeague)
    expect(mockLeague).toHaveBeenCalledTimes(1)
  })

  it('returns cached data on second call without fetching again', async () => {
    await getCachedLeagueData()
    await getCachedLeagueData()
    expect(mockLeague).toHaveBeenCalledTimes(1)
  })

  it('keeps the last good data when a refetch fails', async () => {
    process.env.LEAGUE_UPDATE_RATE = '0'
    await getCachedLeagueData()
    mockLeague.mockRejectedValueOnce(new Error('Riot API error 429'))
    const data = await getCachedLeagueData()
    expect(data).toEqual(fakeLeague)
    expect(mockLeague).toHaveBeenCalledTimes(2)
    delete process.env.LEAGUE_UPDATE_RATE
  })

  it('throws when the fetch fails and there is no saved data', async () => {
    mockLeague.mockRejectedValueOnce(new Error('Riot API error 429'))
    await expect(getCachedLeagueData()).rejects.toThrow('429')
  })

  it('does not call the API again right after a failure', async () => {
    mockLeague.mockRejectedValueOnce(new Error('Riot API error 429'))
    await expect(getCachedLeagueData()).rejects.toThrow('429')
    await expect(getCachedLeagueData()).rejects.toThrow('429')
    expect(mockLeague).toHaveBeenCalledTimes(1)
  })

  it('shares one fetch between concurrent requests', async () => {
    const results = await Promise.all([getCachedLeagueData(), getCachedLeagueData(), getCachedLeagueData()])
    expect(results).toEqual([fakeLeague, fakeLeague, fakeLeague])
    expect(mockLeague).toHaveBeenCalledTimes(1)
  })

  it('serves saved data from disk when the first fetch after a restart fails', async () => {
    await getCachedLeagueData()
    resetCacheForTest({ keepDisk: true })
    process.env.LEAGUE_UPDATE_RATE = '0'
    mockLeague.mockRejectedValueOnce(new Error('Riot API error 429'))
    const data = await getCachedLeagueData()
    expect(data).toEqual(fakeLeague)
    expect(mockLeague).toHaveBeenCalledTimes(2)
    delete process.env.LEAGUE_UPDATE_RATE
  })

  it('does not refetch after a restart while saved data is fresh', async () => {
    await getCachedLeagueData()
    resetCacheForTest({ keepDisk: true })
    await getCachedLeagueData()
    expect(mockLeague).toHaveBeenCalledTimes(1)
  })
})

describe('getSpotifyNowOrLast', () => {
  const playing: SpotifyPlayback = {
    isPlaying: true,
    track: {
      title: 'Song', artist: 'Artist', album: 'Album', durationMs: 1000, progressMs: 10,
      coverUrl: 'http://i.scdn.co/cover.jpg', fallback: 'ARTIST', id: 'abc',
    },
  }

  it('returns the current track', async () => {
    mockPlaying.mockResolvedValue(playing)
    expect(await getSpotifyNowOrLast()).toEqual(playing)
  })

  it('returns the last played track, not playing, when nothing is playing', async () => {
    mockPlaying.mockResolvedValueOnce(playing)
    await getSpotifyNowOrLast()
    mockPlaying.mockResolvedValueOnce({ isPlaying: false, track: null })
    expect(await getSpotifyNowOrLast()).toEqual({ ...playing, isPlaying: false })
  })

  it('returns the last played track when Spotify fails, also after a restart', async () => {
    mockPlaying.mockResolvedValueOnce(playing)
    await getSpotifyNowOrLast()
    resetCacheForTest({ keepDisk: true })
    mockPlaying.mockRejectedValueOnce(new Error('Spotify API error: 503'))
    expect(await getSpotifyNowOrLast()).toEqual({ ...playing, isPlaying: false })
  })

  it('returns null when nothing has ever played', async () => {
    mockPlaying.mockResolvedValueOnce({ isPlaying: false, track: null })
    expect(await getSpotifyNowOrLast()).toBeNull()
  })
})
