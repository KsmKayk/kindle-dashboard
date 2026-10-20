import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { buildSteamData } from './steam'
import { buildLeagueData } from './league'
import { getAccessToken, getCurrentlyPlaying, getLyrics } from './spotify'
import type { SteamData, LeagueData, SpotifyPlayback, SpotifyTrackInfo, LyricsData } from '@/types'

interface Entry<T> { data: T; at: number }

// Only successful fetches are saved, so a failed refetch (e.g. Riot 429) never
// replaces good data: the last saved entry is served until a fetch succeeds.
// Entries are also written to disk so they survive restarts and deploys.
function cacheDir() { return process.env.CACHE_DIR ?? '.cache' }

function readDisk<T>(key: string): Entry<T> | null {
  try {
    return JSON.parse(readFileSync(join(cacheDir(), `${key}.json`), 'utf8')) as Entry<T>
  } catch {
    return null
  }
}

function writeDisk<T>(key: string, entry: Entry<T>) {
  try {
    mkdirSync(cacheDir(), { recursive: true })
    writeFileSync(join(cacheDir(), `${key}.json`), JSON.stringify(entry))
  } catch (err) {
    console.error(`[server-cache] could not save ${key}`, err)
  }
}

// After a failed fetch, wait this long before calling the API again (Riot's
// rate-limit window is 2 minutes), instead of retrying on every request.
const FAILURE_COOLDOWN_MS = 120_000

const memory = new Map<string, Entry<unknown>>()
const inFlight = new Map<string, Promise<unknown>>()
const lastFailure = new Map<string, { error: unknown; at: number }>()

async function fetchAndSave<T>(key: string, build: () => Promise<T>): Promise<T> {
  try {
    const data = await build()
    if (data == null) throw new Error(`${key} fetch returned no data`)
    const fresh = { data, at: Date.now() }
    memory.set(key, fresh)
    writeDisk(key, fresh)
    lastFailure.delete(key)
    return data
  } catch (err) {
    lastFailure.set(key, { error: err, at: Date.now() })
    throw err
  }
}

async function cached<T>(key: string, ttlMs: number, build: () => Promise<T>): Promise<T> {
  const entry = savedEntry<T>(key)
  if (entry && Date.now() - entry.at < ttlMs) return entry.data

  const failure = lastFailure.get(key)
  if (failure && Date.now() - failure.at < FAILURE_COOLDOWN_MS) {
    if (entry) return entry.data
    throw failure.error
  }

  // Concurrent requests share one fetch instead of each calling the API.
  let pending = inFlight.get(key) as Promise<T> | undefined
  if (!pending) {
    pending = fetchAndSave(key, build).finally(() => inFlight.delete(key))
    inFlight.set(key, pending)
  }

  try {
    return await pending
  } catch (err) {
    if (!entry) throw err
    console.error(`[server-cache] ${key} refetch failed, serving saved data`, err)
    return entry.data
  }
}

function savedEntry<T>(key: string): Entry<T> | undefined {
  if (!memory.has(key)) {
    const saved = readDisk<T>(key)
    if (saved) memory.set(key, saved)
  }
  return memory.get(key) as Entry<T> | undefined
}

// The current track, or the last one played (isPlaying: false) when nothing is
// playing or Spotify is unreachable. Not TTL-cached: it should change with the track.
export async function getSpotifyNowOrLast(): Promise<SpotifyPlayback | null> {
  const saved = savedEntry<SpotifyPlayback>('spotify')
  const last = saved ? { ...saved.data, isPlaying: false } : null
  try {
    const playback = await getCurrentlyPlaying(await getAccessToken())
    if (!playback.track) return last
    const fresh = { data: playback, at: Date.now() }
    memory.set('spotify', fresh)
    writeDisk('spotify', fresh)
    return playback
  } catch (err) {
    console.error('[server-cache] spotify fetch failed, serving last track', err)
    return last
  }
}

// Lyrics of the last track asked for: the /kindle/spotify page reloads every few
// seconds and must not hit LRCLIB each time. Lookup errors are not stored, so the
// next reload retries.
let lastLyrics: { trackId: string; data: LyricsData | null } | null = null

export async function getCachedLyrics(track: SpotifyTrackInfo): Promise<LyricsData | null> {
  if (lastLyrics?.trackId === track.id) return lastLyrics.data
  const data = await getLyrics(track.title, track.artist, track.album, track.durationMs)
  lastLyrics = { trackId: track.id, data }
  return data
}

function steamTtlMs() { return parseInt(process.env.STEAM_UPDATE_RATE ?? '60', 10) * 1000 }
function leagueTtlMs() { return parseInt(process.env.LEAGUE_UPDATE_RATE ?? '600', 10) * 1000 }

export function getCachedSteamData(): Promise<SteamData> {
  return cached('steam', steamTtlMs(), buildSteamData)
}

export function getCachedLeagueData(): Promise<LeagueData> {
  return cached('league', leagueTtlMs(), buildLeagueData)
}

export function resetCacheForTest({ keepDisk = false } = {}) {
  memory.clear()
  inFlight.clear()
  lastFailure.clear()
  lastLyrics = null
  if (!keepDisk) rmSync(cacheDir(), { recursive: true, force: true })
}
