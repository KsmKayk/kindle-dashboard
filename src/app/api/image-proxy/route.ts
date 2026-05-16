import { NextRequest, NextResponse } from 'next/server'
import { fetchAndGrayscale, isAllowedImageUrl } from '@/lib/image'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }
  if (!isAllowedImageUrl(url)) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 400 })
  }
  try {
    const buffer = await fetchAndGrayscale(url)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    })
  } catch (err) {
    console.error('[image-proxy]', err)
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 })
  }
}
