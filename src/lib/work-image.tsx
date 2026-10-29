import { INK, INK_MUTED, PAPER_LIGHT, PAPER_DARK, PAPER_DARKER, SERIF, SANS, card, darkCard, muted, Label, SectionHeader, Meter, Bars, Badge, Page, renderKindlePng } from './image-kit'
import { ageLabel, clockTime, compactNumber, durationLabel, untilLabel, weekdayTime } from './format'
import { DEFAULT_IMAGE_SIZE, type ImageSize } from './kindle-png'
import type { ClaudeSummary } from './claude-summary'
import type { GithubDeploy, GithubPr, GithubStats, PeriodCounts } from '@/types'

// Work tab of the KOReader plugin: GitHub on top, Claude below.

const CLAUDE_STALE_MS = 30 * 60_000

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)
const repoName = (repo: string) => repo.split('/').pop() ?? repo

function Big({ children, size = 23, color }: { children: string; size?: number; color?: string }) {
  return <div style={{ display: 'flex', fontFamily: SERIF, fontSize: size, fontWeight: 700, lineHeight: 1.1, color }}>{children}</div>
}

function Stat3({ items, size = 23 }: { items: [string, string][]; size?: number }) {
  return (
    <div style={{ display: 'flex', marginTop: 3 }}>
      {items.map(([value, label], i) => (
        <div key={label} style={{
          display: 'flex', flexDirection: 'column', flex: 1,
          paddingLeft: i ? 8 : 0, borderLeft: i ? `1px solid ${PAPER_DARKER}` : 'none',
        }}>
          <Big size={size}>{value}</Big>
          <Label size={8}>{label}</Label>
        </div>
      ))}
    </div>
  )
}

function Note({ children }: { children: string }) {
  return (
    <div style={{ ...card, padding: '10px 12px' }}>
      <Label size={10} spacing={0.5}>{children}</Label>
    </div>
  )
}

function PrCounts({ title, counts }: { title: string; counts: PeriodCounts }) {
  const avg = counts.avgMonth === null ? '—' : String(counts.avgMonth)
  return (
    <div style={{ ...card, flex: 1, flexDirection: 'column', padding: '10px 12px' }}>
      <Label size={8}>{title}</Label>
      <Stat3 items={[[String(counts.week), 'SEMANA'], [String(counts.month), 'MÊS'], [avg, 'MÉDIA/MÊS']]} />
    </div>
  )
}

function Commits({ gh }: { gh: GithubStats }) {
  const merge = gh.mergeHours === null ? '—' : durationLabel(gh.mergeHours)
  const lines = `+${compactNumber(gh.lines.added)} / −${compactNumber(gh.lines.removed)}`
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ ...card, flex: 1, flexDirection: 'column', padding: '8px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Label size={8}>COMMITS · 12 SEMANAS</Label>
          <div style={{ display: 'flex', alignItems: 'flex-end', fontFamily: SANS, fontSize: 10 }}>
            <Big size={16}>{String(gh.commits.week)}</Big>
            <div style={{ display: 'flex', margin: '0 6px 2px 3px' }}>sem</div>
            <Big size={16}>{String(gh.commits.month)}</Big>
            <div style={{ display: 'flex', margin: '0 0 2px 3px' }}>mês</div>
          </div>
        </div>
        <div style={{ display: 'flex', margin: '4px 0' }}><Bars values={gh.commits.weekly} height={40} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 10, color: INK_MUTED }}>
          <div style={{ display: 'flex' }}>{`merge em ${merge}`}</div>
          <div style={{ display: 'flex' }}>{`mês ${lines}`}</div>
        </div>
      </div>
      <div style={{ ...darkCard, width: 112, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Big size={36} color={PAPER_LIGHT}>{gh.streak === null ? '—' : String(gh.streak)}</Big>
        <Label size={8} color={PAPER_DARKER}>DIAS DE STREAK</Label>
      </div>
    </div>
  )
}

function KeyValue({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 11, padding: '2px 0', borderTop: `1px solid ${PAPER_DARK}` }}>
      <div style={{ display: 'flex', flexShrink: 0, marginRight: 8 }}>{k}</div>
      <div style={{ display: 'flex', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontFamily: SERIF, fontWeight: 700 }}>{v}</div>
    </div>
  )
}

function deployText(d: GithubDeploy, now: Date): string {
  if (d.state === null || d.at === null) return 'sem execuções'
  const label = { success: 'OK', failure: 'FALHOU', running: 'RODANDO' }[d.state]
  return `${label} · ${ageLabel(d.at, now)}`
}

function ReposAndDeploys({ gh, now }: { gh: GithubStats; now: Date }) {
  const repo = (r: { repo: string; commits: number } | null) => (r ? `${repoName(r.repo)} · ${r.commits}` : '—')
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ ...card, flex: 1, flexDirection: 'column', padding: '6px 12px' }}>
        <Label size={8}>REPO MAIS CONTRIBUÍDO</Label>
        <KeyValue k="12 meses" v={repo(gh.topRepo.year)} />
        <KeyValue k="este mês" v={repo(gh.topRepo.month)} />
      </div>
      {gh.deploys.length ? (
        <div style={{ ...(gh.deploys.some((d) => d.state === 'failure') ? darkCard : card), flex: 1, flexDirection: 'column', padding: '6px 12px' }}>
          <Label size={8} color={muted(gh.deploys.some((d) => d.state === 'failure'))}>ÚLTIMOS DEPLOYS</Label>
          {gh.deploys.slice(0, 2).map((d) => (
            <div key={d.repo} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 11, padding: '2px 0', borderTop: `1px solid ${PAPER_DARK}` }}>
              <div style={{ display: 'flex', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginRight: 8 }}>{repoName(d.repo)}</div>
              <div style={{ display: 'flex', flexShrink: 0, fontWeight: d.state === 'failure' ? 700 : 400 }}>{deployText(d, now)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ciBadge(pr: GithubPr) {
  if (pr.ci === 'success') return <Badge>CI OK</Badge>
  if (pr.ci === 'failure') return <Badge filled>CI FALHOU</Badge>
  if (pr.ci === 'pending') return <Badge>CI ...</Badge>
  return null
}

function PrRow({ pr, right }: { pr: GithubPr; right: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '3px 0', borderTop: `1px solid ${PAPER_DARK}`, fontFamily: SANS, fontSize: 11 }}>
      <div style={{ display: 'flex', fontWeight: 700, flexShrink: 0 }}>{`${repoName(pr.repo)} #${pr.number}`}</div>
      <div style={{ display: 'flex', flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{pr.title}</div>
      {right === '' ? null : <div style={{ display: 'flex', flexShrink: 0, fontSize: 10, color: INK_MUTED }}>{right}</div>}
    </div>
  )
}

function PrLists({ gh, now }: { gh: GithubStats; now: Date }) {
  return (
    <div style={{ ...card, flexDirection: 'column', padding: '6px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
        <Label size={8}>{`MEUS PRS ABERTOS · ${gh.openPrs.length}`}</Label>
        <Label size={8}>CI · APROVAÇÕES · IDADE</Label>
      </div>
      {gh.openPrs.slice(0, 2).map((pr) => (
        <div key={`${pr.repo}#${pr.number}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', flex: 1, minWidth: 0 }}><PrRow pr={pr} right={`${pr.approvals} · ${ageLabel(pr.createdAt, now)}`} /></div>
          {ciBadge(pr)}
        </div>
      ))}
      <div style={{ display: 'flex', marginTop: 4 }}>
        <Label size={8}>{`ESPERANDO MEU REVIEW · ${gh.reviewQueue.length}`}</Label>
      </div>
      {gh.reviewQueue.slice(0, 2).map((pr) => (
        <PrRow key={`${pr.repo}#${pr.number}`} pr={pr} right={`@${pr.author} · ${ageLabel(pr.createdAt, now)}`} />
      ))}
    </div>
  )
}

function Github({ gh, now }: { gh: GithubStats | null; now: Date }) {
  if (!gh) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <SectionHeader label="GITHUB" meta="indisponível" marginBottom={0} />
        <Note>GITHUB_TOKEN não configurado ou GitHub fora do ar</Note>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <SectionHeader label="GITHUB" meta={gh.login} marginBottom={0} />
      <div style={{ display: 'flex', gap: 8 }}>
        <PrCounts title="PRS QUE ABRI" counts={gh.prsOpened} />
        <PrCounts title="PRS QUE REVISEI" counts={gh.prsReviewed} />
      </div>
      <Commits gh={gh} />
      <ReposAndDeploys gh={gh} now={now} />
      <PrLists gh={gh} now={now} />
    </div>
  )
}

function LimitCard({ title, pct, note, dark }: { title: string; pct: number | null; note: string; dark: boolean }) {
  return (
    <div style={{ ...(dark ? darkCard : card), flex: 1, alignItems: 'center', padding: '8px 12px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', marginRight: 12 }}>
        <Label size={8} color={muted(dark)}>{title}</Label>
        <Big size={30} color={dark ? PAPER_LIGHT : INK}>{pct === null ? '—' : `${Math.round(pct)}%`}</Big>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex' }}><Meter pct={pct ?? 0} dark={dark} height={12} /></div>
        <div style={{ display: 'flex', marginTop: 3 }}><Label size={8} color={muted(dark)}>{note}</Label></div>
      </div>
    </div>
  )
}

function Claude({ claude, now }: { claude: ClaudeSummary | null; now: Date }) {
  if (!claude) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <SectionHeader label="CLAUDE" meta="sem dados" marginBottom={0} />
        <Note>Aguardando o primeiro relatório do claude-reporter</Note>
      </div>
    )
  }
  const stale = now.getTime() - claude.receivedAt > CLAUDE_STALE_MS
  const limitsStale = claude.limits !== null && now.getTime() - new Date(claude.limits.at).getTime() > CLAUDE_STALE_MS
  const meta = [
    stale ? `sem dados há ${ageLabel(claude.receivedAt, now)}` : `atualizado ${clockTime(claude.receivedAt)}`,
    limitsStale && claude.limits ? `limites de ${clockTime(claude.limits.at)}` : null,
  ].filter(Boolean).join(' · ')
  const five = claude.limits?.fiveHour ?? null
  const seven = claude.limits?.sevenDay ?? null
  const split = [
    claude.cachePct === null ? null : `cache ${claude.cachePct}%`,
    claude.models[0] ? `${claude.models[0].name} ${claude.models[0].pct}%` : null,
    claude.topProject ? `top: ${truncate(claude.topProject, 24)}` : null,
  ].filter(Boolean).join(' · ').toUpperCase()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <SectionHeader label="CLAUDE" meta={meta} marginBottom={0} />
      <div style={{ display: 'flex', gap: 8 }}>
        <LimitCard title="SESSÃO 5H" pct={five?.utilization ?? null} note={five ? (five.resetsAt ? `reseta ${untilLabel(five.resetsAt, now)}` : 'sem sessão ativa') : 'sem leitura'} dark />
        <LimitCard title="SEMANAL" pct={seven?.utilization ?? null} note={seven?.resetsAt ? `reseta ${weekdayTime(seven.resetsAt)}` : 'sem leitura'} dark={(seven?.utilization ?? 0) >= 90} />
      </div>
      <div style={{ ...card, alignItems: 'center', padding: '8px 12px', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 200 }}>
          <Label size={8}>TOKENS · CLAUDE CODE</Label>
          <Stat3 size={17} items={[[compactNumber(claude.tokens.today), 'HOJE'], [compactNumber(claude.tokens.week), 'SEMANA'], [compactNumber(claude.tokens.month), 'MÊS']]} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex' }}><Bars values={claude.daily} height={34} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 3, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}><Label size={8} spacing={1}>{split}</Label></div>
        </div>
      </div>
    </div>
  )
}

export async function renderWorkPng(
  github: GithubStats | null,
  claude: ClaudeSummary | null,
  size: ImageSize = DEFAULT_IMAGE_SIZE,
  now = new Date()
): Promise<Buffer> {
  return renderKindlePng(
    <Page gap={16}>
      <Github gh={github} now={now} />
      <Claude claude={claude} now={now} />
    </Page>,
    size
  )
}
