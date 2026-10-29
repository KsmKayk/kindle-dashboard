import { test } from 'node:test'
import assert from 'node:assert/strict'
import { usageFromLine, emptyState, addUsage, pruneState, completeLines, daysForReport, limitsFromUsage, localDay, scanLogs, normalizeState } from '../lib.mjs'
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const line = (overrides = {}) => JSON.stringify({
  type: 'assistant',
  timestamp: '2026-10-28T19:12:33.933Z',
  requestId: 'req_1',
  cwd: 'D:\\Workspace\\Node\\kindle-dashboard',
  message: {
    id: 'msg_1',
    model: 'claude-opus-5-5',
    usage: { input_tokens: 2, cache_creation_input_tokens: 21042, cache_read_input_tokens: 30417, output_tokens: 287 },
  },
  ...overrides,
})

test('usageFromLine reads an assistant entry', () => {
  const u = usageFromLine(line())
  assert.equal(u.key, 'msg_1:req_1')
  assert.equal(u.date, localDay(new Date('2026-10-28T19:12:33.933Z')))
  assert.equal(u.model, 'claude-opus-5-5')
  assert.equal(u.project, 'kindle-dashboard')
  assert.deepEqual([u.input, u.output, u.cacheWrite, u.cacheRead], [2, 287, 21042, 30417])
})

test('usageFromLine skips other entries', () => {
  assert.equal(usageFromLine('not json'), null)
  assert.equal(usageFromLine(JSON.stringify({ type: 'user', message: {} })), null)
  assert.equal(usageFromLine(line({ message: { id: 'm', model: '<synthetic>', usage: { input_tokens: 1 } } })), null)
})

test('addUsage counts each message once and splits by model and project', () => {
  const state = emptyState()
  addUsage(state, usageFromLine(line()))
  addUsage(state, usageFromLine(line()))  // same message, other file
  addUsage(state, usageFromLine(line({ requestId: 'req_2', message: { id: 'msg_2', model: 'claude-sonnet-5-5', usage: { output_tokens: 13 } } })))
  const day = state.days[localDay(new Date('2026-10-28T19:12:33.933Z'))]
  assert.equal(day.output, 300)
  assert.equal(day.byModel['claude-opus-5-5'], 2 + 287 + 21042 + 30417)
  assert.equal(day.byModel['claude-sonnet-5-5'], 13)
  assert.equal(day.byProject['kindle-dashboard'], 2 + 287 + 21042 + 30417 + 13)
})

test('pruneState drops days and seen keys older than 35 days', () => {
  const state = emptyState()
  addUsage(state, { key: 'old', date: '2026-09-01', model: 'm', project: 'p', input: 1, output: 0, cacheWrite: 0, cacheRead: 0 })
  addUsage(state, { key: 'new', date: '2026-10-20', model: 'm', project: 'p', input: 1, output: 0, cacheWrite: 0, cacheRead: 0 })
  pruneState(state, new Date(2026, 9, 29))
  assert.deepEqual(Object.keys(state.days), ['2026-10-20'])
  assert.deepEqual(Object.keys(state.seen), ['new'])
})

test('completeLines keeps a partial last line for the next run', () => {
  const text = 'a\nb\npart'
  const { lines, consumed } = completeLines(Buffer.from(text))
  assert.deepEqual(lines, ['a', 'b'])
  assert.equal(consumed, 4)
})

test('daysForReport sorts days', () => {
  const state = emptyState()
  addUsage(state, { key: '2', date: '2026-10-29', model: 'm', project: 'p', input: 1, output: 0, cacheWrite: 0, cacheRead: 0 })
  addUsage(state, { key: '1', date: '2026-10-28', model: 'm', project: 'p', input: 1, output: 0, cacheWrite: 0, cacheRead: 0 })
  assert.deepEqual(daysForReport(state).map((d) => d.date), ['2026-10-28', '2026-10-29'])
})

test('limitsFromUsage maps the usage endpoint', () => {
  const limits = limitsFromUsage({
    five_hour: { utilization: 4.0, resets_at: '2026-10-29T19:09:59.553598+00:00' },
    seven_day: { utilization: 0.0, resets_at: '2026-11-05T06:59:59.553619+00:00' },
    seven_day_opus: null,
  }, new Date('2026-10-29T15:00:00Z'))
  assert.deepEqual(limits, {
    fiveHour: { utilization: 4, resetsAt: '2026-10-29T19:09:59.553598+00:00' },
    sevenDay: { utilization: 0, resetsAt: '2026-11-05T06:59:59.553619+00:00' },
    at: '2026-10-29T15:00:00.000Z',
  })
  assert.equal(limitsFromUsage({ five_hour: null, seven_day: null }, new Date()), null)
})

test('usageFromLine skips lines the server could not accept', () => {
  assert.equal(usageFromLine(line({ timestamp: 'garbage' })), null)
  assert.equal(usageFromLine(line({ timestamp: undefined })), null)
  const u = usageFromLine(line({ message: { id: 'm', model: 'x', usage: { input_tokens: -5, output_tokens: 'a' } } }))
  assert.deepEqual([u.input, u.output], [0, 0])
})

test('daysForReport folds records beyond 100 keys into other', () => {
  const state = emptyState()
  for (let i = 0; i < 150; i++) addUsage(state, { key: `k${i}`, date: '2026-10-29', model: 'm', project: `p${i}`, input: i + 1, output: 0, cacheWrite: 0, cacheRead: 0 })
  const day = daysForReport(state)[0]
  assert.equal(Object.keys(day.byProject).length, 100)
  assert.equal(Object.values(day.byProject).reduce((a, b) => a + b, 0), state.days['2026-10-29'].input)
})

test('limitsFromUsage drops limits the server would reject', () => {
  const l = limitsFromUsage({ five_hour: { utilization: 3, resets_at: 'garbage' }, seven_day: { utilization: -1, resets_at: '2026-11-05T00:00:00Z' } }, new Date())
  assert.equal(l, null)
})

test('limitsFromUsage keeps an idle 5-hour window as a null reset', () => {
  const l = limitsFromUsage({ five_hour: { utilization: 0, resets_at: null }, seven_day: null }, new Date('2026-10-29T15:00:00Z'))
  assert.deepEqual(l.fiveHour, { utilization: 0, resetsAt: null })
  assert.equal(l.sevenDay, null)
})

test('daysForReport adds to an existing other key', () => {
  const state = emptyState()
  addUsage(state, { key: 'o', date: '2026-10-29', model: 'm', project: 'other', input: 5, output: 0, cacheWrite: 0, cacheRead: 0 })
  for (let i = 0; i < 150; i++) addUsage(state, { key: `k${i}`, date: '2026-10-29', model: 'm', project: `p${i}`, input: 1, output: 0, cacheWrite: 0, cacheRead: 0 })
  const day = daysForReport(state)[0]
  assert.equal(Object.values(day.byProject).reduce((a, b) => a + b, 0), 155)
})

test('normalizeState repairs a wrong-shaped state', () => {
  assert.deepEqual(normalizeState(null), emptyState())
  assert.deepEqual(normalizeState({ files: [], seen: 'x', days: { a: 1 } }), { files: {}, seen: {}, days: { a: 1 } })
})

const logLine = (id) => line({ requestId: `r${id}`, message: { id: `m${id}`, model: 'claude-opus-5-5', usage: { output_tokens: 10 } } }) + '\n'
const total = (state) => Object.values(state.days).reduce((n, d) => n + d.output, 0)

test('scanLogs reads incrementally, re-reads a partial line, and survives bad files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'reporter-'))
  try {
    mkdirSync(join(dir, 'sub'))
    const a = join(dir, 'a.jsonl')
    const b = join(dir, 'sub', 'b.jsonl')
    writeFileSync(a, logLine(1) + logLine(2))
    writeFileSync(b, logLine(3) + logLine(4).slice(0, 30))
    const errors = []
    const state = emptyState()
    scanLogs(state, dir, (m) => errors.push(m))
    assert.equal(total(state), 30)
    assert.equal(state.files[a], Buffer.byteLength(logLine(1) + logLine(2)))
    assert.equal(state.files[b], Buffer.byteLength(logLine(3)))

    appendFileSync(b, logLine(4).slice(30))  // the line is completed
    scanLogs(state, dir, (m) => errors.push(m))
    assert.equal(total(state), 40)

    writeFileSync(a, logLine(1))  // truncated and rewritten: no double counting
    scanLogs(state, dir, (m) => errors.push(m))
    assert.equal(total(state), 40)
    assert.equal(state.files[a], Buffer.byteLength(logLine(1)))

    rmSync(b)  // vanished file is forgotten
    scanLogs(state, dir, (m) => errors.push(m))
    assert.equal(state.files[b], undefined)
    assert.deepEqual(errors, [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('scanLogs ignores a directory named like a log and keeps going', () => {
  const dir = mkdtempSync(join(tmpdir(), 'reporter-'))
  try {
    mkdirSync(join(dir, 'dir.jsonl'))  // a directory named like a log: opening it for reading fails
    writeFileSync(join(dir, 'ok.jsonl'), logLine(1))
    const errors = []
    const state = emptyState()
    scanLogs(state, dir, (m) => errors.push(m))
    assert.equal(total(state), 10)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('scanLogs on a missing directory does nothing', () => {
  const state = emptyState()
  scanLogs(state, join(tmpdir(), 'does-not-exist-reporter'), () => {})
  assert.deepEqual(state, emptyState())
})
