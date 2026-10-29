import { isStale, diskNeedsAttention, raidNeedsAttention, mountNeedsAttention, ramNeedsAttention, containerDown, usedPct, STALE_MS } from '@/lib/servers'
import type { MountInfo, ServerReport } from '@/types'

const mount: MountInfo = {
  path: '/mnt/raid1', device: 'md0', totalBytes: 100, usedBytes: 22,
  raid: { device: 'md0', level: 'RAID 1', state: 'UU', active: 2, total: 2, members: ['sdb1', 'sdc1'], syncPct: null },
  disks: [{ device: 'sdb', healthy: true, tempC: 35, reallocated: 0, pending: 0 }],
}

it('staleness after 3 minutes without a report', () => {
  const now = 1_000_000_000
  expect(isStale({ receivedAt: now - STALE_MS + 1 } as never, now)).toBe(false)
  expect(isStale({ receivedAt: now - STALE_MS - 1 } as never, now)).toBe(true)
})

it('disk attention: failed SMART or bad sectors', () => {
  expect(diskNeedsAttention(mount.disks[0])).toBe(false)
  expect(diskNeedsAttention({ ...mount.disks[0], healthy: false })).toBe(true)
  expect(diskNeedsAttention({ ...mount.disks[0], pending: 1 })).toBe(true)
  expect(diskNeedsAttention({ device: 'sda', healthy: null, tempC: null, reallocated: null, pending: null })).toBe(false)
})

it('raid attention: degraded or syncing', () => {
  expect(raidNeedsAttention(mount.raid!)).toBe(false)
  expect(raidNeedsAttention({ ...mount.raid!, state: 'U_', active: 1 })).toBe(true)
  expect(raidNeedsAttention({ ...mount.raid!, syncPct: 40 })).toBe(true)
})

it('mount attention: 90% full, RAID or disks', () => {
  expect(usedPct(22, 100)).toBe(22)
  expect(mountNeedsAttention(mount)).toBe(false)
  expect(mountNeedsAttention({ ...mount, usedBytes: 90 })).toBe(true)
  expect(mountNeedsAttention({ ...mount, raid: { ...mount.raid!, state: '_U' } })).toBe(true)
})

it('ram attention at 90%', () => {
  expect(ramNeedsAttention({ mem: { totalBytes: 100, usedBytes: 89 } } as ServerReport)).toBe(false)
  expect(ramNeedsAttention({ mem: { totalBytes: 100, usedBytes: 90 } } as ServerReport)).toBe(true)
})

it('containerDown', () => {
  expect(containerDown({ name: 'a', state: 'running', status: '', ports: [] })).toBe(false)
  expect(containerDown({ name: 'a', state: 'exited', status: '', ports: [] })).toBe(true)
})
