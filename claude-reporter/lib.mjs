// Pure helpers of the Claude reporter: reading Claude Code's JSONL logs into
// per-day token totals, and mapping the /usage endpoint. See report.mjs.

import { closeSync, existsSync, openSync, readdirSync, readSync, statSync } from 'node:fs'
import { join } from 'node:path'

const KEEP_DAYS = 35
const CHUNK_BYTES = 16 * 1024 * 1024

// The server rejects negative or non-finite numbers, so bad log values count as 0
const count = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

const pad = (n) => String(n).padStart(2, '0')

export function localDay(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// One assistant message's usage, or null for any other line
export function usageFromLine(text) {
  let entry
  try {
    entry = JSON.parse(text)
  } catch {
    return null
  }
  const when = new Date(entry?.timestamp)
  if (Number.isNaN(when.getTime())) return null
  const message = entry?.message
  const usage = message?.usage
  if (entry?.type !== 'assistant' || !usage || !message.id || !message.model || message.model === '<synthetic>') return null
  return {
    key: `${message.id}:${entry.requestId ?? ''}`,
    date: localDay(when),
    model: message.model,
    project: String(entry.cwd ?? 'unknown').split(/[\\/]/).filter(Boolean).pop() ?? 'unknown',
    input: count(usage.input_tokens),
    output: count(usage.output_tokens),
    cacheWrite: count(usage.cache_creation_input_tokens),
    cacheRead: count(usage.cache_read_input_tokens),
  }
}

// files: byte offset read so far per log file; seen: message key → date
export function emptyState() {
  return { files: {}, seen: {}, days: {} }
}

// A state.json of the wrong shape falls back to the empty parts
export function normalizeState(raw) {
  const state = emptyState()
  const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
  for (const key of Object.keys(state)) if (isObj(raw?.[key])) state[key] = raw[key]
  return state
}

export function addUsage(state, u) {
  if (!u || state.seen[u.key]) return
  state.seen[u.key] = u.date
  const day = (state.days[u.date] ??= { date: u.date, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, byModel: {}, byProject: {} })
  const total = u.input + u.output + u.cacheWrite + u.cacheRead
  day.input += u.input
  day.output += u.output
  day.cacheWrite += u.cacheWrite
  day.cacheRead += u.cacheRead
  day.byModel[u.model] = (day.byModel[u.model] ?? 0) + total
  day.byProject[u.project] = (day.byProject[u.project] ?? 0) + total
}

export function pruneState(state, now) {
  const oldest = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - KEEP_DAYS))
  for (const date of Object.keys(state.days)) if (date < oldest) delete state.days[date]
  for (const [key, date] of Object.entries(state.seen)) if (date < oldest) delete state.seen[key]
}

// Splits a chunk into complete lines; `consumed` is the byte count up to the
// last newline, so a line still being written is read again next run
export function completeLines(buffer) {
  const end = buffer.lastIndexOf(0x0a)
  if (end < 0) return { lines: [], consumed: 0 }
  return { lines: buffer.subarray(0, end).toString('utf8').split('\n').filter(Boolean), consumed: end + 1 }
}

// The server accepts at most 200 keys per record: keep the biggest, fold the rest into "other"
const MAX_KEYS = 100

function capRecord(record) {
  const entries = Object.entries(record).sort((a, b) => b[1] - a[1])
  if (entries.length <= MAX_KEYS) return record
  const kept = Object.fromEntries(entries.slice(0, MAX_KEYS - 1))
  kept.other = (kept.other ?? 0) + entries.slice(MAX_KEYS - 1).reduce((sum, [, v]) => sum + v, 0)
  return kept
}

export function daysForReport(state) {
  return Object.values(state.days)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({ ...day, byModel: capRecord(day.byModel), byProject: capRecord(day.byProject) }))
}

// null unless it is what the server's validator accepts; resets_at is null while no session is active
const limit = (v) => {
  if (!v || typeof v.utilization !== 'number' || !(v.utilization >= 0)) return null
  if (v.resets_at === null || v.resets_at === undefined) return { utilization: v.utilization, resetsAt: null }
  return typeof v.resets_at === 'string' && !Number.isNaN(Date.parse(v.resets_at)) ? { utilization: v.utilization, resetsAt: v.resets_at } : null
}

// null when neither limit could be read (endpoint changed): the server then keeps the previous ones
export function limitsFromUsage(body, now) {
  const fiveHour = limit(body?.five_hour)
  const sevenDay = limit(body?.seven_day)
  return fiveHour || sevenDay ? { fiveHour, sevenDay, at: now.toISOString() } : null
}

// An unreadable subfolder is logged and skipped; failing to list the top folder throws
function logFiles(dir, log, top = true) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (err) {
    if (top) throw err
    log(`${dir}: ${err.message}`)
    return []
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return logFiles(path, log, false)
    return entry.name.endsWith('.jsonl') ? [path] : []
  })
}

// Reads what was appended to one log since `offset`, in chunks; returns the new offset
function scanFile(state, file) {
  const size = statSync(file).size
  let offset = state.files[file] ?? 0
  if (size < offset) offset = 0  // file was rewritten: read it again (seen keys prevent double counts)
  if (offset >= size) return  // nothing new: do not even open it
  const fd = openSync(file, 'r')
  try {
    while (offset < size) {
      const buffer = Buffer.alloc(Math.min(CHUNK_BYTES, size - offset))
      const bytesRead = readSync(fd, buffer, 0, buffer.length, offset)
      if (bytesRead === 0) break
      const { lines, consumed } = completeLines(buffer.subarray(0, bytesRead))
      for (const line of lines) addUsage(state, usageFromLine(line))
      if (consumed === 0) {
        if (offset + bytesRead >= size) break  // partial last line: wait for the rest
        offset += bytesRead  // a line bigger than one chunk (16 MB) is dropped, not counted
      } else {
        offset += consumed
      }
      state.files[file] = offset
    }
  } finally {
    closeSync(fd)
  }
  state.files[file] = offset
}

// Adds the usage in every .jsonl under projectsDir to state. One unreadable log is
// reported through `log` and skipped; logs that no longer exist are forgotten.
export function scanLogs(state, projectsDir, log = console.error) {
  let files = []
  let listed = true
  if (existsSync(projectsDir)) {
    try {
      files = logFiles(projectsDir, log)
    } catch (err) {
      listed = false
      log(`${projectsDir}: ${err.message}`)
    }
  }
  const present = new Set(files)
  if (listed) for (const file of Object.keys(state.files)) if (!present.has(file)) delete state.files[file]
  for (const file of files) {
    try {
      scanFile(state, file)
    } catch (err) {
      log(`${file}: ${err.message}`)
    }
  }
}
