import type { ReactNode } from 'react'
import { INK, INK_MUTED, PAPER, PAPER_LIGHT, PAPER_DARK, SANS, SERIF, card, darkCard, muted, Label, SectionHeader, Meter, Badge, Page, renderKindlePng } from './image-kit'
import { ageLabel, bytesLabel, rateLabel, uptimeLabel } from './format'
import { DEFAULT_IMAGE_SIZE, type ImageSize } from './kindle-png'
import { containerDown, isStale, mountMissing, mountNeedsAttention, ramNeedsAttention, smartLabel, usedPct } from './servers'
import type { HealthResult } from './healthcheck'
import type { ContainerInfo, MountInfo, RaidInfo, StoredServer } from '@/types'

// Servers tab of the KOReader plugin: one section per reporting server, then
// the site health checks. Cards turn dark when something needs attention.

// Containers listed per server (fewer with more than two servers, so the page fits)
const maxContainers = (servers: number) => (servers > 2 ? 6 : 10)
const MISSING = 'não montado'
// Single-line text cut with … when too long
const ellipsis = { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' } as const

const archLabel = (arch: string) => (arch === 'x64' ? 'x86_64' : arch)
// Compose names end in -1: kindle-dashboard-dashboard-1 → kindle-dashboard-dashboard
const containerName = (name: string) => name.replace(/-\d+$/, '')

function Row({ children, dark = false, top = true }: { children: ReactNode; dark?: boolean; top?: boolean }) {
  return (
    <div style={{
      display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: '2px 0',
      borderTop: top ? `1px solid ${dark ? '#4a443c' : PAPER_DARK}` : 'none', fontFamily: SANS, fontSize: 11,
    }}>
      {children}
    </div>
  )
}

function CardHeader({ left, right, dark }: { left: string; right: string; dark: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
      <Label size={8} color={muted(dark)}>{left}</Label>
      <Label size={8} color={muted(dark)}>{right}</Label>
    </div>
  )
}

function MeterCell({ label, value, pct, dark }: { label: string; value: string; pct: number | null; dark: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 3 }}>
        <Label size={8} color={muted(dark)}>{label}</Label>
        <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 12, fontWeight: 700 }}>{value}</div>
      </div>
      {pct === null ? <div style={{ display: 'flex', height: 9 }} /> : <div style={{ display: 'flex' }}><Meter pct={pct} dark={dark} /></div>}
    </div>
  )
}

function usage(m: MountInfo) {
  if (mountMissing(m)) return MISSING
  return `${bytesLabel(m.usedBytes)} / ${bytesLabel(m.totalBytes)}`
}

function MountRow({ mount, label, health, dark }: { mount: MountInfo; label: string; health: string; dark: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '2px 0', gap: 8, fontFamily: SANS, fontSize: 11 }}>
      <div style={{ display: 'flex', width: 132, flexShrink: 0, fontWeight: 700 }}><div style={{ display: 'flex', ...ellipsis }}>{label}</div></div>
      <Meter pct={usedPct(mount.usedBytes, mount.totalBytes)} dark={dark} />
      <div style={{ display: 'flex', width: 148, flexShrink: 0, justifyContent: 'flex-end', fontSize: 10, color: muted(dark), fontWeight: mountMissing(mount) ? 700 : 400 }}>
        {[usage(mount), health].filter(Boolean).join(' · ')}
      </div>
    </div>
  )
}

function RaidBlock({ mount, raid, dark }: { mount: MountInfo; raid: RaidInfo; dark: boolean }) {
  const members = mount.disks.map((d) => [d.device, smartLabel(d)].filter(Boolean).join(' ')).join(' · ')
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', marginTop: 3, padding: '5px 8px', borderRadius: 8,
      border: `1.5px solid ${dark ? PAPER_LIGHT : INK}`, background: dark ? INK : PAPER,
    }}>
      <MountRow mount={mount} label={`${mount.path} · ${raid.device}`} health="" dark={dark} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3, fontFamily: SANS, fontSize: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexShrink: 0 }}><Badge filled dark={dark}>{raid.state ? `${raid.level} · [${raid.state}]` : raid.level}</Badge></div>
          <div style={{ display: 'flex', marginLeft: 6, ...ellipsis }}>{members}</div>
        </div>
        <div style={{ display: 'flex', flexShrink: 0, marginLeft: 6, color: muted(dark) }}>
          {raid.syncPct !== null ? `sincronizando ${raid.syncPct}%` : `${raid.active} de ${raid.total} discos ativos`}
        </div>
      </div>
    </div>
  )
}

function Storage({ mounts }: { mounts: MountInfo[] }) {
  const dark = mounts.some(mountNeedsAttention)
  return (
    <div style={{ ...(dark ? darkCard : card), flexDirection: 'column', padding: '7px 12px' }}>
      <CardHeader left="ARMAZENAMENTO" right="USADO / TOTAL · SMART" dark={dark} />
      {mounts.map((m) =>
        m.raid ? (
          <RaidBlock key={m.path} mount={m} raid={m.raid} dark={dark} />
        ) : (
          <MountRow key={m.path} mount={m} dark={dark}
            label={mountMissing(m) ? m.path : `${m.path} · ${m.disks.map((d) => d.device).join('+') || m.device}`}
            health={m.disks.length === 1 ? smartLabel(m.disks[0]) : ''} />
        )
      )}
    </div>
  )
}

function Containers({ containers, max }: { containers: ContainerInfo[]; max: number }) {
  if (!containers.length) return null
  const dark = containers.some(containerDown)
  const running = containers.filter((c) => !containerDown(c)).length
  const shown = [...containers]
    .sort((a, b) => Number(containerDown(b)) - Number(containerDown(a)) || a.name.localeCompare(b.name))
    .slice(0, max)
  const hidden = containers.length - shown.length
  const fg = dark ? PAPER_LIGHT : INK
  return (
    <div style={{ ...(dark ? darkCard : card), flexDirection: 'column', padding: '6px 12px' }}>
      <CardHeader left={`CONTAINERS · ${running}/${containers.length} RODANDO`} right={hidden ? `+${hidden} OCULTOS` : 'PORTA NO HOST'} dark={dark} />
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {shown.map((c) => {
          const down = containerDown(c)
          return (
            <div key={c.name} style={{ display: 'flex', width: '48%' }}>
              <Row dark={dark}>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', width: 7, height: 7, borderRadius: 9999, marginRight: 5, flexShrink: 0, border: `1.5px solid ${fg}`, background: down ? 'transparent' : fg }} />
                  <div style={{ display: 'flex', ...ellipsis, fontWeight: down ? 700 : 400 }}>{containerName(c.name)}</div>
                </div>
                <div style={{ display: 'flex', flexShrink: 0, marginLeft: 4, fontSize: 10, color: muted(dark) }}>
                  {down ? 'parado' : c.ports.length ? c.ports.join(' ') : 'interna'}
                </div>
              </Row>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Server({ server, now, maxContainers }: { server: StoredServer; now: Date; maxContainers: number }) {
  const r = server.report
  const stale = isStale(server, now.getTime())
  const single = r.mounts.length === 1 && !r.mounts[0].raid ? r.mounts[0] : null
  const meta = stale
    ? `sem dados há ${ageLabel(server.receivedAt, now)}`
    : [archLabel(r.arch), `up ${uptimeLabel(r.uptimeSec)}`, r.cpu.tempC === null ? null : `CPU ${r.cpu.tempC}°C`, `rx ${rateLabel(r.net.rxBps)} · tx ${rateLabel(r.net.txBps)}`]
        .filter(Boolean).join(' · ')
  const metersDark = stale || ramNeedsAttention(r) || (single !== null && mountNeedsAttention(single))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <SectionHeader label={r.name.toUpperCase()} meta={meta} marginBottom={0} />
      <div style={{ ...(metersDark ? darkCard : card), padding: '8px 12px', gap: 12 }}>
        <MeterCell label={`CPU · ${r.cpu.cores}`} value={`${Math.round(r.cpu.pct)}%`} pct={r.cpu.pct} dark={metersDark} />
        <MeterCell label="RAM" value={`${bytesLabel(r.mem.usedBytes)} / ${bytesLabel(r.mem.totalBytes)}`} pct={usedPct(r.mem.usedBytes, r.mem.totalBytes)} dark={metersDark} />
        {single ? (
          <MeterCell label={`DISCO ${single.path}`} value={usage(single)} pct={mountMissing(single) ? null : usedPct(single.usedBytes, single.totalBytes)} dark={metersDark} />
        ) : (
          <MeterCell label="LOAD" value={`${r.cpu.load1.toFixed(2)} · ${r.cpu.cores} cores`} pct={(r.cpu.load1 / (r.cpu.cores || 1)) * 100} dark={metersDark} />
        )}
      </div>
      {single ? null : <Storage mounts={r.mounts} />}
      <Containers containers={r.containers} max={maxContainers} />
    </div>
  )
}

function Health({ results }: { results: HealthResult[] }) {
  if (!results.length) return null
  const dark = results.some((r) => !r.ok)
  return (
    <div style={{ ...(dark ? darkCard : card), flexDirection: 'column', padding: '6px 12px' }}>
      <CardHeader left="SITES · HEALTH CHECK" right="STATUS · LATÊNCIA" dark={dark} />
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {results.map((r) => (
          <div key={r.label} style={{ display: 'flex', width: '48%' }}>
            <Row dark={dark}>
              <div style={{ display: 'flex', flex: 1, minWidth: 0 }}><div style={{ display: 'flex', ...ellipsis }}>{r.label}</div></div>
              <div style={{ display: 'flex', flexShrink: 0, marginLeft: 4, fontWeight: r.ok ? 400 : 700 }}>
                {r.ok ? `OK ${r.ms}ms` : r.status ? `ERRO ${r.status}` : 'FORA DO AR'}
              </div>
            </Row>
          </div>
        ))}
      </div>
    </div>
  )
}

export async function renderServersPng(
  servers: StoredServer[],
  health: HealthResult[],
  size: ImageSize = DEFAULT_IMAGE_SIZE,
  now = new Date()
): Promise<Buffer> {
  return renderKindlePng(
    <Page gap={10}>
      {servers.length ? (
        servers.map((s) => <Server key={s.report.id} server={s} now={now} maxContainers={maxContainers(servers.length)} />)
      ) : (
        <div style={{ ...card, padding: '10px 12px' }}>
          <Label size={10} spacing={0.5} color={INK_MUTED}>Nenhum servidor enviou dados ainda (server-agent)</Label>
        </div>
      )}
      <Health results={health} />
    </Page>,
    size
  )
}
