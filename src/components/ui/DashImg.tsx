'use client'

import { useState } from 'react'

const INK = '#1a1612'
const INK_SOFT = '#3a342c'
const PAPER_LIGHT = '#f1ede2'

interface DashImgProps {
  src: string | null | undefined
  fallback: string
  alt: string
  radius?: number
}

function proxyUrl(src: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(src)}`
}

export function DashImg({ src, fallback, alt, radius = 0 }: DashImgProps) {
  const [failed, setFailed] = useState(false)

  if (failed || !src) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: INK_SOFT,
          backgroundImage: `repeating-linear-gradient(45deg, ${INK_SOFT} 0 2px, ${INK} 2px 4px)`,
          color: PAPER_LIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.5,
          textAlign: 'center',
          padding: 3,
          borderRadius: radius,
          boxSizing: 'border-box',
          lineHeight: 1.1,
          whiteSpace: 'pre-line',
        }}
      >
        {fallback}
      </div>
    )
  }

  return (
    <img
      src={proxyUrl(src)}
      alt={alt}
      onError={() => setFailed(true)}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        filter: 'contrast(1.3) brightness(0.95)',
        display: 'block',
        borderRadius: radius,
      }}
    />
  )
}
