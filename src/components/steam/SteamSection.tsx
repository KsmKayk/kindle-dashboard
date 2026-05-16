import { SectionHeader } from '@/components/ui/SectionHeader'
import { NowPlaying } from './NowPlaying'
import { GameCard } from './GameCard'
import { TotalGamesCard } from './TotalGamesCard'
import type { SteamData } from '@/types'

const INK = '#1a1612'
const PAPER_DARK = '#d8d2c4'

interface SteamSectionProps {
  data: SteamData | null
}

export function SteamSection({ data }: SteamSectionProps) {
  const meta = data ? `${data.personaname} · ${data.isOnline ? 'online' : 'offline'}` : 'loading...'

  const placeholderGames = Array(3).fill(null)
  const games = data?.topGames ?? placeholderGames

  return (
    <div style={{ marginBottom: 10 }}>
      <SectionHeader label="STEAM" meta={meta} />
      <NowPlaying game={data?.nowPlaying ?? null} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {games.slice(0, 3).map((g, i) =>
          g ? <GameCard key={g.appid} game={g} /> : <div key={i} style={{ height: 86, background: PAPER_DARK, borderRadius: 10, border: `1px solid ${INK}` }} />
        )}
        <TotalGamesCard total={data?.totalGames ?? 0} />
      </div>
    </div>
  )
}
