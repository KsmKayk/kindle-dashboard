import { NextResponse } from 'next/server'
import { buildSteamData } from '@/lib/steam'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await buildSteamData()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/steam]', err)
    return NextResponse.json({ error: 'Steam API unavailable' }, { status: 502 })
  }
}
