import { handleReport, isClaudeReport, saveClaudeReport } from '@/lib/reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Claude usage pushed by claude-reporter/ from the PC that runs Claude Code
export function POST(request: Request): Promise<Response> {
  return handleReport(request, isClaudeReport, saveClaudeReport)
}
