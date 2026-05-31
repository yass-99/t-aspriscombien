'use client'

import { createCachedResource } from './createCachedResource'

// Données légères de l'accueil (IdleScreen) — cf /api/dashboard/home.
export type HomeDashboardData = {
  week: {
    volume: number
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
}

const STALE_MS = 3 * 60 * 1000 // 3 min — cohérent avec useExos.

const resource = createCachedResource<HomeDashboardData>({
  storageKey: 'tcp:dashboard:home:v1',
  staleMs: STALE_MS,
  fetcher: async () => {
    const res = await fetch('/api/dashboard/home', { cache: 'no-store' })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e.error ?? `Erreur ${res.status}`)
    }
    return (await res.json()) as HomeDashboardData
  },
})

export const useHomeDashboard = resource.useResource
/** À appeler après save/edit/delete d'une séance ou d'un run (semaine inclut l'athlé). */
export const invalidateHomeDashboard = resource.invalidate
