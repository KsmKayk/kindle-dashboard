import type { ContainerInfo, DiskHealth, MountInfo, RaidInfo, ServerReport, StoredServer } from '@/types'

// When a Servers tab card switches to its dark (attention) state.

export const STALE_MS = 3 * 60_000
const FULL_PCT = 90

export const usedPct = (used: number, total: number) => (total > 0 ? (used / total) * 100 : 0)

export const isStale = (server: StoredServer, now: number) => now - server.receivedAt > STALE_MS

export const diskNeedsAttention = (d: DiskHealth) => d.unreadable === true || d.healthy === false || (d.reallocated ?? 0) > 0 || (d.pending ?? 0) > 0

export const raidNeedsAttention = (r: RaidInfo) => r.state.includes('_') || r.active < r.total || r.syncPct !== null

// The agent reports a configured mount point it could not find (e.g. an unmounted RAID) as device '?'
export const mountMissing = (m: MountInfo) => m.device === '?'

export const mountNeedsAttention = (m: MountInfo) =>
  mountMissing(m) || usedPct(m.usedBytes, m.totalBytes) >= FULL_PCT || (m.raid !== null && raidNeedsAttention(m.raid)) || m.disks.some(diskNeedsAttention)

export const ramNeedsAttention = (r: ServerReport) => usedPct(r.mem.usedBytes, r.mem.totalBytes) >= FULL_PCT

export const containerDown = (c: ContainerInfo) => c.state !== 'running'

// "OK 35°C", "FALHA 35°C" (failed SMART check), "40 realoc. 35°C" (passed, but bad sectors),
// "sem resposta" (answered before, no longer does)
export function smartLabel(d: DiskHealth): string {
  if (d.unreadable) return 'sem resposta'
  const sectors = [d.reallocated ? `${d.reallocated} realoc.` : null, d.pending ? `${d.pending} pend.` : null]
  const health = d.healthy === false ? ['FALHA'] : sectors.some(Boolean) ? sectors : [d.healthy === null ? null : 'OK']
  return [...health, d.tempC === null ? null : `${d.tempC}°C`].filter(Boolean).join(' ')
}
