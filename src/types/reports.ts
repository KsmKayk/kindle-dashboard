// Reports pushed by claude-reporter/ (Claude usage) and server-agent/ (server status)

export interface ClaudeLimit { utilization: number; resetsAt: string }  // utilization: percent
export interface ClaudeLimits { fiveHour: ClaudeLimit | null; sevenDay: ClaudeLimit | null; at: string }

// One local day of Claude Code usage (tokens)
export interface ClaudeDay {
  date: string  // YYYY-MM-DD, the PC's local time
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
  byModel: Record<string, number>
  byProject: Record<string, number>
}

// limits: null when the usage endpoint could not be read this time
export interface ClaudeReport { limits: ClaudeLimits | null; days: ClaudeDay[] }
export interface StoredClaude { limits: ClaudeLimits | null; days: ClaudeDay[]; receivedAt: number }

export interface DiskHealth {
  device: string  // sdb
  healthy: boolean | null
  tempC: number | null
  reallocated: number | null
  pending: number | null
}

export interface RaidInfo {
  device: string  // md0
  level: string   // RAID 1
  state: string   // UU, U_ …
  active: number
  total: number
  members: string[]
  syncPct: number | null
}

export interface MountInfo {
  path: string    // /mnt/raid1
  device: string  // md0, dm-0, sda1
  totalBytes: number
  usedBytes: number
  raid: RaidInfo | null
  disks: DiskHealth[]
}

export interface ContainerInfo { name: string; state: string; status: string; ports: number[] }

export interface ServerReport {
  id: string
  name: string
  order: number
  hostname: string
  arch: string
  uptimeSec: number
  cpu: { pct: number; cores: number; load1: number; tempC: number | null }
  mem: { totalBytes: number; usedBytes: number }
  net: { rxBps: number; txBps: number }
  mounts: MountInfo[]
  containers: ContainerInfo[]
}

export interface StoredServer { report: ServerReport; receivedAt: number }
