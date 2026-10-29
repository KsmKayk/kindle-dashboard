import { compactNumber, ageLabel, untilLabel, weekdayTime, clockTime, durationLabel, bytesLabel, rateLabel, uptimeLabel } from '@/lib/format'

const now = new Date(2026, 9, 29, 14, 30)

it('compactNumber', () => {
  expect(compactNumber(950)).toBe('950')
  expect(compactNumber(4_120)).toBe('4.1k')
  expect(compactNumber(8_240_000)).toBe('8.2M')
  expect(compactNumber(41_400_000)).toBe('41M')
  expect(compactNumber(1_630_000_000)).toBe('1.6B')
  expect(compactNumber(999_950)).toBe('1M')
})

it('ageLabel', () => {
  expect(ageLabel(new Date(2026, 9, 29, 14, 28), now)).toBe('2min')
  expect(ageLabel(new Date(2026, 9, 29, 9, 30).getTime(), now)).toBe('5h')
  expect(ageLabel(now.getTime() - 59.6 * 60_000, now)).toBe('59min')
  expect(ageLabel(new Date(2026, 9, 27, 14, 30).toISOString(), now)).toBe('2d')
})

it('untilLabel', () => {
  expect(untilLabel(new Date(2026, 9, 29, 16, 18).toISOString(), now)).toBe('em 1h48')
  expect(untilLabel(new Date(2026, 9, 29, 14, 45).toISOString(), now)).toBe('em 15min')
  expect(untilLabel(new Date(2026, 9, 29, 14, 0).toISOString(), now)).toBe('agora')
})

it('weekdayTime and clockTime', () => {
  expect(weekdayTime(new Date(2026, 10, 5, 3, 59).toISOString())).toBe('qui 03:59')
  expect(clockTime(new Date(2026, 9, 29, 7, 5).getTime())).toBe('07:05')
})

it('durationLabel', () => {
  expect(durationLabel(9.4)).toBe('9h')
  expect(durationLabel(33.6)).toBe('1.4d')
})

it('bytesLabel', () => {
  expect(bytesLabel(512 * 1024 ** 2)).toBe('512 MB')
  expect(bytesLabel(5.6 * 1024 ** 3)).toBe('5.6 GB')
  expect(bytesLabel(339 * 1024 ** 3)).toBe('339 GB')
  expect(bytesLabel(1.82 * 1024 ** 4)).toBe('1.8 TB')
  expect(bytesLabel(1024 ** 3 - 1)).toBe('1 GB')
})

it('rateLabel and uptimeLabel', () => {
  expect(rateLabel(1_258_291)).toBe('1.2 MB/s')
  expect(rateLabel(20_480)).toBe('20 KB/s')
  expect(uptimeLabel(41 * 86_400 + 3600)).toBe('41d')
  expect(uptimeLabel(5 * 3600)).toBe('5h')
})
