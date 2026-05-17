import { buildSteamData } from './steam'
import { buildLeagueData } from './league'
import type { SteamData, LeagueData } from '@/types'

interface Entry<T> { data: T; at: number }

let steamEntry: Entry<SteamData> | null = null
let leagueEntry: Entry<LeagueData> | null = null

function steamTtlMs() { return parseInt(process.env.STEAM_UPDATE_RATE ?? '60', 10) * 1000 }
function leagueTtlMs() { return parseInt(process.env.LEAGUE_UPDATE_RATE ?? '600', 10) * 1000 }

export async function getCachedSteamData(): Promise<SteamData> {
  if (steamEntry && Date.now() - steamEntry.at < steamTtlMs()) return steamEntry.data
  const data = await buildSteamData()
  steamEntry = { data, at: Date.now() }
  return data
}

export async function getCachedLeagueData(): Promise<LeagueData> {
  if (leagueEntry && Date.now() - leagueEntry.at < leagueTtlMs()) return leagueEntry.data
  const data = await buildLeagueData()
  leagueEntry = { data, at: Date.now() }
  return data
}

export function resetCacheForTest() {
  steamEntry = null
  leagueEntry = null
}
