import { getCachedSteamData, getCachedLeagueData } from '@/lib/server-cache'
import { renderDashboardPng, DEFAULT_IMAGE_SIZE } from '@/lib/dashboard-image'
import type { SteamData, LeagueData } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function dimension(value: string | null, fallback: number): number {
  const n = parseInt(value ?? '', 10)
  return Number.isFinite(n) ? Math.min(2000, Math.max(200, n)) : fallback
}

// Steam + League dashboard as a grayscale PNG for the KOReader plugin.
// ?w= and ?h= size it to the area the plugin has free below its tab bar.
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const size = {
    width: dimension(searchParams.get('w'), DEFAULT_IMAGE_SIZE.width),
    height: dimension(searchParams.get('h'), DEFAULT_IMAGE_SIZE.height),
  }

  const [steam, league] = await Promise.all([
    getCachedSteamData().catch((): SteamData | null => null),
    getCachedLeagueData().catch((): LeagueData | null => null),
  ])

  try {
    const png = await renderDashboardPng(steam, league, size)
    return new Response(new Uint8Array(png), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[api/kindle/dashboard.png]', err)
    return Response.json({ error: 'Failed to render dashboard' }, { status: 500 })
  }
}
