const INK = '#1a1612'
const INK_MUTED = '#7a7268'

interface SectionHeaderProps {
  label: string
  meta?: string
}

export function SectionHeader({ label, meta }: SectionHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span
        style={{
          fontFamily: '"Helvetica Neue", Arial, sans-serif',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2.5,
          color: INK,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: INK }} />
      {meta && (
        <span
          style={{
            fontFamily: '"Helvetica Neue", Arial, sans-serif',
            fontSize: 9,
            letterSpacing: 1.5,
            color: INK_MUTED,
          }}
        >
          {meta}
        </span>
      )}
    </div>
  )
}
