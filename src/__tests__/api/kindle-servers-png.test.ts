/**
 * @jest-environment node
 */

import { GET } from '@/app/api/kindle/servers.png/route'
import { getCachedHealth } from '@/lib/server-cache'
import { getServerReports } from '@/lib/reports'
import { renderServersPng } from '@/lib/servers-image'

jest.mock('@/lib/server-cache')
jest.mock('@/lib/reports')
jest.mock('@/lib/servers-image', () => ({ renderServersPng: jest.fn() }))

const mockHealth = getCachedHealth as jest.MockedFunction<typeof getCachedHealth>
const mockServers = getServerReports as jest.MockedFunction<typeof getServerReports>
const mockRender = renderServersPng as jest.MockedFunction<typeof renderServersPng>

it('renders the saved reports, with failed health checks as none', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockHealth.mockRejectedValue(new Error('dns'))
  mockServers.mockReturnValue([])
  mockRender.mockResolvedValue(Buffer.from('png'))
  const res = await GET(new Request('http://localhost/api/kindle/servers.png?w=600&h=744'))
  expect(res.status).toBe(200)
  expect(mockRender).toHaveBeenCalledWith([], [], { width: 600, height: 744 })
})
