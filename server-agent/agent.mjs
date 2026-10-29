// Reports this server's status to the kindle-dashboard server every minute
// (POST /api/servers/report). Runs in the container from compose.yaml, which
// gives it the host's /proc, /sys, network, PID namespace, disks (for SMART) and
// Docker socket. The host's files are read through /proc/1/root (the host's init):
// a bind mount of / would show the wrong tree under snap Docker (Oracle).

import { execFile } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, realpathSync, statfsSync } from 'node:fs'
import { request } from 'node:http'
import { arch, cpus } from 'node:os'
import { basename, dirname } from 'node:path'
import { promisify } from 'node:util'
import { containerFromApi, cpuPct, fitReport, mountDevice, netRate, parseCpu, parseMdstat, parseMeminfo, parseNetDev, smartFromJson } from './lib.mjs'

const config = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'))
const HOST = process.env.HOST_ROOT ?? '/proc/1/root'
const INTERVAL_MS = (config.intervalSec ?? 60) * 1000
const SAMPLE_MS = 1000
const CPU_SENSORS = ['coretemp', 'k10temp', 'zenpower', 'cpu_thermal', 'soc_thermal']

const run = promisify(execFile)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const read = (path) => readFileSync(path, 'utf8')

function tryRead(path) {
  try {
    return read(path).trim()
  } catch {
    return null
  }
}

const list = (dir) => (existsSync(dir) ? readdirSync(dir) : [])

// Physical network interfaces (skips lo, docker, veth, VPN tunnels such as nordlynx)
function interfaces() {
  return new Set(list('/sys/class/net').filter((name) => existsSync(`/sys/class/net/${name}/device`)))
}

function cpuTemp() {
  for (const hw of list('/sys/class/hwmon')) {
    if (!CPU_SENSORS.includes(tryRead(`/sys/class/hwmon/${hw}/name`))) continue
    const milli = Number(tryRead(`/sys/class/hwmon/${hw}/temp1_input`))
    if (milli) return Math.round(milli / 1000)
  }
  const zone = Number(tryRead('/sys/class/thermal/thermal_zone0/temp'))
  return zone ? Math.round(zone / 1000) : null
}

// "/dev/mapper/vg-lv" → "dm-0", "/dev/sda1" → "sda1"
function blockName(devPath) {
  if (devPath.startsWith('/dev/mapper/')) {
    const name = basename(devPath)
    const dm = list('/sys/block').find((d) => d.startsWith('dm-') && tryRead(`/sys/block/${d}/dm/name`) === name)
    if (dm) return dm
  }
  return basename(devPath)
}

// Physical disks under a block device, through LVM/RAID (slaves) and partitions
function physicalDisks(name) {
  const slaves = list(`/sys/class/block/${name}/slaves`)
  if (slaves.length) return [...new Set(slaves.flatMap(physicalDisks))].sort()
  if (existsSync(`/sys/class/block/${name}/partition`)) return [basename(dirname(realpathSync(`/sys/class/block/${name}`)))]
  return existsSync(`/sys/class/block/${name}`) ? [name] : []
}

async function smart(disk) {
  try {
    // smartctl exits non-zero for warnings too; its JSON is still on stdout
    const { stdout } = await run('smartctl', ['-j', '-H', '-A', `/dev/${disk}`]).catch((err) => ({ stdout: err.stdout ?? '' }))
    return smartFromJson(disk, JSON.parse(stdout))
  } catch {
    return smartFromJson(disk, {})
  }
}

function dockerContainers() {
  return new Promise((resolve) => {
    const req = request({ socketPath: '/var/run/docker.sock', path: '/containers/json?all=1' }, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        try {
          resolve(JSON.parse(body).map(containerFromApi))
        } catch {
          resolve([])
        }
      })
    })
    req.on('error', () => resolve([]))
    req.end()
  })
}

async function mountInfo(path, mountsText, arrays) {
  const stats = statfsSync(path === '/' ? HOST : `${HOST}${path}`)
  const device = mountDevice(mountsText, path)
  const name = device ? blockName(device) : '?'
  const disks = device && config.smart !== false ? await Promise.all(physicalDisks(name).map(smart)) : []
  return {
    path,
    device: name,
    totalBytes: stats.blocks * stats.bsize,
    usedBytes: (stats.blocks - stats.bfree) * stats.bsize,
    raid: arrays.find((a) => a.device === name) ?? null,
    disks,
  }
}

async function collect() {
  const ifaces = interfaces()
  const cpuA = parseCpu(read('/proc/stat'))
  const netA = parseNetDev(read('/proc/net/dev'), ifaces)
  await sleep(SAMPLE_MS)
  const cpuB = parseCpu(read('/proc/stat'))
  const netB = parseNetDev(read('/proc/net/dev'), ifaces)

  const arrays = existsSync('/proc/mdstat') ? parseMdstat(read('/proc/mdstat')) : []
  const mountsText = read('/proc/1/mounts')
  const mounts = []
  for (const path of config.mounts ?? ['/']) mounts.push(await mountInfo(path, mountsText, arrays))

  return fitReport({
    id: config.id,
    name: config.name ?? config.id,
    order: config.order ?? 100,
    hostname: tryRead(`${HOST}/etc/hostname`) ?? config.id,
    arch: arch(),
    uptimeSec: Math.round(Number(read('/proc/uptime').split(' ')[0])),
    cpu: { pct: cpuPct(cpuA, cpuB), cores: cpus().length, load1: Number(read('/proc/loadavg').split(' ')[0]), tempC: cpuTemp() },
    mem: parseMeminfo(read('/proc/meminfo')),
    net: netRate(netA, netB, SAMPLE_MS / 1000),
    mounts,
    containers: await dockerContainers(),
  })
}

async function send(report) {
  const res = await fetch(`${config.dashboardUrl.replace(/\/+$/, '')}/api/servers/report`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.reportToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`dashboard answered ${res.status}: ${await res.text()}`)
}

if (process.argv.includes('--once')) {
  console.log(JSON.stringify(await collect(), null, 2))
} else {
  for (;;) {
    const started = Date.now()
    try {
      await send(await collect())
    } catch (err) {
      console.error(new Date().toISOString(), err.message)
    }
    await sleep(Math.max(1000, INTERVAL_MS - (Date.now() - started)))
  }
}
