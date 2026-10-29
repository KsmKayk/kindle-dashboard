import { summarizeClaude, modelFamily, dayTotal } from '@/lib/claude-summary'
import type { ClaudeDay, StoredClaude } from '@/types'

const now = new Date(2026, 9, 29, 14, 30)  // Wed; week from Mon 26, month from 1 Oct

const day = (date: string, tokens: number, model = 'claude-opus-5-5', project = 'kindle-dashboard'): ClaudeDay => ({
  date, input: 0, output: tokens / 2, cacheWrite: 0, cacheRead: tokens / 2,
  byModel: { [model]: tokens }, byProject: { [project]: tokens },
})

const stored: StoredClaude = {
  limits: null,
  receivedAt: now.getTime(),
  days: [
    day('2026-10-29', 100),
    day('2026-10-27', 300, 'claude-sonnet-5-5', 'portfolio'),
    day('2026-10-20', 600),
    day('2026-09-30', 5000),
  ],
}

it('modelFamily', () => {
  expect(modelFamily('claude-opus-5-5')).toBe('Opus')
  expect(modelFamily('claude-sonnet-5-5')).toBe('Sonnet')
  expect(modelFamily('claude-haiku-5-5')).toBe('Haiku')
  expect(modelFamily('other')).toBe('other')
})

it('dayTotal sums the four token kinds', () => {
  expect(dayTotal({ ...day('2026-10-29', 0), input: 1, output: 2, cacheWrite: 3, cacheRead: 4 })).toBe(10)
})

it('summarizes today, week, month and the month split', () => {
  const s = summarizeClaude(stored, now)
  expect(s.tokens).toEqual({ today: 100, week: 400, month: 1000 })
  expect(s.daily).toHaveLength(14)
  expect(s.daily[13]).toBe(100)
  expect(s.daily[11]).toBe(300)
  expect(s.cachePct).toBe(100)  // input and cacheWrite are 0 in the fixture
  expect(s.models).toEqual([{ name: 'Opus', pct: 70 }, { name: 'Sonnet', pct: 30 }])
  expect(s.topProject).toBe('kindle-dashboard')
})

it('is empty for a month without usage', () => {
  const s = summarizeClaude({ ...stored, days: [] }, now)
  expect(s.tokens).toEqual({ today: 0, week: 0, month: 0 })
  expect(s.cachePct).toBeNull()
  expect(s.models).toEqual([])
  expect(s.topProject).toBeNull()
})

it('has no model split when the month has zero model tokens', () => {
  const zero = { ...day('2026-10-29', 0) }
  expect(summarizeClaude({ ...stored, days: [zero] }, now).models).toEqual([])
})
