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
})
