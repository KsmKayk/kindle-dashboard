'use client'

import { useState, useEffect } from 'react'
import type { SteamData } from '@/types'

export function useSteamData(): SteamData | null {
  const [data, setData] = useState<SteamData | null>(null)
  const interval = parseInt(process.env.NEXT_PUBLIC_STEAM_UPDATE_RATE ?? '60', 10) * 1000

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/steam')
        if (res.ok) setData(await res.json())
      } catch {
        // keep previous data on network error
      }
    }

    fetchData()
    const id = setInterval(fetchData, interval)
    return () => clearInterval(id)
  }, [interval])

  return data
}
