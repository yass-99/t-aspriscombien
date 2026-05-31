'use client'

import { useEffect, useState } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// Fabrique de ressource cachée — généralise le pattern éprouvé de useExos :
// cache mémoire + localStorage, stale-while-revalidate, dédup des requêtes
// concurrentes (inflight), et invalidation explicite après mutation.
//
// Une « variante » (ex: la période d'un dashboard de stats) produit une entrée
// de cache distincte (clé `${storageKey}:${variant}`). Pour les ressources sans
// paramètre, la variante vaut '' implicitement.
//
//   const { useResource, invalidate } = createCachedResource<Data>({
//     storageKey: 'tcp:dashboard:home:v1',
//     staleMs: 3 * 60 * 1000,
//     fetcher: () => fetch('/api/dashboard/home').then(r => r.json()),
//   })
//
// Bump le suffixe de version (vN) dans storageKey quand la FORME des données
// change → purge automatique des anciens caches (clés orphelines).
// ═══════════════════════════════════════════════════════════════════════════

type CachePayload<T> = { ts: number; data: T }

export type CachedResourceState<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

type Options<T> = {
  storageKey: string
  staleMs: number
  // `variant` = la même valeur que celle passée à useResource/invalidate.
  fetcher: (variant: string) => Promise<T>
  // Garde-fou optionnel : rejette un payload localStorage corrompu/périmé de forme.
  validate?: (data: unknown) => data is T
}

export function createCachedResource<T>(opts: Options<T>) {
  const { storageKey, staleMs, fetcher, validate } = opts

  // État par variante — chaque période/clé a son cache, ses abonnés, son inflight.
  const memory = new Map<string, CachePayload<T>>()
  const subscribers = new Map<string, Set<() => void>>()
  const inflight = new Map<string, Promise<T>>()

  const fullKey = (variant: string) => (variant ? `${storageKey}:${variant}` : storageKey)
  const isStale = (c: CachePayload<T> | undefined) => !c || Date.now() - c.ts > staleMs

  function readStorage(variant: string): CachePayload<T> | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(fullKey(variant))
      if (!raw) return null
      const parsed = JSON.parse(raw) as CachePayload<T>
      if (!parsed || typeof parsed.ts !== 'number') return null
      if (validate && !validate(parsed.data)) return null
      return parsed
    } catch {
      return null
    }
  }

  function writeStorage(variant: string, payload: CachePayload<T>) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(fullKey(variant), JSON.stringify(payload))
    } catch {
      // Quota plein / mode privé : on continue sans persistance.
    }
  }

  function subsFor(variant: string): Set<() => void> {
    let s = subscribers.get(variant)
    if (!s) {
      s = new Set()
      subscribers.set(variant, s)
    }
    return s
  }

  function fetchData(variant: string): Promise<T> {
    const existing = inflight.get(variant)
    if (existing) return existing
    const p = (async () => {
      try {
        const data = await fetcher(variant)
        const payload = { ts: Date.now(), data }
        memory.set(variant, payload)
        writeStorage(variant, payload)
        return data
      } finally {
        inflight.delete(variant)
      }
    })()
    inflight.set(variant, p)
    return p
  }

  /**
   * Marque la (les) variante(s) comme périmée(s) : les hooks abonnés refetch en
   * arrière-plan SANS perdre l'affichage courant (stale-while-revalidate).
   * Sans argument → invalide toutes les variantes. À appeler après mutation.
   */
  function invalidate(variant?: string) {
    if (variant === undefined) {
      for (const s of subscribers.values()) for (const fn of s) fn()
      return
    }
    for (const fn of subsFor(variant)) fn()
  }

  function useResource(variant = ''): CachedResourceState<T> {
    // Bootstrap synchrone (cache mémoire puis localStorage) → pas de flash vide.
    const [state, setState] = useState<CachedResourceState<T>>(() => {
      const mem = memory.get(variant)
      if (mem) return { data: mem.data, loading: false, error: null }
      const stored = readStorage(variant)
      if (stored) {
        memory.set(variant, stored)
        return { data: stored.data, loading: false, error: null }
      }
      return { data: null, loading: true, error: null }
    })

    useEffect(() => {
      let cancelled = false

      const revalidate = (silent: boolean) => {
        fetchData(variant)
          .then((data) => {
            if (!cancelled) setState({ data, loading: false, error: null })
          })
          .catch((e) => {
            if (cancelled || silent) return
            setState((prev) => ({
              data: prev.data,
              loading: false,
              error: e instanceof Error ? e.message : 'Erreur réseau',
            }))
          })
      }

      const mem = memory.get(variant)
      if (mem) {
        setState({ data: mem.data, loading: false, error: null })
        if (isStale(mem)) revalidate(true)
      } else {
        revalidate(false)
      }

      const onInvalidate = () => {
        if (!cancelled) revalidate(true)
      }
      const subs = subsFor(variant)
      subs.add(onInvalidate)
      return () => {
        cancelled = true
        subs.delete(onInvalidate)
      }
    }, [variant])

    return state
  }

  return { useResource, invalidate }
}
