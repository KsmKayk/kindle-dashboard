/**
 * @jest-environment node
 */

import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { getCachedGithubStats, resetCacheForTest, saveEntry, loadEntry } from '@/lib/server-cache'
import { fetchGithubFast, fetchGithubSlow } from '@/lib/github'
import type { GithubFast } from '@/types'

jest.mock('@/lib/github')
jest.mock('@/lib/steam')
jest.mock('@/lib/league')
jest.mock('@/lib/spotify')

const mockFast = fetchGithubFast as jest.MockedFunction<typeof fetchGithubFast>
const mockSlow = fetchGithubSlow as jest.MockedFunction<typeof fetchGithubSlow>

const fast: GithubFast = {
  login: 'me', prsOpenedWeek: 1, prsOpenedMonth: 2, commits: [], reviews: [], merged: [],
  openPrs: [], reviewQueue: [], deploys: [],
}

beforeEach(() => {
  process.env.CACHE_DIR = mkdtempSync(join(tmpdir(), 'server-cache-gh-'))
  process.env.GITHUB_TOKEN = 't'
  jest.clearAllMocks()
  resetCacheForTest()
  mockFast.mockResolvedValue(fast)
})

afterAll(() => { delete process.env.GITHUB_TOKEN })

it('is null without a token', async () => {
  delete process.env.GITHUB_TOKEN
  expect(await getCachedGithubStats()).toBeNull()
  expect(mockFast).not.toHaveBeenCalled()
})

it('answers with the fast data while the 12 months load in the background', async () => {
  mockSlow.mockReturnValue(new Promise(() => {}))
  const stats = await getCachedGithubStats()
  expect(stats?.prsOpened).toEqual({ week: 1, month: 2, avgMonth: null })
  expect(mockSlow).toHaveBeenCalledTimes(1)
})

it('uses the 12 months once loaded', async () => {
  mockSlow.mockResolvedValue({ prsOpenedYear: 24, commits: [], reviews: [] })
  await getCachedGithubStats()
  await new Promise((resolve) => setImmediate(resolve))
  const stats = await getCachedGithubStats()
  expect(stats?.prsOpened.avgMonth).toBe(2)
  expect(mockSlow).toHaveBeenCalledTimes(1)
})

it('saves and loads plain entries', () => {
  saveEntry('report-x', { a: 1 })
  resetCacheForTest({ keepDisk: true })
  expect(loadEntry<{ a: number }>('report-x')?.data).toEqual({ a: 1 })
})

it('does not retry or log the 12-month failure on every request during the cooldown', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {})
  mockSlow.mockRejectedValue(new Error('boom'))
  await getCachedGithubStats()
  await new Promise((resolve) => setImmediate(resolve))
  const logged = errorLog.mock.calls.length
  await getCachedGithubStats()
  await new Promise((resolve) => setImmediate(resolve))
  expect(mockSlow).toHaveBeenCalledTimes(1)
  expect(errorLog.mock.calls.length).toBe(logged)
  errorLog.mockRestore()
})

it('serves stale fast data without waiting for the refetch', async () => {
  mockSlow.mockReturnValue(new Promise(() => {}))
  saveEntry('github-fast', fast)
  const entry = loadEntry<GithubFast>('github-fast')!
  entry.at = Date.now() - 3_600_000
  resetCacheForTest({ keepDisk: true })
  const { writeFileSync } = await import('fs')
  writeFileSync(join(process.env.CACHE_DIR!, 'github-fast.json'), JSON.stringify(entry))
  resetCacheForTest({ keepDisk: true })
  mockFast.mockReturnValue(new Promise(() => {}))
  const stats = await getCachedGithubStats()
  expect(stats?.prsOpened.week).toBe(1)
  expect(mockFast).toHaveBeenCalledTimes(1)
})
