/**
 * @jest-environment node
 */

import { GET } from '@/app/api/kindle/dashboard.png/route'
import { getCachedSteamData, getCachedLeagueData } from '@/lib/server-cache'
import { renderDashboardPng } from '@/lib/dashboard-image'

jest.mock('@/lib/server-cache')
jest.mock('@/lib/dashboard-image', () => ({
  DEFAULT_IMAGE_SIZE: { width: 600, height: 744 },
  renderDashboardPng: jest.fn(),
}))

const mockSteam = getCachedSteamData as jest.MockedFunction<typeof getCachedSteamData>
const mockLeague = getCachedLeagueData as jest.MockedFunction<typeof getCachedLeagueData>
const mockRender = renderDashboardPng as jest.MockedFunction<typeof renderDashboardPng>

beforeEach(() => {
  mockSteam.mockResolvedValue({ personaname: 'Tester' } as never)
  mockLeague.mockRejectedValue(new Error('Riot 429'))
  mockRender.mockReset().mockResolvedValue(Buffer.from('png'))
})

it('renders the PNG at the requested size, with missing data as null', async () => {
  const res = await GET(new Request('http://localhost/api/kindle/dashboard.png?w=600&h=700'))
  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toBe('image/png')
  expect(mockRender).toHaveBeenCalledWith({ personaname: 'Tester' }, null, { width: 600, height: 700 })
})

it('defaults and clamps the size', async () => {
  await GET(new Request('http://localhost/api/kindle/dashboard.png?w=99999'))
  expect(mockRender).toHaveBeenCalledWith(expect.anything(), null, { width: 2000, height: 744 })
})

it('answers 500 when rendering fails', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockRender.mockRejectedValue(new Error('satori'))
  const res = await GET(new Request('http://localhost/api/kindle/dashboard.png'))
  expect(res.status).toBe(500)
})
