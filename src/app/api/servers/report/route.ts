import { handleReport, isServerReport, saveServerReport } from '@/lib/reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Server status pushed by server-agent/ every minute
export function POST(request: Request): Promise<Response> {
  return handleReport(request, isServerReport, saveServerReport)
}
