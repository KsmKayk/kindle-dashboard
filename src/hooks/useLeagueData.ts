'use client'

import { useState, useEffect } from 'react'
import type { LeagueData } from '@/types'

export function useLeagueData(): LeagueData | null {
  const [data, setData] = useState<LeagueData | null>(null)
  const interval = parseInt(process.env.NEXT_PUBLIC_LEAGUE_UPDATE_RATE ?? '600', 10) * 1000

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/league')
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
