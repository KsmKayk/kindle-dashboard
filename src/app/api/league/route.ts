import { NextResponse } from 'next/server'
import { buildLeagueData } from '@/lib/league'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await buildLeagueData()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/league]', err)
    return NextResponse.json({ error: 'League API unavailable' }, { status: 502 })
  }
}
