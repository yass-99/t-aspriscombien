'use client'

import { useEffect, useState } from 'react'
import type { Profile } from './profile'

// Cache mémoire + localStorage partagé, invalidé manuellement après un PUT profil.
const STORAGE_KEY = 'tcp:profile:v2'

type State = { profile: Profile | null; loading: boolean; error: string | null }
type CachePayload = { ts: number; profile: Profile | null }

let memoryCache: CachePayload | null = null
const subscribers = new Set<() => void>()

function readStorage(): CachePayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CachePayload
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

export function invalidateProfileCache() {
  for (const fn of subscribers) fn()
}

let inflight: Promise<Profile | null> | null = null

async function fetchProfile(): Promise<Profile | null> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error ?? `Erreur ${res.status}`)
      }
      const d = (await res.json()) as { profile: Profile | null }
      memoryCache = { ts: Date.now(), profile: d.profile }
      writeStorage(memoryCache)
      return d.profile
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export function useProfile() {
  const [state, setState] = useState<State>(() => {
    // On ne fait confiance qu'à un profil NON-null en cache pour l'affichage
    // instantané. Un cache `null` (issu d'un échec passé) ne prouve pas que le
    // profil est vide → on reste en `loading` jusqu'à la revalidation réseau,
    // sinon l'onboarding « remplis ton profil » s'affiche à tort.
    if (memoryCache?.profile) return { profile: memoryCache.profile, loading: false, error: null }
    const stored = readStorage()
    if (stored?.profile) {
      memoryCache = stored
      return { profile: stored.profile, loading: false, error: null }
    }
    return { profile: null, loading: true, error: null }
  })

  useEffect(() => {
    let cancelled = false
    // Stale-while-revalidate : on revalide TOUJOURS au montage, même si un cache
    // existe. Sinon un `profile: null` mis en cache lors d'un échec précédent
    // masque indéfiniment les données serveur (aucun refetch sans invalidation).
    fetchProfile()
      .then((profile) => {
        if (!cancelled) setState({ profile, loading: false, error: null })
      })
      .catch((e) => {
        // En cas d'échec, on conserve un éventuel profil déjà chargé.
        if (!cancelled)
          setState((s) => ({
            profile: s.profile,
            loading: false,
            error: e instanceof Error ? e.message : 'Erreur réseau',
          }))
      })

    const onInvalidate = () => {
      if (cancelled) return
      fetchProfile()
        .then((profile) => {
          if (!cancelled) setState({ profile, loading: false, error: null })
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
