import { periodStarts } from './periods'
import type { GithubCommit, GithubFast, GithubMergedPr, GithubReview, GithubSlow, GithubStats, RepoCount } from '@/types'

// Pure computations behind the GitHub part of the Work tab.

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

const since = (date: string, start: Date) => new Date(date).getTime() >= start.getTime()

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Map<string, T>()
  for (const item of items) seen.set(key(item), item)
  return [...seen.values()]
}

// Distinct PRs with at least one review submitted since `start`
export function reviewedPrs(reviews: GithubReview[], start: Date): number {
  return new Set(reviews.filter((r) => since(r.submittedAt, start)).map((r) => r.pr)).size
}

// Counts per week, oldest first; the last bucket is the week starting at `weekStart`
export function weeklyCounts(dates: string[], weekStart: Date, weeks = 12): number[] {
  const counts = new Array<number>(weeks).fill(0)
  for (const date of dates) {
    const t = new Date(date).getTime()
    const back = t >= weekStart.getTime() ? 0 : Math.ceil((weekStart.getTime() - t) / WEEK_MS)
    if (back < weeks) counts[weeks - 1 - back]++
  }
  return counts
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

// Consecutive days with a commit, ending today (or yesterday while today has none)
export function commitStreak(dates: string[], now: Date): number {
  const days = new Set(dates.map((d) => dayKey(new Date(d))))
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (!days.has(dayKey(day))) day.setDate(day.getDate() - 1)
  let streak = 0
  while (days.has(dayKey(day))) {
    streak++
    day.setDate(day.getDate() - 1)
  }
  return streak
}

export function topRepo(commits: GithubCommit[], start: Date): RepoCount | null {
  const counts = new Map<string, number>()
  for (const c of commits) if (since(c.date, start)) counts.set(c.repo, (counts.get(c.repo) ?? 0) + 1)
  let best: RepoCount | null = null
  for (const [repo, n] of counts) if (!best || n > best.commits) best = { repo, commits: n }
  return best
}

export function medianMergeHours(merged: GithubMergedPr[], start: Date): number | null {
  const hours = merged
    .filter((p) => since(p.mergedAt, start))
    .map((p) => (new Date(p.mergedAt).getTime() - new Date(p.createdAt).getTime()) / 3_600_000)
    .sort((a, b) => a - b)
  if (hours.length === 0) return null
  const mid = Math.floor(hours.length / 2)
  return hours.length % 2 ? hours[mid] : (hours[mid - 1] + hours[mid]) / 2
}

const perMonth = (yearCount: number) => Math.round((yearCount / 12) * 10) / 10

// `slow` is null until the first 12-month load finishes
export function buildGithubStats(fast: GithubFast, slow: GithubSlow | null, now: Date): GithubStats {
  const p = periodStarts(now)
  const commits = uniqueBy([...(slow?.commits ?? []), ...fast.commits], (c) => c.sha)
  const reviews = uniqueBy([...(slow?.reviews ?? []), ...fast.reviews], (r) => `${r.pr}@${r.submittedAt}`)
  const dates = commits.map((c) => c.date)
  const mergedThisMonth = fast.merged.filter((m) => since(m.mergedAt, p.month))
  return {
    login: fast.login,
    prsOpened: { week: fast.prsOpenedWeek, month: fast.prsOpenedMonth, avgMonth: slow ? perMonth(slow.prsOpenedYear) : null },
    prsReviewed: {
      week: reviewedPrs(reviews, p.week),
      month: reviewedPrs(reviews, p.month),
      avgMonth: slow ? perMonth(reviewedPrs(reviews, p.year)) : null,
    },
    commits: {
      week: dates.filter((d) => since(d, p.week)).length,
      month: dates.filter((d) => since(d, p.month)).length,
      weekly: weeklyCounts(dates, p.week),
    },
    streak: commitStreak(dates, now),
    topRepo: { year: slow ? topRepo(commits, p.year) : null, month: topRepo(commits, p.month) },
    mergeHours: medianMergeHours(fast.merged, new Date(now.getTime() - 30 * DAY_MS)),
    lines: {
      added: mergedThisMonth.reduce((sum, m) => sum + m.additions, 0),
      removed: mergedThisMonth.reduce((sum, m) => sum + m.deletions, 0),
    },
    openPrs: fast.openPrs,
    reviewQueue: fast.reviewQueue,
    deploys: fast.deploys,
  }
}
