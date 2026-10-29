import { checkAccess } from './access-token'
import { loadEntry, saveEntry } from './server-cache'
import type { ClaudeReport, ServerReport, StoredClaude, StoredServer } from '@/types'

// Reports pushed to POST /api/claude/report (claude-reporter/) and
// POST /api/servers/report (server-agent/), authenticated with REPORT_TOKEN.

const MAX_BODY_CHARS = 512 * 1024
const CLAUDE_KEY = 'report-claude'
const SERVERS_KEY = 'report-servers'

export async function handleReport<T>(
  request: Request,
  validate: (body: unknown) => body is T,
  save: (report: T) => void
): Promise<Response> {
  const token = process.env.REPORT_TOKEN || null
  if (!token) return Response.json({ error: 'REPORT_TOKEN is not set on the server' }, { status: 503 })
  const access = checkAccess({ authorization: request.headers.get('authorization'), query: null, cookie: null }, token)
  if (access !== 'header') return Response.json({ error: 'Invalid report token' }, { status: 401 })

  const text = await request.text()
  if (text.length > MAX_BODY_CHARS) return Response.json({ error: 'Report too large' }, { status: 413 })
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!validate(body)) return Response.json({ error: 'Invalid report' }, { status: 400 })
  save(body)
  return Response.json({ ok: true })
}

// ── validation ────────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isNumOrNull = (v: unknown) => v === null || isNum(v)
const isStr = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length <= max
const isList = (v: unknown, max: number, each: (item: unknown) => boolean) => Array.isArray(v) && v.length <= max && v.every(each)
const isCounts = (v: unknown) => isObj(v) && Object.keys(v).length <= 200 && Object.values(v).every(isNum)

const isLimit = (v: unknown) => v === null || (isObj(v) && isNum(v.utilization) && isStr(v.resetsAt))

const isDay = (v: unknown) =>
  isObj(v) && isStr(v.date) && /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
  isNum(v.input) && isNum(v.output) && isNum(v.cacheWrite) && isNum(v.cacheRead) &&
  isCounts(v.byModel) && isCounts(v.byProject)

export function isClaudeReport(v: unknown): v is ClaudeReport {
  return isObj(v) &&
    (v.limits === null || (isObj(v.limits) && isLimit(v.limits.fiveHour) && isLimit(v.limits.sevenDay) && isStr(v.limits.at))) &&
    isList(v.days, 60, isDay)
}

const isDisk = (v: unknown) =>
  isObj(v) && isStr(v.device, 40) && (v.healthy === null || typeof v.healthy === 'boolean') &&
  isNumOrNull(v.tempC) && isNumOrNull(v.reallocated) && isNumOrNull(v.pending)

const isRaid = (v: unknown) =>
  v === null || (isObj(v) && isStr(v.device, 40) && isStr(v.level, 20) && isStr(v.state, 40) &&
    isNum(v.active) && isNum(v.total) && isList(v.members, 32, (m) => isStr(m, 40)) && isNumOrNull(v.syncPct))

const isMount = (v: unknown) =>
  isObj(v) && isStr(v.path) && isStr(v.device, 80) && isNum(v.totalBytes) && isNum(v.usedBytes) &&
  isRaid(v.raid) && isList(v.disks, 32, isDisk)

const isContainer = (v: unknown) =>
  isObj(v) && isStr(v.name) && isStr(v.state, 40) && isStr(v.status) && isList(v.ports, 64, isNum)

export function isServerReport(v: unknown): v is ServerReport {
  return isObj(v) && isStr(v.id, 40) && /^[a-z0-9-]+$/.test(v.id) && isStr(v.name, 60) && isNum(v.order) &&
    isStr(v.hostname) && isStr(v.arch, 20) && isNum(v.uptimeSec) &&
    isObj(v.cpu) && isNum(v.cpu.pct) && isNum(v.cpu.cores) && isNum(v.cpu.load1) && isNumOrNull(v.cpu.tempC) &&
    isObj(v.mem) && isNum(v.mem.totalBytes) && isNum(v.mem.usedBytes) &&
    isObj(v.net) && isNum(v.net.rxBps) && isNum(v.net.txBps) &&
    isList(v.mounts, 16, isMount) && isList(v.containers, 100, isContainer)
}

// ── storage ───────────────────────────────────────────────────────────────────

// A report without limits (usage endpoint unreadable) keeps the previous ones
export function saveClaudeReport(report: ClaudeReport) {
  const previous = loadEntry<Omit<StoredClaude, 'receivedAt'>>(CLAUDE_KEY)
  saveEntry(CLAUDE_KEY, { limits: report.limits ?? previous?.data.limits ?? null, days: report.days })
}

export function getClaudeReport(): StoredClaude | null {
  const entry = loadEntry<Omit<StoredClaude, 'receivedAt'>>(CLAUDE_KEY)
  return entry ? { ...entry.data, receivedAt: entry.at } : null
}

export function saveServerReport(report: ServerReport) {
  const servers = loadEntry<Record<string, StoredServer>>(SERVERS_KEY)?.data ?? {}
  saveEntry(SERVERS_KEY, { ...servers, [report.id]: { report, receivedAt: Date.now() } })
}

export function getServerReports(): StoredServer[] {
  const servers = loadEntry<Record<string, StoredServer>>(SERVERS_KEY)?.data ?? {}
  return Object.values(servers).sort((a, b) => a.report.order - b.report.order || a.report.name.localeCompare(b.report.name))
}
