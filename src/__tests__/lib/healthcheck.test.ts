/**
 * @jest-environment node
 */

import { parseHealthTargets, checkTarget } from '@/lib/healthcheck'

it('parses label=url pairs', () => {
  expect(parseHealthTargets('site=https://a.com, dash = https://b.com/x ,bad')).toEqual([
    { label: 'site', url: 'https://a.com' },
    { label: 'dash', url: 'https://b.com/x' },
  ])
  expect(parseHealthTargets('')).toEqual([])
})

it('maps responses, redirects and failures', async () => {
  const target = { label: 'site', url: 'https://a.com' }
  const answer = (status: number) => jest.fn().mockResolvedValue(new Response(null, { status }))
  expect(await checkTarget(target, answer(200))).toMatchObject({ label: 'site', ok: true, status: 200 })
  expect(await checkTarget(target, answer(301))).toMatchObject({ ok: true, status: 301 })
  expect(await checkTarget(target, answer(502))).toMatchObject({ ok: false, status: 502 })
  expect(await checkTarget(target, jest.fn().mockRejectedValue(new Error('timeout')))).toEqual({ label: 'site', ok: false, status: null, ms: null })
})
