// HTTP checks of the sites in HEALTHCHECK_URLS ("label=url,label=url"), shown
// at the bottom of the Servers tab. 2xx/3xx = up; errors, 4xx/5xx and timeouts = down.

export interface HealthTarget { label: string; url: string }
export interface HealthResult { label: string; ok: boolean; status: number | null; ms: number | null }

const TIMEOUT_MS = 5_000

export function parseHealthTargets(value = process.env.HEALTHCHECK_URLS ?? ''): HealthTarget[] {
  return value.split(',').flatMap((entry) => {
    const i = entry.indexOf('=')
    if (i <= 0) return []
    return [{ label: entry.slice(0, i).trim(), url: entry.slice(i + 1).trim() }]
  })
}

export async function checkTarget(target: HealthTarget, fetchImpl: typeof fetch = fetch): Promise<HealthResult> {
  const started = Date.now()
  try {
    const res = await fetchImpl(target.url, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
    return { label: target.label, ok: res.status < 400, status: res.status, ms: Date.now() - started }
  } catch {
    return { label: target.label, ok: false, status: null, ms: null }
  }
}
