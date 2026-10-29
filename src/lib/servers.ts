import type { ContainerInfo, DiskHealth, MountInfo, RaidInfo, ServerReport, StoredServer } from '@/types'

// When a Servers tab card switches to its dark (attention) state.

export const STALE_MS = 3 * 60_000
const FULL_PCT = 90

export const usedPct = (used: number, total: number) => (total > 0 ? (used / total) * 100 : 0)

export const isStale = (server: StoredServer, now: number) => now - server.receivedAt > STALE_MS

export const diskNeedsAttention = (d: DiskHealth) => d.healthy === false || (d.reallocated ?? 0) > 0 || (d.pending ?? 0) > 0

export const raidNeedsAttention = (r: RaidInfo) => r.state.includes('_') || r.active < r.total || r.syncPct !== null

export const mountNeedsAttention = (m: MountInfo) =>
  usedPct(m.usedBytes, m.totalBytes) >= FULL_PCT || (m.raid !== null && raidNeedsAttention(m.raid)) || m.disks.some(diskNeedsAttention)

export const ramNeedsAttention = (r: ServerReport) => usedPct(r.mem.usedBytes, r.mem.totalBytes) >= FULL_PCT

export const containerDown = (c: ContainerInfo) => c.state !== 'running'
