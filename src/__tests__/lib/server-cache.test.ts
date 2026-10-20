/**
 * @jest-environment node
 */

import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { getCachedSteamData, getCachedLeagueData, resetCacheForTest } from '@/lib/server-cache'
import { buildSteamData } from '@/lib/steam'
import { buildLeagueData } from '@/lib/league'
import type { SteamData, LeagueData } from '@/types'

jest.mock('@/lib/steam')
jest.mock('@/lib/league')

const mockSteam = buildSteamData as jest.MockedFunction<typeof buildSteamData>
const mockLeague = buildLeagueData as jest.MockedFunction<typeof buildLeagueData>

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
