import { getCachedSteamData, getCachedLeagueData } from '@/lib/server-cache'
import type { SteamData, LeagueData } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function steamPayload(steam: SteamData | null) {
  if (!steam) {
    return {
      steam_online: false,
      steam_username: null,
      steam_now_playing: null,
      steam_now_playing_img: null,
      steam_games: [] as { name: string; hours: number; img: string }[],
      steam_total_games: null,
    }
  }
  return {
    steam_online: steam.isOnline,
    steam_username: steam.personaname,
    steam_now_playing: steam.nowPlaying?.name ?? null,
    steam_now_playing_img: steam.nowPlaying?.headerImg ?? null,
    steam_games: steam.topGames.map(g => ({ name: g.name, hours: g.hours, img: g.coverImg })),
    steam_total_games: steam.totalGames,
  }
}

function leaguePayload(league: LeagueData | null) {
  if (!league) {
    return {
      league_name: null,
      league_tag: null,
      league_level: null,
      league_icon: null,
      league_matches: [] as { champion: string; win: boolean; kda: string; queue: string; img: string }[],
      league_top_champs: [] as { rank: number; name: string; games: number; winrate: number; img: string }[],
    }
  }
  return {
    league_name: league.profile.name,
    league_tag: league.profile.tag,
    league_level: league.profile.level,
    league_icon: league.profile.iconUrl,
    league_matches: league.matches.map(m => ({
      champion: m.champion,
      win: m.win,
      kda: `${m.kills}/${m.deaths}/${m.assists}`,
      queue: m.queueType,
      img: m.championImg,
    })),
    league_top_champs: league.topChamps.map((c, i) => ({
      rank: i + 1,
      name: c.name,
      games: c.games,
      winrate: c.winrate,
      img: c.championImg,
    })),
  }
}

export async function GET(): Promise<Response> {
  const [steam, league] = await Promise.all([
    getCachedSteamData().catch((): SteamData | null => null),
    getCachedLeagueData().catch((): LeagueData | null => null),
  ])

  return Response.json({
    ...steamPayload(steam),
    ...leaguePayload(league),
  })
}
