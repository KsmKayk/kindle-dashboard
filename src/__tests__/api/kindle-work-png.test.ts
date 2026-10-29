/**
 * @jest-environment node
 */

import { GET } from '@/app/api/kindle/work.png/route'
import { getCachedGithubStats } from '@/lib/server-cache'
import { getClaudeReport } from '@/lib/reports'
import { renderWorkPng } from '@/lib/work-image'

jest.mock('@/lib/server-cache')
jest.mock('@/lib/reports')
jest.mock('@/lib/work-image', () => ({ renderWorkPng: jest.fn() }))

const mockGithub = getCachedGithubStats as jest.MockedFunction<typeof getCachedGithubStats>
const mockClaude = getClaudeReport as jest.MockedFunction<typeof getClaudeReport>
const mockRender = renderWorkPng as jest.MockedFunction<typeof renderWorkPng>

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockRender.mockReset().mockResolvedValue(Buffer.from('png'))
})

it('renders with GitHub failing and no Claude report yet', async () => {
  mockGithub.mockRejectedValue(new Error('GitHub 502'))
  mockClaude.mockReturnValue(null)
  const res = await GET(new Request('http://localhost/api/kindle/work.png?w=600&h=700'))
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toBe('image/png')
  expect(mockRender).toHaveBeenCalledWith(null, null, { width: 600, height: 700 })
})

it('summarizes the Claude report', async () => {
  mockGithub.mockResolvedValue(null)
  mockClaude.mockReturnValue({ limits: null, days: [], receivedAt: Date.now() })
  await GET(new Request('http://localhost/api/kindle/work.png'))
  expect(mockRender.mock.calls[0][1]).toMatchObject({ tokens: { today: 0, week: 0, month: 0 } })
})
