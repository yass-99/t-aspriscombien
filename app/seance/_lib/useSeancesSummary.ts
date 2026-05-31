'use client'

import { createCachedResource } from './createCachedResource'

// Résumé d'une séance dans l'historique — cf /api/seances (RPC seance_history_summary).
export type SeanceSummary = {
  id: string
  date: string
  type: string
  exosCount: number
  seriesCount: number
  volume: number
}

const STALE_MS = 3 * 60 * 1000 // 3 min — cohérent avec useExos.

const resource = createCachedResource<SeanceSummary[]>({
  storageKey: 'tcp:seances:summary:v1',
  staleMs: STALE_MS,
  fetcher: async () => {
    const res = await fetch('/api/seances', { cache: 'no-store' })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e.error ?? `Erreur ${res.status}`)
    }
    const d = (await res.json()) as { seances: SeanceSummary[] }
    return d.seances
  },
})

export const useSeancesSummary = resource.useResource
/** À appeler après save/edit/delete d'une séance. */
export const invalidateSeancesSummary = resource.invalidate
