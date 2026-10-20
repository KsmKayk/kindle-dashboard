import { NextResponse } from 'next/server'
import { getCachedLeagueData } from '@/lib/server-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getCachedLeagueData()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/league]', err)
    return NextResponse.json({ error: 'League API unavailable' }, { status: 502 })
  }
}
