'use client'

import { createCachedResource } from './createCachedResource'
import type { PlanEntry } from './plan'

const resource = createCachedResource<{ entries: PlanEntry[] }>({
  storageKey: 'tcp:plan:v1',
  staleMs: 3 * 60 * 1000,
  fetcher: (weekStart) =>
    fetch(`/api/plan?weekStart=${weekStart}`).then((r) => {
      if (!r.ok) throw new Error('Échec chargement du plan')
      return r.json()
    }),
})

// À appeler après enregistrement du modal (purge SWR de la semaine éditée).
export const invalidatePlan = resource.invalidate

export function usePlan(weekStart: string): {
  entries: PlanEntry[]
  loading: boolean
  error: string | null
} {
  const { data, loading, error } = resource.useResource(weekStart)
  return { entries: data?.entries ?? [], loading, error }
}
