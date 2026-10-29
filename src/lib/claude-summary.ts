import { localDay, periodStarts } from './periods'
import type { ClaudeDay, ClaudeLimits, StoredClaude } from '@/types'

// Claude figures for the Work tab, from the last claude-reporter report.

export interface ClaudeSummary {
  limits: ClaudeLimits | null
  receivedAt: number
  tokens: { today: number; week: number; month: number }
  daily: number[]                          // last 14 days, oldest first
  cachePct: number | null                  // this month
  models: { name: string; pct: number }[]  // this month, biggest first
  topProject: string | null                // this month
}

export const dayTotal = (d: ClaudeDay) => d.input + d.output + d.cacheWrite + d.cacheRead

export function modelFamily(model: string): string {
  const family = ['Opus', 'Sonnet', 'Haiku', 'Fable'].find((f) => model.toLowerCase().includes(f.toLowerCase()))
  return family ?? model
}

function addCounts(into: Map<string, number>, counts: Record<string, number>, key: (k: string) => string = (k) => k) {
  for (const [k, v] of Object.entries(counts)) into.set(key(k), (into.get(key(k)) ?? 0) + v)
}

export function summarizeClaude(stored: StoredClaude, now: Date): ClaudeSummary {
  const p = periodStarts(now)
  const today = localDay(now)
  const week = localDay(p.week)
  const monthStart = localDay(p.month)
  const byDate = new Map(stored.days.map((d) => [d.date, d]))
  const month = stored.days.filter((d) => d.date >= monthStart)
  const sum = (days: ClaudeDay[]) => days.reduce((total, d) => total + dayTotal(d), 0)

  const daily: number[] = []
  for (let back = 13; back >= 0; back--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back)
    const d = byDate.get(localDay(date))
    daily.push(d ? dayTotal(d) : 0)
  }

  const cacheRead = month.reduce((t, d) => t + d.cacheRead, 0)
  const cacheBase = month.reduce((t, d) => t + d.input + d.cacheWrite + d.cacheRead, 0)

  const models = new Map<string, number>()
  const projects = new Map<string, number>()
  for (const d of month) {
    addCounts(models, d.byModel, modelFamily)
    addCounts(projects, d.byProject)
  }
  const modelTotal = [...models.values()].reduce((a, b) => a + b, 0)
  const topProject = [...projects.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    limits: stored.limits,
    receivedAt: stored.receivedAt,
    tokens: { today: sum(month.filter((d) => d.date === today)), week: sum(stored.days.filter((d) => d.date >= week)), month: sum(month) },
    daily,
    cachePct: cacheBase > 0 ? Math.round((cacheRead / cacheBase) * 100) : null,
    models: modelTotal <= 0 ? [] : [...models.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, v]) => ({ name, pct: Math.round((v / modelTotal) * 100) })),
    topProject,
  }
}
