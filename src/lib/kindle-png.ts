// Helpers shared by the /api/kindle/*.png routes the KOReader plugin downloads.

export interface ImageSize { width: number; height: number }

// Kindle screen below the plugin's tab bar
export const DEFAULT_IMAGE_SIZE: ImageSize = { width: 600, height: 744 }

function dimension(value: string | null, fallback: number): number {
  const n = parseInt(value ?? '', 10)
  return Number.isFinite(n) ? Math.min(2000, Math.max(200, n)) : fallback
}

// ?w= and ?h= size the image to the area the plugin has free
export function imageSizeFrom(params: URLSearchParams): ImageSize {
  return {
    width: dimension(params.get('w'), DEFAULT_IMAGE_SIZE.width),
    height: dimension(params.get('h'), DEFAULT_IMAGE_SIZE.height),
  }
}

export async function pngResponse(tag: string, render: () => Promise<Buffer>): Promise<Response> {
  try {
    const png = await render()
    return new Response(new Uint8Array(png), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error(`[${tag}]`, err)
    return Response.json({ error: 'Failed to render image' }, { status: 500 })
  }
}
