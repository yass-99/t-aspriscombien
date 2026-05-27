'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Run } from './types'

type State = {
  runs: Run[]
  loading: boolean
  error: string | null
}

/**
 * Hook simple: charge les runs (optionnellement filtrés par distance), expose
 * les helpers create/remove qui rechargent côté serveur après succès.
 */
export function useRuns(distance?: number) {
  const [state, setState] = useState<State>({ runs: [], loading: true, error: null })

  const fetchRuns = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const url = distance ? `/api/runs?distance_m=${distance}` : '/api/runs'
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        setState({ runs: [], loading: false, error: e.error ?? `Erreur ${res.status}` })
        return
      }
      const d = (await res.json()) as { runs: Run[] }
      setState({ runs: d.runs, loading: false, error: null })
    } catch (e) {
      setState({
        runs: [],
        loading: false,
        error: e instanceof Error ? e.message : 'Erreur réseau',
      })
    }
  }, [distance])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  const create = useCallback(
    async (payload: { distance_m: number; duration_ms: number; date?: string }) => {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error ?? `Erreur ${res.status}`)
      }
      await fetchRuns()
    },
    [fetchRuns],
  )

  const remove = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/runs/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error ?? `Erreur ${res.status}`)
      }
      await fetchRuns()
    },
    [fetchRuns],
  )

  return { ...state, refresh: fetchRuns, create, remove }
}
