'use client'

import { useCallback } from 'react'
import type { Run } from './types'
import { createCachedResource } from './createCachedResource'
import { invalidateHomeDashboard } from './useHomeDashboard'
import { invalidateHeatmap } from './useHeatmap'

const STALE_MS = 3 * 60 * 1000 // 3 min — cohérent avec useExos.

// Variante = la distance filtrée (ou '' pour la liste complète) → cache distinct.
const resource = createCachedResource<Run[]>({
  storageKey: 'tcp:runs:v1',
  staleMs: STALE_MS,
  fetcher: async (variant) => {
    const url = variant ? `/api/runs?distance_m=${variant}` : '/api/runs'
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e.error ?? `Erreur ${res.status}`)
    }
    const d = (await res.json()) as { runs: Run[] }
    return d.runs
  },
})

/** Invalide tous les caches de runs (toutes distances confondues). */
export const invalidateRuns = () => resource.invalidate()

/**
 * Charge les runs (optionnellement filtrés par distance) avec cache SWR partagé.
 * create/remove font la mutation puis invalident les runs + l'accueil (la semaine
 * inclut l'athlé).
 */
export function useRuns(distance?: number) {
  const variant = distance ? String(distance) : ''
  const { data, loading, error } = resource.useResource(variant)

  const refresh = useCallback(() => resource.invalidate(variant), [variant])

  const create = useCallback(
    async (payload: { distance_m: number; duration_ms: number; date?: string }): Promise<Run> => {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error ?? `Erreur ${res.status}`)
      }
      const data = (await res.json()) as { run: Run }
      invalidateRuns()
      invalidateHomeDashboard()
      invalidateHeatmap()
      return data.run
    },
    [],
  )

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/runs/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e.error ?? `Erreur ${res.status}`)
    }
    invalidateRuns()
    invalidateHomeDashboard()
    invalidateHeatmap()
  }, [])

  return { runs: data ?? [], loading, error, refresh, create, remove }
}
