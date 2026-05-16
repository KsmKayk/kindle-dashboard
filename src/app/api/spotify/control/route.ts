import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken, controlPlayback } from '@/lib/spotify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json() as { action: string }
  const action = body.action

  if (!['play', 'pause', 'next', 'previous'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  try {
    const token = await getAccessToken()
    await controlPlayback(action as 'play' | 'pause' | 'next' | 'previous', token)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/spotify/control]', err)
    return NextResponse.json({ error: 'Playback control failed' }, { status: 502 })
  }
}
