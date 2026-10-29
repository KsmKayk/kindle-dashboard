// Reporting periods in the server's local time (TZ): the week starts on Monday
// 00:00, the month on the 1st, the year is the last 365 days.

const DAY_MS = 86_400_000

export interface Periods { week: Date; month: Date; year: Date }

export function periodStarts(now: Date): Periods {
  const week = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  week.setDate(week.getDate() - ((week.getDay() + 6) % 7))
  return {
    week,
    month: new Date(now.getFullYear(), now.getMonth(), 1),
    year: new Date(now.getTime() - 365 * DAY_MS),
  }
}

// Start of the window the frequent refresh covers: the earlier of week and month
export function recentStart(now: Date): Date {
  const { week, month } = periodStarts(now)
  return week < month ? week : month
}

const pad = (n: number) => String(n).padStart(2, '0')

export function localDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// The last `count` calendar months as [first day, last day], newest first
export function monthWindows(now: Date, count: number): [string, string][] {
  const windows: [string, string][] = []
  for (let i = 0; i < count; i++) {
    const first = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const last = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    windows.push([localDay(first), localDay(last)])
  }
  return windows
}
