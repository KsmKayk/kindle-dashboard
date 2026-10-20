/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { proxy, config } from '@/proxy'
import { checkAccess } from '@/lib/access-token'

const none = { authorization: null, query: null, cookie: null }

describe('checkAccess', () => {
  it('is open when no token is configured', () => {
    expect(checkAccess(none, null)).toBe('open')
  })

  it('accepts the token from a Bearer header, the query or the cookie', () => {
    expect(checkAccess({ ...none, authorization: 'Bearer s3cret' }, 's3cret')).toBe('header')
    expect(checkAccess({ ...none, query: 's3cret' }, 's3cret')).toBe('query')
    expect(checkAccess({ ...none, cookie: 's3cret' }, 's3cret')).toBe('cookie')
  })

  it('denies a missing or wrong token', () => {
    expect(checkAccess(none, 's3cret')).toBe('denied')
    expect(checkAccess({ ...none, query: 's3cre' }, 's3cret')).toBe('denied')
    expect(checkAccess({ ...none, authorization: 'Basic s3cret' }, 's3cret')).toBe('denied')
  })
})

describe('proxy', () => {
  const request = (url: string, headers: Record<string, string> = {}) =>
    new NextRequest(new URL(url, 'http://localhost:3000'), { headers })

  beforeEach(() => { process.env.KINDLE_API_TOKEN = 's3cret' })
  afterEach(() => { delete process.env.KINDLE_API_TOKEN })

  it('only guards the Spotify routes', () => {
    expect(config.matcher).toContain('/api/spotify/control')
    expect(config.matcher).toContain('/kindle/spotify')
    expect(config.matcher).not.toContain('/api/spotify/callback')
    expect(config.matcher).not.toContain('/kindle')
  })

  it('answers 401 JSON on the API without a token', async () => {
    const res = proxy(request('/api/spotify'))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toContain('token')
  })

  it('answers 401 text on pages without a token', () => {
    const res = proxy(request('/kindle/spotify'))
    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toContain('text/plain')
  })

  it('lets a Bearer token through without setting a cookie', () => {
    const res = proxy(request('/api/spotify', { authorization: 'Bearer s3cret' }))
    expect(res.status).toBe(200)
    expect(res.cookies.get('kindle_token')).toBeUndefined()
  })

  it('saves a ?token= in a cookie', () => {
    const res = proxy(request('/spotify?token=s3cret', { 'x-forwarded-proto': 'https' }))
    expect(res.status).toBe(200)
    const cookie = res.cookies.get('kindle_token')
    expect(cookie?.value).toBe('s3cret')
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.secure).toBe(true)
  })

  it('accepts the cookie', () => {
    const res = proxy(request('/api/spotify/lyrics', { cookie: 'kindle_token=s3cret' }))
    expect(res.status).toBe(200)
  })

  it('stays open when KINDLE_API_TOKEN is unset', () => {
    delete process.env.KINDLE_API_TOKEN
    expect(proxy(request('/api/spotify/control')).status).toBe(200)
  })
})
