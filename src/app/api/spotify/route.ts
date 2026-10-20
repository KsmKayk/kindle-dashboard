import { NextResponse } from 'next/server'
import { getSpotifyNowOrLast } from '@/lib/server-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The current track, or the last played one (isPlaying: false) when nothing is playing
export async function GET() {
  const playback = await getSpotifyNowOrLast()
  return NextResponse.json(playback ?? { isPlaying: false, track: null })
}
