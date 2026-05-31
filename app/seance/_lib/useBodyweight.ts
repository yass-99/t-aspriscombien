'use client'

import { useEffect, useState } from 'react'
import type { Bodyweight } from './profile'

// Cache mémoire + localStorage partagé, invalidé manuellement après un POST pesée.
const STORAGE_KEY = 'tcp:bodyweight:v2'

type Data = { bodyweights: Bodyweight[]; current: number | null; lastDate: string | null }
type State = Data & { loading: boolean; error: string | null }
type CachePayload = { ts: number } & Data

let memoryCache: CachePayload | null = null
const subscribers = new Set<() => void>()

function readStorage(): CachePayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachePayload
    if (!parsed || !Array.isArray(parsed.bodyweights)) return null
    return parsed
  } catch {
    return null
  }
}

function writeStorage(payload: CachePayload | null) {
  if (typeof window === 'undefined') return
  try {
    if (payload) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // quota / mode privé : on continue sans persistance.
  }
}

export function invalidateBodyweightCache() {
  for (const fn of subscribers) fn()
}

let inflight: Promise<Data> | null = null

async function fetchBodyweight(): Promise<Data> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await fetch('/api/bodyweight', { cache: 'no-store' })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error ?? `Erreur ${res.status}`)
      }
      const d = (await res.json()) as Data
      memoryCache = { ts: Date.now(), ...d }
      writeStorage(memoryCache)
      return d
    } finally {
      inflight = null
    }
  })()
  return inflight
}

const EMPTY: Data = { bodyweights: [], current: null, lastDate: null }

export function useBodyweight() {
  const [state, setState] = useState<State>(() => {
    if (memoryCache) return { ...memoryCache, loading: false, error: null }
    const stored = readStorage()
    if (stored) {
      memoryCache = stored
      return { ...stored, loading: false, error: null }
    }
    return { ...EMPTY, loading: true, error: null }
  })

  useEffect(() => {
    let cancelled = false
    // Stale-while-revalidate : on revalide toujours au montage (un cache vide
    // mis lors d'un échec ne doit pas masquer les données serveur).
    fetchBodyweight()
      .then((d) => {
        if (!cancelled) setState({ ...d, loading: false, error: null })
      })
      .catch((e) => {
        // Sur échec, on garde d'éventuelles données déjà chargées.
        if (!cancelled)
          setState((s) => ({
            ...s,
            loading: false,
            error: e instanceof Error ? e.message : 'Erreur réseau',
          }))
      })

    const onInvalidate = () => {
      if (cancelled) return
      fetchBodyweight()
        .then((d) => {
          if (!cancelled) setState({ ...d, loading: false, error: null })
        })
        .catch(() => {})
    }
    subscribers.add(onInvalidate)
    return () => {
      cancelled = true
      subscribers.delete(onInvalidate)
    }
  }, [])

  return state
}
