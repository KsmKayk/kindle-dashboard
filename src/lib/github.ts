import { localDay, monthWindows, periodStarts, recentStart } from './periods'
import type { CiState, GithubCommit, GithubDeploy, GithubFast, GithubMergedPr, GithubPr, GithubReview, GithubSlow } from '@/types'

// GitHub data for the Work tab, through the token's own access (GITHUB_TOKEN, a
// classic PAT with `repo`). Search covers the user's org repos too.

const API = 'https://api.github.com'
// Search allows 30 requests per minute, and commit search has a secondary limit; every search is spaced out
const SEARCH_GAP_MS = 3_000
const LIST_SIZE = 3

function headers(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN is not set')
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
}

// Every /search/* call goes through this gate, shared by the fast and slow loads:
// it starts at least `gapMs` after the previous search call started.
let nextSearchAt = 0
async function searchSlot(gapMs: number): Promise<void> {
  const wait = Math.max(0, nextSearchAt - Date.now())
  nextSearchAt = Date.now() + wait + gapMs
  if (wait > 0) await sleep(wait)
}

const SEARCH_RETRIES = 3
const DEFAULT_BACKOFF_MS = 60_000

// How long to wait after a rate-limit response: retry-after, else until the
// limit resets when none is left, else a minute
function backoffMs(res: Response): number {
  const retryAfter = res.headers.get('retry-after')
  if (retryAfter !== null && retryAfter !== '' && !Number.isNaN(Number(retryAfter))) return Number(retryAfter) * 1000
  const reset = res.headers.get('x-ratelimit-reset')
  if (res.headers.get('x-ratelimit-remaining') === '0' && reset !== null && !Number.isNaN(Number(reset))) {
    return Math.max(0, Number(reset) * 1000 - Date.now())
  }
  return DEFAULT_BACKOFF_MS
}

async function rest<T>(path: string, gapMs = SEARCH_GAP_MS): Promise<T> {
  const isSearch = path.startsWith('/search/')
  for (let attempt = 0; ; attempt++) {
    if (isSearch) await searchSlot(gapMs)
    const res = await fetch(`${API}${path}`, { headers: headers(), cache: 'no-store' })
    if (res.ok) return res.json() as Promise<T>
    // Search has a secondary rate limit: wait it out and retry
    if (isSearch && (res.status === 403 || res.status === 429) && attempt < SEARCH_RETRIES) {
      const wait = backoffMs(res)
      console.error(`[github] ${res.status} on ${path}, retrying in ${Math.round(wait / 1000)}s`)
      await sleep(wait)
      continue
    }
    const remaining = res.headers.get('x-ratelimit-remaining')
    const retryAfter = res.headers.get('retry-after')
    throw new Error(`GitHub ${res.status} on ${path} (ratelimit-remaining: ${remaining ?? 'n/a'}, retry-after: ${retryAfter ?? 'n/a'})`)
  }
}

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`)
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (!body.data) throw new Error(`GitHub GraphQL: ${body.errors?.[0]?.message ?? 'no data'}`)
  // Partial results (e.g. a SAML-protected org) still carry data: use it
  if (body.errors?.length) console.error(`[github] GraphQL partial result: ${body.errors[0].message}`)
  return body.data
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
// Search qualifier datetime: 2026-10-26T03:00:00+00:00
const searchTime = (d: Date) => `${d.toISOString().slice(0, 19)}+00:00`

let loginPromise: Promise<string> | null = null

// The promise is cached, so concurrent cold-start calls share one request
function viewerLogin(): Promise<string> {
  loginPromise ??= graphql<{ viewer: { login: string } }>('query { viewer { login } }', {})
    .then((data) => data.viewer.login)
    .catch((err) => { loginPromise = null; throw err })
  return loginPromise
}

async function searchCount(q: string): Promise<number> {
  const body = await rest<{ total_count: number }>(`/search/issues?q=${encodeURIComponent(q)}&per_page=1`)
  return body.total_count
}

interface CommitItem { sha: string; repository: { full_name: string }; commit: { author: { date: string } } }

// Every page of a commit search (GitHub stops at 1000 results)
export async function searchCommits(q: string, gapMs = SEARCH_GAP_MS): Promise<GithubCommit[]> {
  const commits: GithubCommit[] = []
  for (let page = 1; page <= 10; page++) {
    const body = await rest<{ items: CommitItem[] }>(`/search/commits?q=${encodeURIComponent(q)}&per_page=100&page=${page}`, gapMs)
    commits.push(...body.items.map((item) => ({ sha: item.sha, repo: item.repository.full_name, date: item.commit.author.date })))
    if (body.items.length < 100) break
  }
  return commits
}

interface PrNode {
  id: string
  number: number
  title: string
  createdAt: string
  author: { login: string } | null
  repository: { nameWithOwner: string }
  latestOpinionatedReviews: { nodes: { state: string }[] }
  commits: { nodes: { commit: { statusCheckRollup: { state: string } | null } }[] }
}

const PR_FIELDS = `
  ... on PullRequest {
    id number title createdAt
    author { login }
    repository { nameWithOwner }
    latestOpinionatedReviews(first: 20) { nodes { state } }
    commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  }`

function ciState(state: string | null | undefined): CiState {
  if (state === 'SUCCESS') return 'success'
  if (state === 'FAILURE' || state === 'ERROR') return 'failure'
  if (state === 'PENDING' || state === 'EXPECTED') return 'pending'
  return null
}

export function toPr(node: PrNode): GithubPr {
  return {
    repo: node.repository.nameWithOwner,
    number: node.number,
    title: node.title,
    author: node.author?.login ?? 'ghost',
    createdAt: node.createdAt,
    ci: ciState(node.commits.nodes[0]?.commit.statusCheckRollup?.state),
    approvals: node.latestOpinionatedReviews.nodes.filter((r) => r.state === 'APPROVED').length,
  }
}

async function searchPrs(q: string): Promise<GithubPr[]> {
  const data = await graphql<{ search: { nodes: PrNode[] } }>(
    `query($q: String!, $first: Int!) { search(query: $q, type: ISSUE, first: $first) { nodes { ${PR_FIELDS} } } }`,
    { q, first: LIST_SIZE }
  )
  // Nodes the token cannot read come back null
  return data.search.nodes.filter(Boolean).map(toPr)
}

// The user's reviews on other people's PRs updated since `start` (a PR reviewed
// in the period was updated at or after that review)
async function searchReviews(user: string, start: Date): Promise<GithubReview[]> {
  const q = `is:pr reviewed-by:${user} -author:${user} updated:>=${localDay(start)}`
  const reviews: GithubReview[] = []
  let after: string | null = null
  do {
    const data: { search: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: ({ id?: string; reviews?: { nodes: { submittedAt: string | null }[] } } | null)[] } } = await graphql(
      `query($q: String!, $user: String!, $after: String) {
        search(query: $q, type: ISSUE, first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { ... on PullRequest { id reviews(author: $user, first: 50) { nodes { submittedAt } } } }
        }
      }`,
      { q, user, after }
    )
    for (const pr of data.search.nodes) {
      for (const review of pr?.reviews?.nodes ?? []) {
        if (pr?.id && review.submittedAt) reviews.push({ pr: pr.id, submittedAt: review.submittedAt })
      }
    }
    after = data.search.pageInfo.hasNextPage ? data.search.pageInfo.endCursor : null
  } while (after)
  return reviews
}

async function searchMerged(user: string, start: Date): Promise<GithubMergedPr[]> {
  const data = await graphql<{ search: { nodes: (Partial<GithubMergedPr> | null)[] } }>(
    `query($q: String!) { search(query: $q, type: ISSUE, first: 100) { nodes { ... on PullRequest { createdAt mergedAt additions deletions } } } }`,
    { q: `is:pr author:${user} is:merged merged:>=${localDay(start)}` }
  )
  return data.search.nodes.filter((n): n is GithubMergedPr => typeof n?.mergedAt === 'string')
}

interface RunItem { status: string; conclusion: string | null; created_at: string; updated_at: string }

export function toDeploy(repo: string, run: RunItem | undefined): GithubDeploy {
  if (!run) return { repo, state: null, at: null }
  if (run.status !== 'completed') return { repo, state: 'running', at: run.created_at }
  // Skipped or neutral runs say nothing about the deploy
  if (run.conclusion === 'skipped' || run.conclusion === 'neutral') return { repo, state: null, at: null }
  return { repo, state: run.conclusion === 'success' ? 'success' : 'failure', at: run.updated_at }
}

async function latestDeploy(repo: string): Promise<GithubDeploy> {
  const { default_branch } = await rest<{ default_branch: string }>(`/repos/${repo}`)
  const { workflow_runs } = await rest<{ workflow_runs: RunItem[] }>(
    `/repos/${repo}/actions/runs?branch=${encodeURIComponent(default_branch)}&per_page=1`
  )
  return toDeploy(repo, workflow_runs[0])
}

function deployRepos(): string[] {
  return (process.env.GITHUB_DEPLOY_REPOS ?? '').split(',').map((r) => r.trim()).filter(Boolean)
}

export async function fetchGithubFast(now = new Date()): Promise<GithubFast> {
  const user = await viewerLogin()
  const p = periodStarts(now)
  const recent = recentStart(now)
  const [prsOpenedWeek, prsOpenedMonth, commits, reviews, merged, openPrs, reviewQueue, deploys] = await Promise.all([
    searchCount(`is:pr author:${user} created:>=${searchTime(p.week)}`),
    searchCount(`is:pr author:${user} created:>=${searchTime(p.month)}`),
    searchCommits(`author:${user} author-date:>=${localDay(recent)}`),
    searchReviews(user, recent),
    searchMerged(user, new Date(now.getTime() - 31 * 86_400_000)),
    searchPrs(`is:pr is:open author:${user} archived:false sort:updated-desc`).catch((err) => { console.error('[github] open PRs', err); return [] }),
    searchPrs(`is:pr is:open review-requested:${user} archived:false sort:updated-desc`).catch((err) => { console.error('[github] review queue', err); return [] }),
    Promise.all(deployRepos().map((repo) => latestDeploy(repo).catch((err): GithubDeploy => {
      console.error(`[github] deploy ${repo}`, err)
      return { repo, state: null, at: null }
    }))),
  ])
  return { login: user, prsOpenedWeek, prsOpenedMonth, commits, reviews, merged, openPrs, reviewQueue, deploys }
}

// About a minute of spaced-out searches: run it in the background (server-cache.ts)
export async function fetchGithubSlow(now = new Date()): Promise<GithubSlow> {
  const user = await viewerLogin()
  const { year } = periodStarts(now)
  const prsOpenedYear = await searchCount(`is:pr author:${user} created:>=${searchTime(year)}`)
  const commits: GithubCommit[] = []
  for (const [from, to] of monthWindows(now, 13)) {
    commits.push(...(await searchCommits(`author:${user} author-date:${from}..${to}`)))
  }
  const reviews = await searchReviews(user, year)
  return { prsOpenedYear, commits: commits.filter((c) => new Date(c.date) >= year), reviews }
}
