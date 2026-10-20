import { NextRequest, NextResponse } from 'next/server'
import { getLyrics } from '@/lib/spotify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title') ?? ''
  const artist = request.nextUrl.searchParams.get('artist') ?? ''
  const album = request.nextUrl.searchParams.get('album') ?? ''
  const durationMs = Number(request.nextUrl.searchParams.get('durationMs')) || undefined

  if (!title || !artist) {
    return NextResponse.json({ error: 'title and artist required' }, { status: 400 })
  }

  try {
    const data = await getLyrics(title, artist, album, durationMs)
    if (!data) return NextResponse.json(null)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    })
  } catch (err) {
    console.error('[api/spotify/lyrics]', err)
    // 503 tells the player to retry; a 200 null means the track has no lyrics
    return NextResponse.json(null, { status: 503 })
  }
}
