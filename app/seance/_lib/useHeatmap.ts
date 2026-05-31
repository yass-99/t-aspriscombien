'use client'

import { createCachedResource } from './createCachedResource'
import type { Period } from './useDashboard'

export type MuscleGroupKey =
  | 'chest'
  | 'shoulders'
  | 'back'
  | 'biceps'
  | 'forearms'
  | 'triceps'
  | 'quads'
  | 'glutes'
  | 'hamstrings'
  | 'calves'
  | 'traps'
  | 'core'

export type HeatmapWeighted = {
  volume: number
  series: number
  lastSessionDaysAgo: number | null
}

export type HeatmapRunningBestRun = {
  distance_m: number
  duration_ms: number
  prPct: number
}

export type HeatmapRunning = {
  distance: number
  duration: number
  runs: number
  avgPrPct: number | null
  bestRun: HeatmapRunningBestRun | null
  lastSessionDaysAgo: number | null
}

export type HeatmapGroup = {
  groupId: number
  groupKey: MuscleGroupKey
  label: string
  weighted: HeatmapWeighted
  running: HeatmapRunning
}

export type HeatmapData = {
  period: Period
  maxWeightedVolume: number
  maxRunningDistance: number
  groups: HeatmapGroup[]
}

const STALE_MS = 3 * 60 * 1000 // 3 min — cohérent avec useDashboard.

// Heatmap cachée par période (variante = '7d'|'30d'|…). Aligne la heatmap sur la
// convention de cache du reste de l'app (createCachedResource) : bootstrap
// SYNCHRONE depuis le cache mémoire/localStorage → dès qu'on arrive sur Muscu,
// la heatmap est déjà peinte (plus de `loading` reparti de zéro à chaque visite,
// plus de dépendance au timing du fetch). Stale-while-revalidate en arrière-plan.
const resource = createCachedResource<HeatmapData>({
  storageKey: 'tcp:heatmap:v1',
  staleMs: STALE_MS,
  fetcher: async (variant) => {
    const qs = variant ? `?period=${encodeURIComponent(variant)}` : ''
    const res = await fetch(`/api/heatmap${qs}`, { cache: 'no-store' })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e.error ?? `Erreur ${res.status}`)
    }
    return (await res.json()) as HeatmapData
  },
})

/** À appeler après mutation d'une séance OU d'un run (la course alimente la heatmap). */
export const invalidateHeatmap = () => resource.invalidate()

export function useHeatmap(period?: Period) {
  return resource.useResource(period ?? '')
}
