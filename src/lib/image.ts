import sharp from 'sharp'

const ALLOWED_HOSTNAMES = [
  'cdn.cloudflare.steamstatic.com',
  'ddragon.leagueoflegends.com',
  'i.scdn.co',
  'mosaic.scdn.co',
  'community.cloudflare.steamstatic.com',
]

export function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const host = parsed.hostname
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.)/.test(host)) return false
    return ALLOWED_HOSTNAMES.includes(host)
  } catch {
    return false
  }
}

export async function fetchAndGrayscale(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl, {
    headers: { 'User-Agent': 'KindleDashboard/1.0' },
  })
  if (!response.ok) throw new Error(`Upstream fetch failed: ${response.status}`)
  const arrayBuffer = await response.arrayBuffer()
  return sharp(Buffer.from(arrayBuffer))
    .grayscale()
    .toBuffer()
}
