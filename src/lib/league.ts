import type { LeagueData, MatchResult, ChampionStat, SummonerProfile } from '@/types'

const BR1_BASE = 'https://br1.api.riotgames.com'
const AMERICAS_BASE = 'https://americas.api.riotgames.com'
const DD_BASE = 'https://ddragon.leagueoflegends.com'

const QUEUE_LABELS: Record<number, string> = {
  420: 'Ranked Solo',
  440: 'Ranked Flex',
  400: 'Normal Draft',
  430: 'Normal Blind',
  450: 'ARAM',
}

export function queueTypeLabel(queueId: number): string {
  return QUEUE_LABELS[queueId] ?? 'Normal'
}

export function buildChampionFallback(name: string): string {
  const words = name.split(' ')
  if (words.length === 1) return name.toUpperCase()
  return words.map((w) => w[0]).join('').toUpperCase()
}

export function getChampionImageUrl(championName: string, ddVersion: string): string {
  return `${DD_BASE}/cdn/${ddVersion}/img/champion/${championName}.png`
}

export function getProfileIconUrl(iconId: number, ddVersion: string): string {
  return `${DD_BASE}/cdn/${ddVersion}/img/profileicon/${iconId}.png`
}

export function buildChampIdMap(champJson: { data: Record<string, { key: string; name: string }> }): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [champName, champInfo] of Object.entries(champJson.data)) {
    map[champInfo.key] = champName
  }
  return map
}

async function riotFetch<T>(baseUrl: string, path: string): Promise<T> {
  const key = process.env.LEAGUE_API_KEY!
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'X-Riot-Token': key },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Riot API error ${res.status} at ${path}`)
  return res.json() as T
}

export async function getDDVersion(): Promise<string> {
  const versions = await fetch(`${DD_BASE}/api/versions.json`).then((r) => r.json()) as string[]
  return versions[0]
}

export async function getSummonerData(summonerId: string): Promise<SummonerProfile> {
  return riotFetch<SummonerProfile>(BR1_BASE, `/lol/summoner/v4/summoners/${summonerId}`)
}

async function getMatchDetails(matchId: string, puuid: string, ddVersion: string): Promise<MatchResult> {
  type MatchResponse = {
    info: {
      queueId: number
      participants: Array<{
        puuid: string
        championName: string
        kills: number
        deaths: number
        assists: number
        win: boolean
      }>
    }
  }
  const match = await riotFetch<MatchResponse>(AMERICAS_BASE, `/lol/match/v5/matches/${matchId}`)
  const me = match.info.participants.find((p) => p.puuid === puuid)!
  return {
    matchId,
    champion: me.championName,
    win: me.win,
    kills: me.kills,
    deaths: me.deaths,
    assists: me.assists,
    queueType: queueTypeLabel(match.info.queueId),
    championImg: getChampionImageUrl(me.championName, ddVersion),
    fallback: buildChampionFallback(me.championName),
  }
}

export async function buildLeagueData(): Promise<LeagueData> {
  const summonerId = process.env.SUMMONER_ID!
  const [ddVersion, summoner] = await Promise.all([getDDVersion(), getSummonerData(summonerId)])

  const matchIds = await riotFetch<string[]>(
    AMERICAS_BASE,
    `/lol/match/v5/matches/by-puuid/${summoner.puuid}/ids?count=20`
  )

  const recentMatches = await Promise.all(
    matchIds.slice(0, 20).map((id) => getMatchDetails(id, summoner.puuid, ddVersion))
  )

  const displayMatches = recentMatches.slice(0, 4)

  // Compute per-champion stats from recent 20 matches
  const champStats: Record<string, { wins: number; games: number }> = {}
  for (const m of recentMatches) {
    if (!champStats[m.champion]) champStats[m.champion] = { wins: 0, games: 0 }
    champStats[m.champion].games++
    if (m.win) champStats[m.champion].wins++
  }

  const topChamps: ChampionStat[] = Object.entries(champStats)
    .sort((a, b) => b[1].games - a[1].games)
    .slice(0, 3)
    .map(([name, stats]) => ({
      name,
      games: stats.games,
      winrate: Math.round((stats.wins / stats.games) * 100),
      championImg: getChampionImageUrl(name, ddVersion),
      fallback: buildChampionFallback(name),
    }))

  const summonerName = summoner.name ?? 'Summoner'
  const [gameName, tagLine] = summonerName.includes('#')
    ? summonerName.split('#')
    : [summonerName, 'BR1']

  return {
    profile: {
      name: gameName,
      tag: `#${tagLine}`,
      level: summoner.summonerLevel,
      iconUrl: getProfileIconUrl(summoner.profileIconId, ddVersion),
      fallback: gameName.slice(0, 2).toUpperCase(),
    },
    matches: displayMatches,
    topChamps,
    ddVersion,
  }
}
