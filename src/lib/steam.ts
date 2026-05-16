import type { SteamData, SteamNowPlaying, SteamTopGame } from '@/types'

const API_BASE = 'https://api.steampowered.com'

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10
}

export function buildGameFallback(name: string): string {
  return name.split(' ').slice(0, 3).join('\n').toUpperCase()
}

export function getSteamHeaderImageUrl(appId: number | string): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`
}

export function getSteamLibraryImageUrl(appId: number | string): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`
}

async function steamFetch<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const key = process.env.STEAM_API_KEY!
  const steamId = process.env.STEAM_ID!
  const url = new URL(`${API_BASE}/${endpoint}`)
  url.searchParams.set('key', key)
  url.searchParams.set('steamid', steamId)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`Steam API error: ${res.status}`)
  return res.json() as T
}

export async function buildSteamData(): Promise<SteamData> {
  const [summaryRes, ownedRes] = await Promise.all([
    steamFetch<{ response: { players: Array<{ personaname: string; personastate: number; gameid?: string; gameextrainfo?: string }> } }>(
      'ISteamUser/GetPlayerSummaries/v0002/', {}
    ),
    steamFetch<{ response: { games?: Array<{ appid: number; name: string; playtime_forever: number }>; game_count?: number } }>(
      'IPlayerService/GetOwnedGames/v0001/',
      { include_appinfo: '1', include_played_free_games: '1' }
    ),
  ])

  const player = summaryRes.response.players[0]
  const allGames = ownedRes.response.games ?? []
  const totalGames = ownedRes.response.game_count ?? allGames.length

  let nowPlaying: SteamNowPlaying | null = null
  if (player.gameid && player.gameextrainfo) {
    nowPlaying = {
      name: player.gameextrainfo,
      appid: player.gameid,
      headerImg: getSteamHeaderImageUrl(player.gameid),
      fallback: buildGameFallback(player.gameextrainfo),
    }
  }

  const topGames: SteamTopGame[] = allGames
    .filter((g) => g.playtime_forever > 0)
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, 3)
    .map((g) => ({
      name: g.name,
      appid: g.appid,
      hours: minutesToHours(g.playtime_forever),
      coverImg: getSteamLibraryImageUrl(g.appid),
      fallback: buildGameFallback(g.name),
    }))

  return {
    nowPlaying,
    topGames,
    totalGames,
    isOnline: player.personastate !== 0,
    personaname: player.personaname,
  }
}
