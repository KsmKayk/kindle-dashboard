import { isStale, diskNeedsAttention, raidNeedsAttention, mountNeedsAttention, mountMissing, ramNeedsAttention, containerDown, usedPct, smartLabel, STALE_MS } from '@/lib/servers'
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
  expect(diskNeedsAttention({ device: 'sda', healthy: null, tempC: null, reallocated: null, pending: null, unreadable: true })).toBe(true)
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

it('a configured mount that is not mounted needs attention', () => {
  const missing: MountInfo = { path: '/mnt/raid1', device: '?', totalBytes: 0, usedBytes: 0, raid: null, disks: [] }
  expect(mountMissing(missing)).toBe(true)
  expect(mountMissing(mount)).toBe(false)
  expect(mountNeedsAttention(missing)).toBe(true)
})

it('smartLabel: FALHA only for a failed check, sector counts otherwise', () => {
  const disk = mount.disks[0]
  expect(smartLabel(disk)).toBe('OK 35°C')
  expect(smartLabel({ ...disk, healthy: false })).toBe('FALHA 35°C')
  expect(smartLabel({ ...disk, reallocated: 40 })).toBe('40 realoc. 35°C')
  expect(smartLabel({ ...disk, pending: 2 })).toBe('2 pend. 35°C')
  expect(smartLabel({ ...disk, reallocated: 40, pending: 2, tempC: null })).toBe('40 realoc. 2 pend.')
  expect(smartLabel({ device: 'sda', healthy: null, tempC: null, reallocated: null, pending: null })).toBe('')
  expect(smartLabel({ device: 'sda', healthy: null, tempC: null, reallocated: null, pending: null, unreadable: true })).toBe('sem resposta')
})
