import { SectionHeader } from '@/components/ui/SectionHeader'
import { ProfileBanner } from './ProfileBanner'
import { MatchCard } from './MatchCard'
import { ChampionRow } from './ChampionRow'
import type { LeagueData } from '@/types'

const INK = '#1a1612'
const PAPER_DARK = '#d8d2c4'

interface LeagueSectionProps {
  data: LeagueData | null
}

export function LeagueSection({ data }: LeagueSectionProps) {
  return (
    <div style={{ marginBottom: 10 }}>
      <SectionHeader label="LEAGUE OF LEGENDS" meta={`All Game Modes · season ${new Date().getFullYear()}`} />

      {data ? (
        <ProfileBanner
          name={data.profile.name}
          tag={data.profile.tag}
          level={data.profile.level}
          iconUrl={data.profile.iconUrl}
          fallback={data.profile.fallback}
        />
      ) : (
        <div style={{ height: 68, background: PAPER_DARK, borderRadius: 10, border: `1px solid ${INK}`, marginBottom: 8 }} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        {(data?.matches ?? Array(4).fill(null)).map((match, i) =>
          match ? (
            <MatchCard key={match.matchId} match={match} />
          ) : (
            <div key={i} style={{ height: 60, background: PAPER_DARK, borderRadius: 10, border: `1px solid ${INK}` }} />
          )
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(data?.topChamps ?? Array(3).fill(null)).map((champ, i) =>
          champ ? (
            <ChampionRow key={champ.name} champ={champ} rank={i + 1} />
          ) : (
            <div key={i} style={{ height: 50, background: PAPER_DARK, borderRadius: 10, border: `1px solid ${INK}` }} />
          )
        )}
      </div>
    </div>
  )
}
