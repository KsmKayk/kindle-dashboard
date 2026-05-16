import { NextResponse } from 'next/server'
import { getAccessToken, getCurrentlyPlaying } from '@/lib/spotify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const token = await getAccessToken()
    const data = await getCurrentlyPlaying(token)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/spotify]', err)
    return NextResponse.json({ isPlaying: false, track: null })
  }
}
