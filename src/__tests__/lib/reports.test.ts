/**
 * @jest-environment node
 */

import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { handleReport, isClaudeReport, isServerReport, saveClaudeReport, getClaudeReport, saveServerReport, getServerReports } from '@/lib/reports'
import { resetCacheForTest } from '@/lib/server-cache'
import type { ClaudeReport, ServerReport } from '@/types'

jest.mock('@/lib/steam')
jest.mock('@/lib/league')
jest.mock('@/lib/spotify')
jest.mock('@/lib/github')

const day = { date: '2026-10-29', input: 1, output: 2, cacheWrite: 3, cacheRead: 4, byModel: { 'claude-opus-5-5': 10 }, byProject: { 'kindle-dashboard': 10 } }
const limits = { fiveHour: { utilization: 42, resetsAt: '2026-10-29T19:40:00Z' }, sevenDay: { utilization: 61, resetsAt: '2026-11-05T06:59:59Z' }, at: '2026-10-29T17:52:00Z' }
const claude: ClaudeReport = { limits, days: [day] }

const server: ServerReport = {
  id: 'kayk-server', name: 'kayk-server', order: 2, hostname: 'kayk-server', arch: 'x64', uptimeSec: 1000,
  cpu: { pct: 23, cores: 4, load1: 0.5, tempC: 52 },
  mem: { totalBytes: 6e9, usedBytes: 2.4e9 },
  net: { rxBps: 3e6, txBps: 2e5 },
  mounts: [{
    path: '/mnt/raid1', device: 'md0', totalBytes: 1.8e12, usedBytes: 3.7e11,
    raid: { device: 'md0', level: 'RAID 1', state: 'UU', active: 2, total: 2, members: ['sdb1', 'sdc1'], syncPct: null },
    disks: [{ device: 'sdb', healthy: true, tempC: 35, reallocated: 0, pending: 0 }],
  }],
  containers: [{ name: 'jellyfin', state: 'running', status: 'Up 3 days', ports: [8096] }],
}

const post = (body: unknown, token = 'r3port') =>
  new Request('http://localhost/api/x/report', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

beforeEach(() => {
  process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'reports-'))
  process.env.REPORT_TOKEN = 'r3port'
  resetCacheForTest()
})

afterAll(() => { delete process.env.REPORT_TOKEN })

describe('validation', () => {
  it('accepts well-formed reports', () => {
    expect(isClaudeReport(claude)).toBe(true)
    expect(isClaudeReport({ limits: null, days: [] })).toBe(true)
    expect(isServerReport(server)).toBe(true)
  })

  it('rejects malformed reports', () => {
    expect(isClaudeReport({ limits: null, days: [{ ...day, date: '29/10' }] })).toBe(false)
    expect(isClaudeReport({ days: [] })).toBe(false)
    expect(isServerReport({ ...server, id: 'Bad Id!' })).toBe(false)
    expect(isServerReport({ ...server, cpu: { ...server.cpu, pct: 'high' } })).toBe(false)
    expect(isClaudeReport({ limits: null, days: [day, day] })).toBe(false)
    expect(isClaudeReport({ limits: { ...limits, at: 'yesterday' }, days: [] })).toBe(false)
    expect(isClaudeReport({ limits: { ...limits, fiveHour: { utilization: 1, resetsAt: 'soon' } }, days: [] })).toBe(false)
    expect(isClaudeReport({ limits: { ...limits, fiveHour: { utilization: 0, resetsAt: null } }, days: [] })).toBe(true)
    expect(isClaudeReport({ limits: null, days: [{ ...day, input: -1 }] })).toBe(false)
    expect(isServerReport({ ...server, uptimeSec: -5 })).toBe(false)
    expect(isServerReport({ ...server, mem: { totalBytes: 1, usedBytes: -1 } })).toBe(false)
  })
})

describe('handleReport', () => {
  const save = jest.fn()

  beforeEach(() => save.mockReset())

  it('is off without REPORT_TOKEN', async () => {
    delete process.env.REPORT_TOKEN
    expect((await handleReport(post(claude), isClaudeReport, save)).status).toBe(503)
  })

  it('rejects a wrong token, bad JSON and invalid bodies', async () => {
    expect((await handleReport(post(claude, 'nope'), isClaudeReport, save)).status).toBe(401)
    expect((await handleReport(post('{oops'), isClaudeReport, save)).status).toBe(400)
    expect((await handleReport(post({ days: 1 }), isClaudeReport, save)).status).toBe(400)
    expect(save).not.toHaveBeenCalled()
  })

  it('rejects an oversized body by its content-length before reading it', async () => {
    const req = post(claude)
    req.headers.set('content-length', String(600 * 1024))
    expect((await handleReport(req, isClaudeReport, save)).status).toBe(413)
  })

  it('saves a valid report', async () => {
    const res = await handleReport(post(claude), isClaudeReport, save)
    expect(res.status).toBe(200)
    expect(save).toHaveBeenCalledWith(claude)
  })
})

describe('storage', () => {
  it('keeps the last limits when a report comes without them', () => {
    saveClaudeReport(claude)
    saveClaudeReport({ limits: null, days: [] })
    const stored = getClaudeReport()
    expect(stored?.limits).toEqual(limits)
    expect(stored?.days).toEqual([])
    expect(typeof stored?.receivedAt).toBe('number')
  })

  it('lists servers by order, then name', () => {
    saveServerReport({ ...server, id: 'b', name: 'B', order: 2 })
    saveServerReport({ ...server, id: 'a', name: 'A', order: 2 })
    saveServerReport({ ...server, id: 'oracle', name: 'Oracle', order: 1 })
    expect(getServerReports().map((s) => s.report.id)).toEqual(['oracle', 'a', 'b'])
  })
})
