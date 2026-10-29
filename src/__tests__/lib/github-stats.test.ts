import { reviewedPrs, weeklyCounts, commitStreak, topRepo, medianMergeHours, buildGithubStats } from '@/lib/github-stats'
import type { GithubFast, GithubSlow } from '@/types'

// Wednesday 29 Oct 2026, 14:30 local; the week began Mon 26 Oct
const now = new Date(2026, 9, 29, 14, 30)
const at = (month: number, day: number, hour = 12) => new Date(2026, month, day, hour).toISOString()
const commit = (sha: string, repo: string, date: string) => ({ sha, repo, date })

describe('reviewedPrs', () => {
  it('counts distinct PRs with a review submitted since the start', () => {
    const reviews = [
      { pr: 'A', submittedAt: at(9, 27) },
      { pr: 'A', submittedAt: at(9, 28) },
      { pr: 'B', submittedAt: at(9, 20) },
    ]
    expect(reviewedPrs(reviews, new Date(2026, 9, 26))).toBe(1)
    expect(reviewedPrs(reviews, new Date(2026, 9, 1))).toBe(2)
  })
})

describe('weeklyCounts', () => {
  it('buckets dates into weeks ending with the current one', () => {
    const weekStart = new Date(2026, 9, 26)
    // current week: 27 Oct, 26 Oct 00:00 → 2; previous week (19–25): 25 Oct 23:00, 19 Oct → 2;
    // two weeks back (12–18): 18 Oct → 1; 1 Aug is past the 3-week window
    const dates = [at(9, 27), at(9, 26, 0), at(9, 25, 23), at(9, 19), at(9, 18), at(7, 1)]
    expect(weeklyCounts(dates, weekStart, 3)).toEqual([1, 2, 2])
  })
})

describe('commitStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(commitStreak([at(9, 29), at(9, 28), at(9, 27), at(9, 25)], now)).toBe(3)
  })

  it('ends yesterday when there is no commit yet today', () => {
    expect(commitStreak([at(9, 28), at(9, 27)], now)).toBe(2)
  })

  it('is 0 without a commit today or yesterday', () => {
    expect(commitStreak([at(9, 26)], now)).toBe(0)
  })
})

describe('topRepo', () => {
  it('returns the repo with most commits since the start', () => {
    const commits = [commit('1', 'a/x', at(9, 27)), commit('2', 'a/y', at(9, 27)), commit('3', 'a/y', at(9, 28)), commit('4', 'a/x', at(8, 1)), commit('5', 'a/x', at(8, 2))]
    expect(topRepo(commits, new Date(2026, 9, 1))).toEqual({ repo: 'a/y', commits: 2 })
    expect(topRepo(commits, new Date(2026, 0, 1))).toEqual({ repo: 'a/x', commits: 3 })
    expect(topRepo([], new Date(2026, 0, 1))).toBeNull()
  })
})

describe('medianMergeHours', () => {
  it('takes the median time from creation to merge', () => {
    const pr = (createdAt: string, mergedAt: string) => ({ createdAt, mergedAt, additions: 0, deletions: 0 })
    const merged = [pr(at(9, 20, 0), at(9, 20, 10)), pr(at(9, 20, 0), at(9, 21, 0)), pr(at(9, 20, 0), at(9, 22, 0))]
    expect(medianMergeHours(merged, new Date(2026, 9, 1))).toBe(24)
    expect(medianMergeHours(merged.slice(0, 2), new Date(2026, 9, 1))).toBe(17)
    expect(medianMergeHours([], new Date(2026, 9, 1))).toBeNull()
  })
})

describe('buildGithubStats', () => {
  const fast: GithubFast = {
    login: 'KsmKayk',
    prsOpenedWeek: 3,
    prsOpenedMonth: 5,
    commits: [commit('c1', 'a/x', at(9, 29)), commit('c2', 'a/x', at(9, 2))],
    reviews: [{ pr: 'P1', submittedAt: at(9, 27) }],
    merged: [
      { createdAt: at(9, 10), mergedAt: at(9, 11), additions: 100, deletions: 40 },
      { createdAt: at(8, 28), mergedAt: at(8, 30), additions: 7, deletions: 7 },
    ],
    openPrs: [],
    reviewQueue: [],
    deploys: [],
  }
  const slow: GithubSlow = {
    prsOpenedYear: 195,
    // c2 also comes from the fast list: counted once
    commits: [commit('c2', 'a/x', at(9, 2)), commit('c3', 'a/y', at(5, 1)), commit('c4', 'a/y', at(5, 2)), commit('c5', 'a/x', at(4, 1))],
    reviews: [{ pr: 'P1', submittedAt: at(9, 27) }, { pr: 'P2', submittedAt: at(3, 1) }],
  }

  it('combines the fast and 12-month data', () => {
    const stats = buildGithubStats(fast, slow, now)
    expect(stats.prsOpened).toEqual({ week: 3, month: 5, avgMonth: 16.3 })
    expect(stats.prsReviewed).toEqual({ week: 1, month: 1, avgMonth: 0.2 })
    expect(stats.commits.week).toBe(1)
    expect(stats.commits.month).toBe(2)
    expect(stats.commits.weekly).toHaveLength(12)
    expect(stats.commits.weekly[11]).toBe(1)
    expect(stats.streak).toBe(1)
    expect(stats.topRepo).toEqual({ year: { repo: 'a/x', commits: 3 }, month: { repo: 'a/x', commits: 2 } })
    // only the 11 Oct merge is this month; both merges are within 30 days (24 h and 48 h)
    expect(stats.lines).toEqual({ added: 100, removed: 40 })
    expect(stats.mergeHours).toBe(36)
  })

  it('leaves 12-month figures empty until they are loaded', () => {
    const stats = buildGithubStats(fast, null, now)
    expect(stats.prsOpened.avgMonth).toBeNull()
    expect(stats.prsReviewed.avgMonth).toBeNull()
    expect(stats.streak).toBeNull()
    expect(stats.topRepo.year).toBeNull()
    expect(stats.commits.month).toBe(2)
  })
})
