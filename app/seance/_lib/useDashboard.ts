'use client'

import { createCachedResource } from './createCachedResource'

export type Period = '7d' | '30d' | '90d'

export type DistributionItem = {
  type: string
  label: string
  seances: number
  volume: number
  percent: number
}

export type TopExo = {
  nom: string
  volume: number
  volumePrev: number
  trendPct: number | null
  sparkline: number[]
}

export type BlindSpot = {
  type: string
  label: string
  daysSince: number | null
}

export type RecentPR = {
  nom: string
  poids: number
  reps: number
  date: string
}

export type DashboardData = {
  // Legacy (IdleScreen)
  week: {
    volume: number
    volumePrev: number
    seances: number
    series: number
    daily: number[] // volume par jour Lun→Dim (courbe « rythme » de la semaine)
  }
  lastSeance: {
    id: string
    type: string
    date: string
    exos: { nom: string; topSet: { poids: number; reps: number } | null }[]
    seriesCount: number
  } | null
  fourWeeks: {
    volumeTotal: number
    seances: number
    series: number
    avgLoad: number
    chart: { label: string; volume: number; current: boolean }[]
  }
  prs: { nom: string; poids: number; reps: number }[]

  // New (StatsScreen)
  period: Period
  hero: {
    volume: number
    volumePrev: number | null
    seances: number
    series: number
    avgLoad: number
    sparkline12w: number[]
  }
  distribution: DistributionItem[]
  topExos: TopExo[]
  blindSpots: BlindSpot[]
  recentPrs: RecentPR[]
}

const STALE_MS = 3 * 60 * 1000 // 3 min — cohérent avec useExos.

// Payload complet de StatsScreen, caché par période (variante = '7d'|'30d'|…).
const resource = createCachedResource<DashboardData>({
  storageKey: 'tcp:dashboard:stats:v1',
  staleMs: STALE_MS,
  fetcher: async (variant) => {
    const qs = variant ? `?period=${encodeURIComponent(variant)}` : ''
    const res = await fetch(`/api/dashboard${qs}`, { cache: 'no-store' })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e.error ?? `Erreur ${res.status}`)
    }
    return (await res.json()) as DashboardData
  },
})

/** À appeler après save/edit/delete d'une séance (toutes périodes confondues). */
export const invalidateDashboard = () => resource.invalidate()

export function useDashboard(period: Period = '7d') {
  return resource.useResource(period)
}
