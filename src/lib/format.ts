// Short labels for the KOReader images (Portuguese, like the rest of their text).

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const pad = (n: number) => String(n).padStart(2, '0')
const toMs = (t: Date | string | number) => (t instanceof Date ? t.getTime() : typeof t === 'number' ? t : new Date(t).getTime())

// One decimal under 10, none above: 4.1k, 41M
function short(v: number): string {
  return v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10)
}

export function compactNumber(n: number): string {
  const units: [number, string][] = [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']]
  for (const [i, [size, unit]] of units.entries()) {
    if (n < size) continue
    const label = short(n / size)
    // Rounding can reach the next unit (999_950 -> 1000k): show it as 1M
    if (label === '1000' && i > 0) return `1${units[i - 1][1]}`
    return `${label}${unit}`
  }
  return String(Math.round(n))
}

// How long ago: 2min, 5h, 2d
export function ageLabel(from: Date | string | number, now: Date): string {
  const ms = Math.max(0, now.getTime() - toMs(from))
  if (ms < HOUR_MS) return `${Math.floor(ms / MINUTE_MS)}min`
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)}h`
  return `${Math.floor(ms / DAY_MS)}d`
}

// Time left: em 15min, em 1h48, em 3d; "agora" once past
export function untilLabel(to: string, now: Date): string {
  const ms = toMs(to) - now.getTime()
  if (ms <= 0) return 'agora'
  if (ms < HOUR_MS) return `em ${Math.ceil(ms / MINUTE_MS)}min`
  if (ms < DAY_MS) return `em ${Math.floor(ms / HOUR_MS)}h${pad(Math.floor((ms % HOUR_MS) / MINUTE_MS))}`
  return `em ${Math.floor(ms / DAY_MS)}d`
}

export function clockTime(at: Date | string | number): string {
  const d = new Date(toMs(at))
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// qui 03:59
export function weekdayTime(at: string): string {
  return `${WEEKDAYS[new Date(at).getDay()]} ${clockTime(at)}`
}

// Hours as 9h, or days as 1.4d from 24 h on
export function durationLabel(hours: number): string {
  return hours < 24 ? `${Math.round(hours)}h` : `${short(hours / 24)}d`
}

export function bytesLabel(bytes: number): string {
  const units: [number, string][] = [[1024 ** 4, 'TB'], [1024 ** 3, 'GB'], [1024 ** 2, 'MB']]
  for (const [i, [size, unit]] of units.entries()) {
    if (bytes < size) continue
    const label = short(bytes / size)
    // Rounding can reach the next unit (1023.9 MB -> 1024): show it as 1 GB
    if (label === '1024' && i > 0) return `1 ${units[i - 1][1]}`
    return `${label} ${unit}`
  }
  return `${Math.round(bytes / 1024)} KB`
}

export function rateLabel(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1024 ** 2) return `${short(bytesPerSecond / 1024 ** 2)} MB/s`
  return `${short(bytesPerSecond / 1024)} KB/s`
}

export function uptimeLabel(seconds: number): string {
  return seconds >= 86_400 ? `${Math.floor(seconds / 86_400)}d` : `${Math.floor(seconds / 3600)}h`
}
