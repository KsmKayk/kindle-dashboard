import { DashImg } from '@/components/ui/DashImg'

const INK = '#1a1612'
const INK_MUTED = '#7a7268'
const PAPER_LIGHT = '#f1ede2'

interface ProfileBannerProps {
  name: string
  tag: string
  level: number
  iconUrl: string
  fallback: string
}

export function ProfileBanner({ name, tag, level, iconUrl, fallback }: ProfileBannerProps) {
  return (
    <div style={{ background: PAPER_LIGHT, border: `1px solid ${INK}`, borderRadius: 10, boxSizing: 'border-box', display: 'flex', alignItems: 'center', padding: 12, gap: 14, height: 68, marginBottom: 8 }}>
      <div style={{ width: 44, height: 44, borderRadius: 9999, border: `1px solid ${INK}`, overflow: 'hidden', flexShrink: 0 }}>
        <DashImg src={iconUrl} fallback={fallback} alt={name} radius={9999} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Georgia, serif', letterSpacing: -0.3, lineHeight: 1.1 }}>
          {name}<span style={{ color: INK_MUTED, fontWeight: 400, fontSize: 13 }}>{tag}</span>
        </div>
        <div style={{ fontSize: 9, letterSpacing: 2, fontFamily: '"Helvetica Neue", Arial, sans-serif', color: INK_MUTED, marginTop: 3 }}>
          SUMMONER LEVEL
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Georgia, serif', lineHeight: 1, letterSpacing: -1 }}>
          {level}
        </div>
      </div>
    </div>
  )
}
