import { getCachedSteamData, getCachedLeagueData } from '@/lib/server-cache'
import { renderDashboardPng } from '@/lib/dashboard-image'
import { imageSizeFrom, pngResponse } from '@/lib/kindle-png'
import type { SteamData, LeagueData } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Steam + League dashboard as a grayscale PNG for the KOReader plugin.
export async function GET(request: Request): Promise<Response> {
  const size = imageSizeFrom(new URL(request.url).searchParams)
  const [steam, league] = await Promise.all([
    getCachedSteamData().catch((): SteamData | null => null),
    getCachedLeagueData().catch((): LeagueData | null => null),
  ])
  return pngResponse('api/kindle/dashboard.png', () => renderDashboardPng(steam, league, size))
}
