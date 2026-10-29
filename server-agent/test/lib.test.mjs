import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMdstat, parseCpu, cpuPct, parseMeminfo, parseNetDev, netRate, smartFromJson, containerFromApi, mountDevice, mountPath, listContainers, fitReport } from '../lib.mjs'

const MDSTAT = `Personalities : [raid1] [raid0] [raid6] [raid5] [raid4] [raid10]
md0 : active raid1 sdb1[2] sdc1[0]
      1953381376 blocks super 1.2 [2/2] [UU]
      bitmap: 0/15 pages [0KB], 65536KB chunk

unused devices: <none>
`

const MDSTAT_DEGRADED = `md0 : active raid1 sdc1[0] sdb1[2](F)
      1953381376 blocks super 1.2 [2/1] [U_]
      [=>...................]  recovery = 7.5% (147000/1953381376) finish=200min speed=150000K/sec
`

test('parseMdstat reads a healthy RAID 1', () => {
  assert.deepEqual(parseMdstat(MDSTAT), [{ device: 'md0', level: 'RAID 1', state: 'UU', active: 2, total: 2, members: ['sdb1', 'sdc1'], syncPct: null }])
})

test('parseMdstat reads a degraded, recovering array', () => {
  const [md] = parseMdstat(MDSTAT_DEGRADED)
  assert.equal(md.state, 'U_')
  assert.equal(md.active, 1)
  assert.equal(md.total, 2)
  assert.equal(md.syncPct, 7.5)
})

test('cpu usage from two /proc/stat samples', () => {
  const a = parseCpu('cpu  100 0 100 700 100 0 0 0 0 0\ncpu0 1 2 3')
  const b = parseCpu('cpu  150 0 150 750 150 0 0 0 0 0\n')
  assert.deepEqual(a, { idle: 800, total: 1000 })
  assert.equal(cpuPct(a, b), 50)
})

test('parseMeminfo uses MemAvailable', () => {
  const mem = parseMeminfo('MemTotal:        5883984 kB\nMemFree:          129000 kB\nMemAvailable:    3429288 kB\n')
  assert.deepEqual(mem, { totalBytes: 5883984 * 1024, usedBytes: (5883984 - 3429288) * 1024 })
})

test('network counters only for the given interfaces', () => {
  const text = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 386263116 1973208    0    0    0     0          0         0 386263116 1973208    0    0    0     0       0          0
enp2s0f0: 90053037150 71513284    0 485844    0     0          0     10575 52113023114 57981406    1    0    0     0       0          0
nordlynx: 74492947644 60207200    0    0    0     0          0         0 30870636412 43474506    0 14734    0     0       0          0
`
  const a = parseNetDev(text, new Set(['enp2s0f0']))
  assert.deepEqual(a, { rx: 90053037150, tx: 52113023114 })
  assert.deepEqual(netRate(a, { rx: a.rx + 2048, tx: a.tx + 1024 }, 2), { rxBps: 1024, txBps: 512 })
})

test('smartFromJson reads health, temperature and sector counts', () => {
  const json = {
    smart_status: { passed: true },
    temperature: { current: 35 },
    ata_smart_attributes: { table: [{ id: 5, raw: { value: 0 } }, { id: 197, raw: { value: 2 } }] },
  }
  assert.deepEqual(smartFromJson('sdb', json), { device: 'sdb', healthy: true, tempC: 35, reallocated: 0, pending: 2 })
  assert.deepEqual(smartFromJson('sda', {}), { device: 'sda', healthy: null, tempC: null, reallocated: null, pending: null })
})

test('containerFromApi lists unique published ports', () => {
  const c = containerFromApi({
    Id: 'abc', Names: ['/kindle-dashboard-dashboard-1'], State: 'running', Status: 'Up 3 days',
    Ports: [{ PrivatePort: 3000, PublicPort: 3400 }, { PrivatePort: 3000, PublicPort: 3400 }, { PrivatePort: 5432 }],
  })
  assert.deepEqual(c, { name: 'kindle-dashboard-dashboard-1', state: 'running', status: 'Up 3 days', ports: [3400] })
})

test('mountDevice finds the device of a mount point', () => {
  const mounts = '/dev/mapper/ubuntu--vg-ubuntu--lv / ext4 rw 0 0\n/dev/md0 /mnt/raid1 ext4 rw 0 0\nproc /proc proc rw 0 0\n'
  assert.equal(mountDevice(mounts, '/mnt/raid1'), '/dev/md0')
  assert.equal(mountDevice(mounts, '/'), '/dev/mapper/ubuntu--vg-ubuntu--lv')
  assert.equal(mountDevice(mounts, '/nope'), null)
})

test('fitReport keeps a report within what the dashboard accepts', () => {
  const long = 'x'.repeat(300)
  const container = { name: long, state: 'running', status: long, ports: Array.from({ length: 70 }, (_, i) => i + 1) }
  const report = {
    id: 'kayk-server', name: long, order: 2, hostname: long, arch: 'x64', uptimeSec: 12.6,
    cpu: { pct: -0.1, cores: 4, load1: 0.5, tempC: 41 },
    mem: { totalBytes: 100, usedBytes: -5 },
    net: { rxBps: 10, txBps: 5 },
    mounts: Array.from({ length: 20 }, () => ({
      path: '/', device: 'dm-0', totalBytes: 100, usedBytes: 20,
      raid: { device: 'md0', level: 'RAID 1', state: 'UU', active: 2, total: 2, members: Array.from({ length: 40 }, (_, i) => `sd${i}`), syncPct: null },
      disks: [{ device: 'sdb', healthy: true, tempC: 35, reallocated: -1, pending: 0 }],
    })),
    containers: Array.from({ length: 120 }, () => container),
  }
  const fit = fitReport(report)
  assert.equal(fit.name.length, 60)
  assert.equal(fit.hostname.length, 200)
  assert.equal(fit.uptimeSec, 13)
  assert.equal(fit.cpu.pct, 0)
  assert.equal(fit.mem.usedBytes, 0)
  assert.equal(fit.mounts.length, 16)
  assert.equal(fit.mounts[0].raid.members.length, 32)
  assert.equal(fit.mounts[0].disks[0].reallocated, 0)
  assert.equal(fit.containers.length, 100)
  assert.equal(fit.containers[0].name.length, 200)
  assert.equal(fit.containers[0].ports.length, 64)
  assert.equal(fitReport({ ...report, mounts: [{ ...report.mounts[0], raid: null }] }).mounts[0].raid, null)
})

test('parseMdstat: dashed member names, inactive arrays, raid0 and checks', () => {
  const text = `Personalities : [raid1] [raid0]
md1 : active raid1 dm-3[1] dm-2[0]
      1000 blocks super 1.2 [2/2] [UU]
      [==>..................]  check = 12.5% (125/1000) finish=10min speed=1000K/sec

md127 : inactive sdd1[0](S)
      1000 blocks super 1.2

md2 : active raid0 sde1[1] sdf1[0]
      2000 blocks super 1.2 512k chunks

unused devices: <none>
`
  assert.deepEqual(parseMdstat(text), [
    { device: 'md1', level: 'RAID 1', state: 'UU', active: 2, total: 2, members: ['dm-2', 'dm-3'], syncPct: null },
    { device: 'md2', level: 'RAID 0', state: '', active: 2, total: 2, members: ['sde1', 'sdf1'], syncPct: null },
  ])
})

test('parseCpu leaves out guest time (already counted in user)', () => {
  assert.deepEqual(parseCpu('cpu  100 0 100 700 100 0 0 0 50 50\n'), { idle: 800, total: 1000 })
})

test('mountDevice decodes escaped spaces; mountPath drops trailing slashes', () => {
  const mounts = '/dev/sdd1 /mnt/my\\040disk ext4 rw 0 0\n'
  assert.equal(mountDevice(mounts, '/mnt/my disk'), '/dev/sdd1')
  assert.equal(mountPath('/mnt/raid1/'), '/mnt/raid1')
  assert.equal(mountPath('/'), '/')
  assert.equal(mountPath('//'), '/')
})

test('listContainers leaves out ignored names', () => {
  const api = [
    { Id: 'a', Names: ['/jellyfin'], State: 'running', Status: 'Up', Ports: [] },
    { Id: 'b', Names: ['/n8n'], State: 'exited', Status: 'Exited', Ports: [] },
  ]
  assert.deepEqual(listContainers(api, ['n8n']).map((c) => c.name), ['jellyfin'])
  assert.equal(listContainers(api).length, 2)
})
