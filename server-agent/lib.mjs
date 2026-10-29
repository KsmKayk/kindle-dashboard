// Pure parsers of the server agent (/proc files, smartctl JSON, Docker API).

// /proc/mdstat → [{ device, level, state, active, total, members, syncPct }]
// Inactive arrays are left out. A running check (scrub) is not counted as syncing.
export function parseMdstat(text) {
  const arrays = []
  let current = null
  for (const line of text.split('\n')) {
    if (/^md\S+\s*:/.test(line)) {
      const head = line.match(/^(md\S+)\s*:\s*active(?:\s+\([^)]*\))?\s+(raid\d+|linear)\s+(.*)$/)
      current = head && {
        device: head[1],
        level: head[2].replace(/^raid(\d+)$/, 'RAID $1'),
        state: '',
        active: 0,
        total: 0,
        members: [...head[3].matchAll(/([\w-]+)\[\d+\]/g)].map((m) => m[1]).sort(),
        syncPct: null,
      }
      if (current) arrays.push(current)
      continue
    }
    if (!current) continue
    const counts = line.match(/\[(\d+)\/(\d+)\]\s+\[([U_]+)\]/)
    if (counts) {
      current.total = Number(counts[1])
      current.active = Number(counts[2])
      current.state = counts[3]
    }
    const sync = line.match(/(?:resync|recovery|reshape)\s*=\s*([\d.]+)%/)
    if (sync) current.syncPct = Number(sync[1])
  }
  // raid0 / linear show no [n/m]: every member counts as active
  for (const a of arrays) if (!a.total) a.total = a.active = a.members.length
  return arrays
}

// First line of /proc/stat → { idle, total } jiffies
export function parseCpu(text) {
  // user nice system idle iowait irq softirq steal (guest time is already in user)
  const fields = text.split('\n')[0].trim().split(/\s+/).slice(1, 9).map(Number)
  return { idle: fields[3] + (fields[4] ?? 0), total: fields.reduce((a, b) => a + b, 0) }
}

export function cpuPct(a, b) {
  const total = b.total - a.total
  return total > 0 ? Math.round((1 - (b.idle - a.idle) / total) * 1000) / 10 : 0
}

export function parseMeminfo(text) {
  const kb = (name) => Number(text.match(new RegExp(`^${name}:\\s+(\\d+)`, 'm'))?.[1] ?? 0)
  const total = kb('MemTotal')
  return { totalBytes: total * 1024, usedBytes: (total - kb('MemAvailable')) * 1024 }
}

// Sum of received/sent bytes over `interfaces` in /proc/net/dev
export function parseNetDev(text, interfaces) {
  let rx = 0
  let tx = 0
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*([^:\s]+):\s*(.*)$/)
    if (!match || !interfaces.has(match[1])) continue
    const fields = match[2].trim().split(/\s+/).map(Number)
    rx += fields[0]
    tx += fields[8]
  }
  return { rx, tx }
}

export function netRate(a, b, seconds) {
  return { rxBps: Math.max(0, Math.round((b.rx - a.rx) / seconds)), txBps: Math.max(0, Math.round((b.tx - a.tx) / seconds)) }
}

// `smartctl -j -H -A /dev/<device>` output → disk health
export function smartFromJson(device, json) {
  const table = json.ata_smart_attributes?.table ?? []
  const raw = (id) => table.find((a) => a.id === id)?.raw?.value ?? null
  const passed = json.smart_status?.passed
  return {
    device,
    healthy: typeof passed === 'boolean' ? passed : null,
    tempC: json.temperature?.current ?? null,
    reallocated: raw(5),
    pending: raw(197),
  }
}

// Docker Engine API /containers/json item → { name, state, status, ports }
export function containerFromApi(c) {
  const ports = [...new Set((c.Ports ?? []).filter((p) => p.PublicPort).map((p) => p.PublicPort))].sort((a, b) => a - b)
  return { name: (c.Names?.[0] ?? c.Id.slice(0, 12)).replace(/^\//, ''), state: c.State, status: c.Status, ports }
}

// Docker API list → containers, without the ones named in `ignore` (exact names)
export function listContainers(apiList, ignore = []) {
  const skip = new Set(ignore)
  return apiList.map(containerFromApi).filter((c) => !skip.has(c.name))
}

// "/mnt/raid1/" → "/mnt/raid1" (as /proc/<pid>/mounts writes it)
export const mountPath = (path) => path.replace(/\/+$/, '') || '/'

// /proc/<pid>/mounts writes spaces, tabs, newlines and backslashes as \040, \011, \012, \134
const unescape = (field) => field.replace(/\\([0-7]{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))

// Device mounted at `path` in a /proc/<pid>/mounts text (the last match wins)
export function mountDevice(mountsText, path) {
  let device = null
  for (const line of mountsText.split('\n')) {
    const [dev, point] = line.split(' ')
    if (point !== undefined && unescape(point) === path) device = unescape(dev)
  }
  return device
}

// Keeps a report within the limits the dashboard validates (src/lib/reports.ts):
// non-negative numbers, bounded strings and list sizes.
const str = (v, max = 200) => String(v ?? '').slice(0, max)
const count = (v) => (Number.isFinite(v) && v > 0 ? v : 0)
const countOrNull = (v) => (v === null || v === undefined ? null : count(v))
const tempOrNull = (v) => (Number.isFinite(v) ? v : null)

function fitDisk(d) {
  return {
    device: str(d.device, 40),
    healthy: typeof d.healthy === 'boolean' ? d.healthy : null,
    tempC: tempOrNull(d.tempC),
    reallocated: countOrNull(d.reallocated),
    pending: countOrNull(d.pending),
  }
}

function fitRaid(r) {
  if (!r) return null
  return {
    device: str(r.device, 40), level: str(r.level, 20), state: str(r.state, 40),
    active: count(r.active), total: count(r.total),
    members: r.members.slice(0, 32).map((m) => str(m, 40)),
    syncPct: countOrNull(r.syncPct),
  }
}

export function fitReport(r) {
  return {
    id: r.id,
    name: str(r.name, 60),
    order: Number.isFinite(r.order) ? r.order : 100,
    hostname: str(r.hostname),
    arch: str(r.arch, 20),
    uptimeSec: Math.round(count(r.uptimeSec)),
    cpu: { pct: count(r.cpu.pct), cores: count(r.cpu.cores), load1: count(r.cpu.load1), tempC: tempOrNull(r.cpu.tempC) },
    mem: { totalBytes: count(r.mem.totalBytes), usedBytes: count(r.mem.usedBytes) },
    net: { rxBps: count(r.net.rxBps), txBps: count(r.net.txBps) },
    mounts: r.mounts.slice(0, 16).map((m) => ({
      path: str(m.path), device: str(m.device, 80),
      totalBytes: count(m.totalBytes), usedBytes: count(m.usedBytes),
      raid: fitRaid(m.raid), disks: m.disks.slice(0, 32).map(fitDisk),
    })),
    containers: r.containers.slice(0, 100).map((c) => ({
      name: str(c.name), state: str(c.state, 40), status: str(c.status), ports: c.ports.filter((p) => count(p) > 0).slice(0, 64),
    })),
  }
}
