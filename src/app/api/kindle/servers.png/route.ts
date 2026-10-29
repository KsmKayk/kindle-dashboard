import { getCachedHealth } from '@/lib/server-cache'
import { getServerReports } from '@/lib/reports'
import { renderServersPng } from '@/lib/servers-image'
import { imageSizeFrom, pngResponse } from '@/lib/kindle-png'
import type { HealthResult } from '@/lib/healthcheck'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Servers tab (server-agent reports + site health checks) as a grayscale PNG
export async function GET(request: Request): Promise<Response> {
  const size = imageSizeFrom(new URL(request.url).searchParams)
  const health = await getCachedHealth().catch((err): HealthResult[] => {
    console.error('[api/kindle/servers.png] health checks', err)
    return []
  })
  return pngResponse('api/kindle/servers.png', () => renderServersPng(getServerReports(), health, size))
}
