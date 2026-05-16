export interface SummonerProfile {
  id: string
  accountId: string
  puuid: string
  name: string
  profileIconId: number
  summonerLevel: number
}

export interface MatchResult {
  matchId: string
  champion: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  queueType: string
  championImg: string
  fallback: string
}

export interface ChampionStat {
  name: string
  games: number
  winrate: number
  championImg: string
  fallback: string
}

export interface LeagueData {
  profile: {
    name: string
    tag: string
    level: number
    iconUrl: string
    fallback: string
  }
  matches: MatchResult[]
  topChamps: ChampionStat[]
  ddVersion: string
}
