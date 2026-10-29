export type CiState = 'success' | 'failure' | 'pending' | null

export interface GithubPr {
  repo: string        // owner/name
  number: number
  title: string
  author: string
  createdAt: string
  ci: CiState         // state of the last commit's checks
  approvals: number
}

export interface GithubDeploy {
  repo: string
  state: 'success' | 'failure' | 'running' | null  // null: no workflow run yet
  at: string | null
}

export interface GithubCommit { sha: string; repo: string; date: string }
// pr: the PR's node id, so reviews of one PR count once
export interface GithubReview { pr: string; submittedAt: string }
export interface GithubMergedPr { createdAt: string; mergedAt: string; additions: number; deletions: number }

// Refreshed every GITHUB_UPDATE_RATE: this week and month, lists, deploys
export interface GithubFast {
  login: string
  prsOpenedWeek: number
  prsOpenedMonth: number
  commits: GithubCommit[]   // since recentStart()
  reviews: GithubReview[]   // since recentStart()
  merged: GithubMergedPr[]  // merged in the last 31 days
  openPrs: GithubPr[]
  reviewQueue: GithubPr[]
  deploys: GithubDeploy[]
}

// Refreshed hourly: the last 12 months
export interface GithubSlow {
  prsOpenedYear: number
  commits: GithubCommit[]
  reviews: GithubReview[]
}

export interface PeriodCounts { week: number; month: number; avgMonth: number | null }
export interface RepoCount { repo: string; commits: number }

export interface GithubStats {
  login: string
  prsOpened: PeriodCounts
  prsReviewed: PeriodCounts
  commits: { week: number; month: number; weekly: number[] }  // weekly: 12 weeks, oldest first
  streak: number | null  // null until the 12-month data is loaded
  topRepo: { year: RepoCount | null; month: RepoCount | null }
  mergeHours: number | null
  lines: { added: number; removed: number }
  openPrs: GithubPr[]
  reviewQueue: GithubPr[]
  deploys: GithubDeploy[]
}
