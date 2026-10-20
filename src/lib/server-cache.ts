import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { buildSteamData } from './steam'
import { buildLeagueData } from './league'
import type { SteamData, LeagueData } from '@/types'

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

const memory = new Map<string, Entry<unknown>>()

async function cached<T>(key: string, ttlMs: number, build: () => Promise<T>): Promise<T> {
  if (!memory.has(key)) {
    const saved = readDisk<T>(key)
    if (saved) memory.set(key, saved)
  }
  const entry = memory.get(key) as Entry<T> | undefined
  if (entry && Date.now() - entry.at < ttlMs) return entry.data

  try {
    const data = await build()
    if (data == null) throw new Error(`${key} fetch returned no data`)
    const fresh = { data, at: Date.now() }
    memory.set(key, fresh)
    writeDisk(key, fresh)
    return data
  } catch (err) {
    if (!entry) throw err
    console.error(`[server-cache] ${key} refetch failed, serving saved data`, err)
    return entry.data
  }
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
  if (!keepDisk) rmSync(cacheDir(), { recursive: true, force: true })
}
