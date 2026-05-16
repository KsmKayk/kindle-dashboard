const INK = '#1a1612'

export function Footer() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 10 }}>
      <div style={{ flex: 1, height: 1, background: INK, opacity: 0.3, maxWidth: 140 }} />
      <div
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: 11,
          letterSpacing: 3,
          color: INK,
          fontWeight: 400,
          fontStyle: 'italic',
        }}
      >
        AutumnFaun Dashboard
      </div>
      <div style={{ flex: 1, height: 1, background: INK, opacity: 0.3, maxWidth: 140 }} />
    </div>
  )
}
