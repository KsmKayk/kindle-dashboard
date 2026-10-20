import { getAccessToken, controlPlayback, SpotifyControlError } from '@/lib/spotify'
import { parseRefreshSeconds } from '@/lib/kindle-spotify-render'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ACTIONS = ['play', 'pause', 'next', 'previous'] as const
type Action = (typeof ACTIONS)[number]

// Spotify applies a command asynchronously; wait before the page reloads so it
// shows the new state instead of the old one.
const SETTLE_MS = 700

// Target of the /kindle/spotify button forms. Answers with a 303 back to the
// player (relative Location: request.url is the internal address behind the proxy).
export async function POST(request: Request): Promise<Response> {
  const form = await request.formData()
  const action = String(form.get('action') ?? '')
  const params = new URLSearchParams({ r: String(parseRefreshSeconds(String(form.get('r') ?? ''))) })
  // Keep the access token on the way back (the Kindle browser may not keep cookies)
  const token = new URL(request.url).searchParams.get('token')
  if (token) params.set('token', token)

  if (!ACTIONS.includes(action as Action)) {
    params.set('error', 'Invalid action')
  } else {
    try {
      await controlPlayback(action as Action, await getAccessToken())
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
    } catch (err) {
      console.error('[kindle/spotify/control]', err)
      params.set('error', err instanceof SpotifyControlError ? err.message : 'Playback control failed')
    }
  }

  return new Response(null, { status: 303, headers: { Location: `/kindle/spotify?${params}` } })
}
