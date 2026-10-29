import { periodStarts, recentStart, localDay, monthWindows } from '@/lib/periods'

// Wednesday 29 Oct 2026, 14:30 local time
const now = new Date(2026, 9, 29, 14, 30)

describe('periodStarts', () => {
  it('starts the week on Monday 00:00 and the month on the 1st', () => {
    const p = periodStarts(now)
    expect(p.week).toEqual(new Date(2026, 9, 26))
    expect(p.month).toEqual(new Date(2026, 9, 1))
    expect(now.getTime() - p.year.getTime()).toBe(365 * 86_400_000)
  })

  it('keeps Sunday in the week that started the Monday before', () => {
    expect(periodStarts(new Date(2026, 10, 1, 9)).week).toEqual(new Date(2026, 9, 26))
  })
})

describe('recentStart', () => {
  it('is the earlier of week and month', () => {
    expect(recentStart(now)).toEqual(new Date(2026, 9, 1))
    // Tue 3 Nov: the week began on Mon 2 Nov, the month on Sun 1 Nov
    expect(recentStart(new Date(2026, 10, 3))).toEqual(new Date(2026, 10, 1))
    // Wed 3 Feb 2027: week and month both start on Mon 1 Feb
    expect(recentStart(new Date(2027, 1, 3))).toEqual(new Date(2027, 1, 1))
  })
})

describe('localDay', () => {
  it('formats YYYY-MM-DD in local time', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('monthWindows', () => {
  it('lists calendar months, newest first, as date ranges', () => {
    expect(monthWindows(now, 3)).toEqual([
      ['2026-10-01', '2026-10-31'],
      ['2026-09-01', '2026-09-30'],
      ['2026-08-01', '2026-08-31'],
    ])
  })
})
