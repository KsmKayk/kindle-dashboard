import { getCachedSteamData, getCachedLeagueData } from '@/lib/server-cache'
import { getAccessToken, getCurrentlyPlaying } from '@/lib/spotify'
import { renderKindlePage } from '@/lib/kindle-render'
import type { SteamData, LeagueData, SpotifyPlayback } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  const { origin } = new URL(request.url)

  const [steam, league] = await Promise.all([
    getCachedSteamData().catch((): SteamData | null => null),
    getCachedLeagueData().catch((): LeagueData | null => null),
  ])

  let spotify: SpotifyPlayback | null = null
  try {
    const token = await getAccessToken()
    spotify = await getCurrentlyPlaying(token)
  } catch {
    // Spotify not configured or unavailable — omit section
  }

  const html = renderKindlePage(steam, league, spotify, origin)

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
