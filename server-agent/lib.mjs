// Pure parsers of the server agent (/proc files, smartctl JSON, Docker API).

// /proc/mdstat → [{ device, level, state, active, total, members, syncPct }]
export function parseMdstat(text) {
  const arrays = []
  let current = null
  for (const line of text.split('\n')) {
    const head = line.match(/^(md\d+)\s*:\s*\w+(?:\s+\([^)]*\))?\s+(raid\d+|linear)\s+(.*)$/)
    if (head) {
      current = {
        device: head[1],
        level: head[2].replace(/^raid(\d+)$/, 'RAID $1'),
        state: '',
        active: 0,
        total: 0,
        members: [...head[3].matchAll(/(\w+)\[\d+\]/g)].map((m) => m[1]).sort(),
        syncPct: null,
      }
      arrays.push(current)
      continue
    }
    if (!current) continue
    const counts = line.match(/\[(\d+)\/(\d+)\]\s+\[([U_]+)\]/)
    if (counts) {
      current.total = Number(counts[1])
      current.active = Number(counts[2])
      current.state = counts[3]
    }
    const sync = line.match(/(?:resync|recovery|reshape|check)\s*=\s*([\d.]+)%/)
    if (sync) current.syncPct = Number(sync[1])
  }
  return arrays
}

// First line of /proc/stat → { idle, total } jiffies
export function parseCpu(text) {
  const fields = text.split('\n')[0].trim().split(/\s+/).slice(1).map(Number)
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

// Device mounted at `path` in a /proc/<pid>/mounts text (the last match wins)
export function mountDevice(mountsText, path) {
  let device = null
  for (const line of mountsText.split('\n')) {
    const [dev, point] = line.split(' ')
    if (point === path) device = dev
  }
  return device
}
