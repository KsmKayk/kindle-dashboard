import { getCurrentLineIndex } from '@/components/spotify/LyricsDisplay'

const lyrics = [
  { time: 5, text: 'one' },
  { time: 10, text: 'two' },
  { time: 15, text: 'three' },
]

describe('getCurrentLineIndex', () => {
  it('is -1 before the first line starts', () => {
    expect(getCurrentLineIndex(lyrics, 2)).toBe(-1)
  })

  it('returns the last line whose time has passed', () => {
    expect(getCurrentLineIndex(lyrics, 5)).toBe(0)
    expect(getCurrentLineIndex(lyrics, 12.5)).toBe(1)
    expect(getCurrentLineIndex(lyrics, 99)).toBe(2)
  })
})
