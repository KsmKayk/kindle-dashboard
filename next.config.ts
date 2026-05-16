import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [],
  },
  env: {
    NEXT_PUBLIC_STEAM_UPDATE_RATE: process.env.STEAM_UPDATE_RATE ?? '60',
    NEXT_PUBLIC_LEAGUE_UPDATE_RATE: process.env.LEAGUE_UPDATE_RATE ?? '600',
    NEXT_PUBLIC_SPOTIFY_UPDATE_RATE: process.env.SPOTIFY_UPDATE_RATE ?? '5',
  },
}

export default nextConfig
