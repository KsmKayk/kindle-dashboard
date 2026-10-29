// Sends Claude usage to the kindle-dashboard server (POST /api/claude/report):
// the 5-hour and weekly limits from the endpoint Claude Code uses for /usage,
// and per-day token totals from Claude Code's logs (~/.claude/projects).
// Run every 5 minutes by Task Scheduler (install.ps1). Never refreshes the
// login token: that would rotate it and could sign Claude Code out.

import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { addUsage, completeLines, daysForReport, emptyState, limitsFromUsage, pruneState, usageFromLine } from './lib.mjs'

const here = new URL('.', import.meta.url)
const config = JSON.parse(readFileSync(new URL('config.json', here), 'utf8'))
const statePath = new URL('state.json', here)
const claudeDir = config.claudeDir ?? join(homedir(), '.claude')

function loadState() {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'))
  } catch {
    return emptyState()
  }
}

function logFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return logFiles(path)
    return entry.name.endsWith('.jsonl') ? [path] : []
  })
}

// Reads what was appended to each log since the last run
function scanLogs(state) {
  for (const file of logFiles(join(claudeDir, 'projects'))) {
    const size = statSync(file).size
    let offset = state.files[file] ?? 0
    if (size < offset) offset = 0  // file was rewritten: read it again (seen keys prevent double counts)
    if (size === offset) continue
    const buffer = Buffer.alloc(size - offset)
    const fd = openSync(file, 'r')
    try {
      readSync(fd, buffer, 0, buffer.length, offset)
    } finally {
      closeSync(fd)
    }
    const { lines, consumed } = completeLines(buffer)
    for (const line of lines) addUsage(state, usageFromLine(line))
    state.files[file] = offset + consumed
  }
}

async function readLimits() {
  try {
    const credentials = JSON.parse(readFileSync(join(claudeDir, '.credentials.json'), 'utf8'))
    const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: { Authorization: `Bearer ${credentials.claudeAiOauth.accessToken}`, 'anthropic-beta': 'oauth-2025-04-20' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`usage endpoint answered ${res.status}`)
    return limitsFromUsage(await res.json(), new Date())
  } catch (err) {
    console.error('limits unavailable:', err.message)
    return null
  }
}

const state = loadState()
scanLogs(state)
pruneState(state, new Date())
// Saved before sending: totals are re-sent in full next time if this send fails
writeFileSync(statePath, JSON.stringify(state))

const report = { limits: await readLimits(), days: daysForReport(state) }
const res = await fetch(`${config.dashboardUrl.replace(/\/+$/, '')}/api/claude/report`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${config.reportToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(report),
  signal: AbortSignal.timeout(15_000),
})
if (!res.ok) {
  console.error(`dashboard answered ${res.status}: ${await res.text()}`)
  process.exit(1)
}
console.log(`${new Date().toISOString()} sent ${report.days.length} days, limits ${report.limits ? 'ok' : 'missing'}`)
