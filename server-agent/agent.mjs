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
import { cpuPct, fitReport, listContainers, mountDevice, mountPath, netRate, nextSmart, parseCpu, parseMdstat, parseMeminfo, parseNetDev, smartOutcome } from './lib.mjs'

const config = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'))
const HOST = process.env.HOST_ROOT ?? '/proc/1/root'
const INTERVAL_MS = (config.intervalSec ?? 60) * 1000
const SAMPLE_MS = 1000
const CPU_SENSORS = ['coretemp', 'k10temp', 'zenpower', 'cpu_thermal', 'soc_thermal']

const run = promisify(execFile)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const read = (path) => readFileSync(path, 'utf8')
// Errors only (stderr): the agent is silent while reports go through
const log = (message) => console.error(new Date().toISOString(), message)

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

// smartctl can hang on a failing disk: kill it, and never wait longer than this
const SMART_TIMEOUT_MS = 20_000
// SMART is read again only after this long (and never wakes a sleeping disk: -n standby)
const SMART_TTL_MS = 15 * 60_000
const smartCache = new Map()  // disk → { value, at }: what was last reported, and when it was read
const lastReading = new Map() // disk → { value, at }: the last real answer, and when it came
const smartInFlight = new Map()

// → { kind: 'ok', value } | { kind: 'standby' } | { kind: 'failed' }
async function readSmart(disk) {
  // smartctl exits non-zero for warnings and for a disk in standby; its JSON is still on stdout
  const { stdout } = await run('smartctl', ['-j', '-n', 'standby', '-H', '-A', `/dev/${disk}`], { timeout: SMART_TIMEOUT_MS, killSignal: 'SIGKILL' })
    .catch((err) => ({ stdout: err.stdout ?? '' }))
  return smartOutcome(disk, stdout)
}

async function smart(disk) {
  const saved = smartCache.get(disk)
  if (saved && Date.now() - saved.at < SMART_TTL_MS) return saved.value
  // A smartctl still stuck from an earlier report is not started again
  if (smartInFlight.has(disk)) return nextSmart(disk, { kind: 'failed' }, lastReading.get(disk) ?? null, Date.now()).value
  const reading = readSmart(disk)
    .catch(() => ({ kind: 'failed' }))
    .finally(() => smartInFlight.delete(disk))
  smartInFlight.set(disk, reading)
  let timer
  const timeout = new Promise((resolve) => (timer = setTimeout(() => resolve({ kind: 'failed' }), SMART_TIMEOUT_MS + 5_000)))
  const outcome = await Promise.race([reading, timeout]).finally(() => clearTimeout(timer))
  const { value, last } = nextSmart(disk, outcome, lastReading.get(disk) ?? null, Date.now())
  if (last) lastReading.set(disk, last)
  smartCache.set(disk, { value, at: Date.now() })
  return value
}

// Docker containers; [] (and a log line) when the Docker API cannot be read
function dockerContainers() {
  return new Promise((resolve) => {
    const fail = (err) => {
      log(`docker: ${err.message}`)
      resolve([])
    }
    const req = request({ socketPath: '/var/run/docker.sock', path: '/containers/json?all=1' }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => (body += chunk))
      res.on('error', fail)
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) throw new Error(`Docker API answered ${res.statusCode}`)
          resolve(listContainers(JSON.parse(body), config.ignoreContainers ?? []))
        } catch (err) {
          fail(err)
        }
      })
    })
    req.setTimeout(5_000, () => req.destroy(new Error('Docker API timed out')))
    req.on('error', fail)
    req.end()
  })
}

// A configured mount point that is not mounted (e.g. a RAID that failed to assemble)
// or cannot be read: the dashboard shows it as "não montado"
const missingMount = (path) => ({ path, device: '?', totalBytes: 0, usedBytes: 0, raid: null, disks: [] })

async function mountInfo(path, mountsText, arrays) {
  const device = mountDevice(mountsText, path)
  // Without this check statfs would measure the parent filesystem
  if (!device) return missingMount(path)
  const stats = statfsSync(path === '/' ? HOST : `${HOST}${path}`)
  const name = blockName(device)
  const disks = config.smart !== false ? await Promise.all(physicalDisks(name).map(smart)) : []
  return {
    path,
    device: name,
    totalBytes: stats.blocks * stats.bsize,
    usedBytes: (stats.blocks - stats.bfree) * stats.bsize,
    raid: arrays.find((a) => a.device === name) ?? null,
    disks,
  }
}

// CPU and network rates come from the counters' change since the previous report
// (no waiting in between); the first report takes a 1 s sample instead.
let previous = null
const counters = () => ({ stat: read('/proc/stat'), net: read('/proc/net/dev'), at: performance.now() })

async function collect() {
  if (!previous) {
    previous = counters()
    await sleep(SAMPLE_MS)
  }
  const before = previous
  const now = counters()
  previous = now
  const ifaces = interfaces()
  const seconds = Math.max(0.001, (now.at - before.at) / 1000)

  const arrays = existsSync('/proc/mdstat') ? parseMdstat(read('/proc/mdstat')) : []
  const mountsText = read('/proc/1/mounts')
  const mounts = []
  for (const path of (config.mounts ?? ['/']).map(mountPath)) {
    try {
      mounts.push(await mountInfo(path, mountsText, arrays))
    } catch (err) {
      log(`mount ${path}: ${err.message}`)
      mounts.push(missingMount(path))
    }
  }

  return fitReport({
    id: config.id,
    name: config.name ?? config.id,
    order: config.order ?? 100,
    hostname: tryRead(`${HOST}/etc/hostname`) ?? config.id,
    arch: arch(),
    uptimeSec: Math.round(Number(read('/proc/uptime').split(' ')[0])),
    cpu: { pct: cpuPct(parseCpu(before.stat), parseCpu(now.stat)), cores: cpus().length, load1: Number(read('/proc/loadavg').split(' ')[0]), tempC: cpuTemp() },
    mem: parseMeminfo(read('/proc/meminfo')),
    net: netRate(parseNetDev(before.net, ifaces), parseNetDev(now.net, ifaces), seconds),
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
  if (!res.ok) throw new Error(`dashboard answered ${res.status}: ${(await res.text()).slice(0, 200)}`)
  await res.body?.cancel()
}

if (process.argv.includes('--once')) {
  console.log(JSON.stringify(await collect(), null, 2))
} else {
  for (;;) {
    const started = Date.now()
    try {
      await send(await collect())
    } catch (err) {
      log(err.message)
    }
    await sleep(Math.max(1000, INTERVAL_MS - (Date.now() - started)))
  }
}
