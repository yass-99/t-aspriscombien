'use client'

import { useEffect, useState } from 'react'

export type ExoSuggestion = {
  nom: string
  count: number
  lastDate: string | null
  lastPoids: number | null
  lastReps: number | null
  topPoids: number | null
  // Flags du dernier usage — pré-cochent PDC / unilatéral à la saisie.
  lastIsBodyweight: boolean
  lastIsUnilateral: boolean
  types: string[]
}

type State = {
  exos: ExoSuggestion[]
  loading: boolean
  error: string | null
}

// ═══════════════════════════════════════════════════════════════════════════
// Cache localStorage + mémoire — partagé entre tous les hooks instanciés.
// Le cache est invalidé manuellement via `invalidateExosCache()` après chaque
// mutation côté client (création/édition/suppression de séance). Aucun appel
// DB redondant tant que rien n'a changé.
// ═══════════════════════════════════════════════════════════════════════════

// Bump le suffixe de version quand la FORME des suggestions change ou qu'un
// changement serveur doit invalider tous les caches existants en une fois
// (ex: ajout du catalogue exercises). Les anciennes clés deviennent orphelines
// et ne sont plus relues.
const STORAGE_KEY = 'tcp:exos:v2'

// Durée de fraîcheur du cache. Au-delà, on réaffiche immédiatement les données
// en cache (pas de flash) MAIS on déclenche un refetch silencieux en arrière-plan
// → les MAJ côté serveur (nouveaux exos catalogue, etc.) finissent par remonter
// sans dépendre d'une mutation de séance.
const STALE_MS = 3 * 60 * 1000 // 3 min

type CachePayload = {
  ts: number
  exos: ExoSuggestion[]
}

let memoryCache: CachePayload | null = null
const subscribers = new Set<() => void>()

function isStale(c: CachePayload | null): boolean {
  return !c || Date.now() - c.ts > STALE_MS
}

function readStorage(): CachePayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachePayload
    if (!parsed || !Array.isArray(parsed.exos)) return null
    return parsed
  } catch {
    return null
  }
}

function writeStorage(payload: CachePayload | null) {
  if (typeof window === 'undefined') return
  try {
    if (payload) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Quota plein / mode privé : on continue sans persistance.
  }
}

/**
 * Marque le cache comme périmé : les hooks abonnés vont refetch en
 * arrière-plan SANS perdre l'affichage courant (stale-while-revalidate).
 * À appeler après tout POST/PUT/DELETE de séance.
 */
export function invalidateExosCache() {
  // On ne vide PAS memoryCache immédiatement : on garde les données affichées
  // pendant le refetch. Le cache est écrasé dès que la nouvelle réponse arrive.
  for (const fn of subscribers) fn()
}

let inflight: Promise<ExoSuggestion[]> | null = null

async function fetchExos(): Promise<ExoSuggestion[]> {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await fetch('/api/exos', { cache: 'no-store' })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error ?? `Erreur ${res.status}`)
      }
      const d = (await res.json()) as { exos: ExoSuggestion[] }
      memoryCache = { ts: Date.now(), exos: d.exos }
      writeStorage(memoryCache)
      return d.exos
    } finally {
      inflight = null
    }
  })()
  return inflight
}


export function useExos() {
  // Bootstrap synchrone depuis localStorage (évite un flash vide).
  const [state, setState] = useState<State>(() => {
    if (memoryCache) return { exos: memoryCache.exos, loading: false, error: null }
    const stored = readStorage()
    if (stored) {
      memoryCache = stored
      return { exos: stored.exos, loading: false, error: null }
    }
    return { exos: [], loading: true, error: null }
  })

  useEffect(() => {
    let cancelled = false

    // Refetch en arrière-plan. `silent` = on garde l'affichage courant et on ne
    // remonte pas l'erreur (utile quand on a déjà des données en cache).
    const revalidate = (silent: boolean) => {
      fetchExos()
        .then((exos) => {
          if (!cancelled) setState({ exos, loading: false, error: null })
        })
        .catch((e) => {
          if (cancelled || silent) return
          setState({
            exos: [],
            loading: false,
            error: e instanceof Error ? e.message : 'Erreur réseau',
          })
        })
    }

    if (memoryCache) {
      // Affichage instantané depuis le cache…
      setState({ exos: memoryCache.exos, loading: false, error: null })
      // …puis revalidation silencieuse si le cache est périmé (stale-while-revalidate).
      if (isStale(memoryCache)) revalidate(true)
    } else {
      revalidate(false)
    }

    // Invalidation explicite (après save/edit/delete séance) → refetch silencieux.
    const onInvalidate = () => {
      if (!cancelled) revalidate(true)
    }
    subscribers.add(onInvalidate)
    return () => {
      cancelled = true
      subscribers.delete(onInvalidate)
    }
  }, [])

  return state
}

/**
 * Recherche tolérante : matche le terme dans le nom (case + accents insensible).
 *
 * Comportement sans requête :
 *   - Si `workoutType` est fourni → filtrage STRICT sur ce type
 *     (ex: type=legs → uniquement les exos déjà pratiqués en jambes).
 *   - Sinon → tous les exos triés par récence.
 *
 * Comportement avec requête :
 *   - Match par nom (préfixe > inclusion > tokens), bonus si le type matche.
 *   - Ne filtre pas par type pour permettre de retrouver un exo cross-type.
 */
export function filterExos(
  exos: ExoSuggestion[],
  query: string,
  workoutType?: string,
): ExoSuggestion[] {
  const q = normalize(query.trim())
  if (!q) {
    if (workoutType) {
      return exos.filter((e) => e.types.includes(workoutType))
    }
    return exos
  }
  const matches = exos
    .map((e) => ({
      exo: e,
      score: scoreMatch(normalize(e.nom), q, workoutType ? e.types.includes(workoutType) : false),
    }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
  return matches.map((m) => m.exo)
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function scoreMatch(nomNorm: string, qNorm: string, typeMatch: boolean): number {
  if (nomNorm === qNorm) return 1000 + (typeMatch ? 50 : 0)
  if (nomNorm.startsWith(qNorm)) return 500 + (typeMatch ? 50 : 0)
  if (nomNorm.includes(qNorm)) return 200 + (typeMatch ? 50 : 0)
  const tokens = qNorm.split(/\s+/).filter(Boolean)
  if (tokens.every((t) => nomNorm.includes(t))) return 100 + (typeMatch ? 50 : 0)
  return 0
}

// ═══════════════════════════════════════════════════════════════════════════
// Constante d'affichage : max d'exos à montrer en pills.
// ═══════════════════════════════════════════════════════════════════════════
export const MAX_EXO_PILLS = 6
