import { NextRequest, NextResponse } from 'next/server'
import { getLyrics } from '@/lib/spotify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title') ?? ''
  const artist = request.nextUrl.searchParams.get('artist') ?? ''
  const album = request.nextUrl.searchParams.get('album') ?? ''

  if (!title || !artist) {
    return NextResponse.json({ error: 'title and artist required' }, { status: 400 })
  }

  try {
    const data = await getLyrics(title, artist, album)
    if (!data) return NextResponse.json(null)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    })
  } catch (err) {
    console.error('[api/spotify/lyrics]', err)
    return NextResponse.json(null)
  }
}
