export interface SteamPlayer {
  steamid: string
  personaname: string
  personastate: number
  gameid?: string
  gameextrainfo?: string
}

export interface SteamGame {
  appid: number
  name: string
  playtime_forever: number
  playtime_2weeks?: number
}

export interface SteamNowPlaying {
  name: string
  appid: string
  headerImg: string
  fallback: string
}

export interface SteamLastPlayed {
  name: string
  appid: number
  headerImg: string
  fallback: string
  playedAt: number // unix seconds, from GetOwnedGames rtime_last_played
}

export interface SteamTopGame {
  name: string
  appid: number
  hours: number
  coverImg: string
  fallback: string
}

export interface SteamData {
  nowPlaying: SteamNowPlaying | null
  lastPlayed: SteamLastPlayed | null
  topGames: SteamTopGame[]
  totalGames: number
  isOnline: boolean
  personaname: string
}
