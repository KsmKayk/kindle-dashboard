// Sends Claude usage to the kindle-dashboard server (POST /api/claude/report):
// the 5-hour and weekly limits from the endpoint Claude Code uses for /usage,
// and per-day token totals from Claude Code's logs (~/.claude/projects).
// Run every 5 minutes by Task Scheduler (install.ps1). Never refreshes the
// login token: that would rotate it and could sign Claude Code out.

import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { daysForReport, limitsFromUsage, normalizeState, pruneState, scanLogs } from './lib.mjs'

const here = new URL('.', import.meta.url)
const statePath = new URL('state.json', here)

function fail(message) {
  console.error(message)
  process.exit(1)
}

function loadConfig() {
  let config
  try {
    config = JSON.parse(readFileSync(new URL('config.json', here), 'utf8'))
  } catch (err) {
    fail(`config.json unreadable (copy config.example.json): ${err.message}`)
  }
  if (typeof config?.dashboardUrl !== 'string' || !config.dashboardUrl) fail('config.json: dashboardUrl is missing')
  if (typeof config.reportToken !== 'string' || !config.reportToken) fail('config.json: reportToken is missing')
  return config
}

function loadState() {
  try {
    return normalizeState(JSON.parse(readFileSync(statePath, 'utf8')))
  } catch {
    return normalizeState(null)
  }
}

// Written to a temp file and renamed, so a crash never leaves a half-written state.json
function saveState(state) {
  const tmp = new URL('state.json.tmp', here)
  writeFileSync(tmp, JSON.stringify(state))
  renameSync(tmp, statePath)
}

const config = loadConfig()
const claudeDir = config.claudeDir ?? join(homedir(), '.claude')

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
scanLogs(state, join(claudeDir, 'projects'))
pruneState(state, new Date())
// Saved before sending: totals are re-sent in full next time if this send fails
saveState(state)

const report = { limits: await readLimits(), days: daysForReport(state) }
// exitCode instead of process.exit: exiting with a request still closing aborts node on Windows
let sent = false
try {
  const res = await fetch(`${config.dashboardUrl.replace(/\/+$/, '')}/api/claude/report`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.reportToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
    signal: AbortSignal.timeout(15_000),
  })
  if (res.ok) sent = true
  else console.error(`dashboard answered ${res.status}: ${await res.text()}`)
} catch (err) {
  console.error(`could not reach the dashboard: ${err.message}`)
}
if (sent) console.log(`${new Date().toISOString()} sent ${report.days.length} days, limits ${report.limits ? 'ok' : 'missing'}`)
else process.exitCode = 1
