/**
 * @jest-environment node
 */

import { GET } from '@/app/kindle/spotify/route'
import { POST } from '@/app/kindle/spotify/control/route'
import { getSpotifyNowOrLast, getCachedLyrics } from '@/lib/server-cache'
import { getAccessToken, controlPlayback, SpotifyControlError } from '@/lib/spotify'

jest.mock('@/lib/server-cache')
jest.mock('@/lib/spotify', () => ({
  ...jest.requireActual('@/lib/spotify'),
  getAccessToken: jest.fn(),
  controlPlayback: jest.fn(),
}))

const mockNowOrLast = getSpotifyNowOrLast as jest.MockedFunction<typeof getSpotifyNowOrLast>
const mockLyrics = getCachedLyrics as jest.MockedFunction<typeof getCachedLyrics>
const mockToken = getAccessToken as jest.MockedFunction<typeof getAccessToken>
const mockControl = controlPlayback as jest.MockedFunction<typeof controlPlayback>

const track = {
  title: 'Song', artist: 'Artist', album: 'Album', durationMs: 200000, progressMs: 1000,
  coverUrl: null, fallback: 'ARTIST', id: 't1',
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
  mockNowOrLast.mockResolvedValue({ isPlaying: true, track })
  mockLyrics.mockResolvedValue({ synced: [{ time: 0, text: 'First line' }], plain: [] })
  mockToken.mockResolvedValue('token')
  mockControl.mockReset().mockResolvedValue(undefined)
})

afterEach(() => jest.useRealTimers())

describe('GET /kindle/spotify', () => {
  it('renders the player with lyrics and the requested interval', async () => {
    const res = await GET(new Request('http://localhost:3000/kindle/spotify?r=8'))
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('First line')
    expect(html).toContain('content="8"')
  })

  it('still renders when the lyrics lookup fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockLyrics.mockRejectedValue(new Error('LRCLIB unavailable: 503'))
    const res = await GET(new Request('http://localhost:3000/kindle/spotify'))
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('No lyrics available')
  })
})

describe('POST /kindle/spotify/control', () => {
  async function post(fields: Record<string, string>) {
    const request = new Request('http://localhost:3000/kindle/spotify/control', {
      method: 'POST',
      body: new URLSearchParams(fields),
    })
    const pending = POST(request)
    await jest.runAllTimersAsync()
    return pending
  }

  it('sends the command and redirects back to the player', async () => {
    const res = await post({ action: 'next', r: '10' })
    expect(mockControl).toHaveBeenCalledWith('next', 'token')
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/kindle/spotify?r=10')
  })

  it('keeps the access token in the redirect', async () => {
    const request = new Request('http://localhost:3000/kindle/spotify/control?token=s3cret', {
      method: 'POST',
      body: new URLSearchParams({ action: 'next', r: '5' }),
    })
    const pending = POST(request)
    await jest.runAllTimersAsync()
    expect((await pending).headers.get('location')).toBe('/kindle/spotify?r=5&token=s3cret')
  })

  it('passes the Spotify error to the page', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockControl.mockRejectedValue(new SpotifyControlError(404))
    const res = await post({ action: 'play' })
    const location = new URL(res.headers.get('location')!, 'http://x')
    expect(location.searchParams.get('error')).toContain('No active Spotify device')
  })

  it('rejects unknown actions', async () => {
    const res = await post({ action: 'shuffle' })
    expect(mockControl).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toContain('error=Invalid')
  })
})
