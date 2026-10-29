/**
 * @jest-environment node
 */

import { toPr, toDeploy, searchCommits, fetchGithubFast } from '@/lib/github'

describe('toPr', () => {
  it('maps a GraphQL pull request', () => {
    const pr = toPr({
      id: 'PR_1', number: 4982, title: 'Correção de bugs', createdAt: '2026-10-26T21:01:38Z',
      author: { login: 'KsmKayk' }, repository: { nameWithOwner: 'iclinic/iclinic-api' },
      latestOpinionatedReviews: { nodes: [{ state: 'APPROVED' }, { state: 'COMMENTED' }] },
      commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] },
    })
    expect(pr).toEqual({
      repo: 'iclinic/iclinic-api', number: 4982, title: 'Correção de bugs', author: 'KsmKayk',
      createdAt: '2026-10-26T21:01:38Z', ci: 'failure', approvals: 1,
    })
  })

  it('has no CI state without checks', () => {
    const pr = toPr({
      id: 'PR_2', number: 1, title: 't', createdAt: '2026-10-26T00:00:00Z', author: null,
      repository: { nameWithOwner: 'a/b' }, latestOpinionatedReviews: { nodes: [] }, commits: { nodes: [{ commit: { statusCheckRollup: null } }] },
    })
    expect(pr.ci).toBeNull()
    expect(pr.author).toBe('ghost')
  })
})

describe('toDeploy', () => {
  it('maps the latest workflow run', () => {
    expect(toDeploy('a/b', undefined)).toEqual({ repo: 'a/b', state: null, at: null })
    expect(toDeploy('a/b', { status: 'in_progress', conclusion: null, created_at: 'c', updated_at: 'u' })).toEqual({ repo: 'a/b', state: 'running', at: 'c' })
    expect(toDeploy('a/b', { status: 'completed', conclusion: 'success', created_at: 'c', updated_at: 'u' })).toEqual({ repo: 'a/b', state: 'success', at: 'u' })
    expect(toDeploy('a/b', { status: 'completed', conclusion: 'skipped', created_at: 'c', updated_at: 'u' })).toEqual({ repo: 'a/b', state: null, at: null })
    expect(toDeploy('a/b', { status: 'completed', conclusion: 'neutral', created_at: 'c', updated_at: 'u' })).toEqual({ repo: 'a/b', state: null, at: null })
    expect(toDeploy('a/b', { status: 'completed', conclusion: 'cancelled', created_at: 'c', updated_at: 'u' })).toEqual({ repo: 'a/b', state: 'failure', at: 'u' })
  })
})

describe('searchCommits', () => {
  const item = (sha: string) => ({ sha, repository: { full_name: 'a/b' }, commit: { author: { date: '2026-10-01T00:00:00Z' } } })

  beforeEach(() => { process.env.GITHUB_TOKEN = 't' })

  it('follows pages until a short one', async () => {
    const pages = [Array.from({ length: 100 }, (_, i) => item(`s${i}`)), [item('last')]]
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ items: pages.shift() ?? [] }), { status: 200 }))
    const commits = await searchCommits('author:me', 0)
    expect(commits).toHaveLength(101)
    expect(commits[100]).toEqual({ sha: 'last', repo: 'a/b', date: '2026-10-01T00:00:00Z' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain('page=2')
    fetchMock.mockRestore()
  })
})

describe('fetchGithubFast resilience', () => {
  afterEach(() => { jest.restoreAllMocks(); delete process.env.GITHUB_DEPLOY_REPOS })

  it('survives a failing deploy repo and partial GraphQL data with null nodes', async () => {
    process.env.GITHUB_TOKEN = 't'
    process.env.GITHUB_DEPLOY_REPOS = 'a/broken'
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
    jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith('/graphql')) {
        const { query } = JSON.parse(String(init?.body))
        if (query.includes('viewer')) return json({ data: { viewer: { login: 'me' } } })
        return json({ data: { search: { pageInfo: { hasNextPage: false, endCursor: '' }, nodes: [null] } }, errors: [{ message: 'SAML' }] })
      }
      if (url.includes('/search/issues')) return json({ total_count: 2 })
      if (url.includes('/search/commits')) return json({ items: [] })
      return json({}, 500)
    })
    const fast = await fetchGithubFast(new Date(2026, 9, 29, 14, 30))
    expect(fast.prsOpenedWeek).toBe(2)
    expect(fast.openPrs).toEqual([])
    expect(fast.merged).toEqual([])
    expect(fast.deploys).toEqual([{ repo: 'a/broken', state: null, at: null }])
  }, 30_000)
})
