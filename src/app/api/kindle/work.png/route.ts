import { getCachedGithubStats } from '@/lib/server-cache'
import { getClaudeReport } from '@/lib/reports'
import { summarizeClaude } from '@/lib/claude-summary'
import { renderWorkPng } from '@/lib/work-image'
import { imageSizeFrom, pngResponse } from '@/lib/kindle-png'
import type { GithubStats } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Work tab (GitHub + Claude) as a grayscale PNG for the KOReader plugin.
export async function GET(request: Request): Promise<Response> {
  const size = imageSizeFrom(new URL(request.url).searchParams)
  const github = await getCachedGithubStats().catch((err): GithubStats | null => {
    console.error('[api/kindle/work.png] github', err)
    return null
  })
  const stored = getClaudeReport()
  const claude = stored ? summarizeClaude(stored, new Date()) : null
  return pngResponse('api/kindle/work.png', () => renderWorkPng(github, claude, size))
}
