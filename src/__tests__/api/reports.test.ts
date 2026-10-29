/**
 * @jest-environment node
 */

import { POST as claudePost } from '@/app/api/claude/report/route'
import { POST as serversPost } from '@/app/api/servers/report/route'
import { handleReport, isClaudeReport, isServerReport, saveClaudeReport, saveServerReport } from '@/lib/reports'

jest.mock('@/lib/reports')

const mockHandle = handleReport as jest.MockedFunction<typeof handleReport>

it('wires each route to its validator and store', async () => {
  mockHandle.mockResolvedValue(new Response('ok'))
  const request = new Request('http://localhost/api/claude/report', { method: 'POST' })
  await claudePost(request)
  expect(mockHandle).toHaveBeenLastCalledWith(request, isClaudeReport, saveClaudeReport)
  await serversPost(request)
  expect(mockHandle).toHaveBeenLastCalledWith(request, isServerReport, saveServerReport)
})
