/**
 * @jest-environment node
 */

import { imageSizeFrom, pngResponse, DEFAULT_IMAGE_SIZE } from '@/lib/kindle-png'

describe('imageSizeFrom', () => {
  it('reads w and h', () => {
    expect(imageSizeFrom(new URLSearchParams('w=600&h=700'))).toEqual({ width: 600, height: 700 })
  })

  it('defaults missing values and clamps to 200–2000', () => {
    expect(imageSizeFrom(new URLSearchParams(''))).toEqual(DEFAULT_IMAGE_SIZE)
    expect(imageSizeFrom(new URLSearchParams('w=99999&h=5'))).toEqual({ width: 2000, height: 200 })
  })
})

describe('pngResponse', () => {
  it('answers the PNG without caching', async () => {
    const res = await pngResponse('test', async () => Buffer.from('png'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('png')
  })

  it('answers 500 when rendering fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const res = await pngResponse('test', async () => { throw new Error('satori') })
    expect(res.status).toBe(500)
  })
})
