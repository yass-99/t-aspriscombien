import type { Run } from './types'

export const DISTANCE_PRESETS_M = [80, 100, 200, 250, 300, 400] as const

// Borne haute pour la saisie libre — au-delà ce n'est plus du sprint court.
export const DISTANCE_MIN_M = 30
export const DISTANCE_MAX_M = 1000

/**
 * Formate une durée en ms vers une string lisible.
 *   - < 60s  →  « 12,45 »  (sec,cent)
 *   - ≥ 60s  →  « 1:23,45 »
 */
export function formatChrono(ms: number): string {
  if (ms < 0) ms = 0
  const totalCs = Math.round(ms / 10) // centièmes
  const cs = totalCs % 100
  const totalS = Math.floor(totalCs / 100)
  const s = totalS % 60
  const m = Math.floor(totalS / 60)
  const csStr = String(cs).padStart(2, '0')
  if (m === 0) {
    return `${s},${csStr}`
  }
  return `${m}:${String(s).padStart(2, '0')},${csStr}`
}

/**
 * Variante compacte sans centièmes — pour les listes denses.
 */
export function formatChronoShort(ms: number): string {
  const totalS = Math.round(ms / 1000)
  const s = totalS % 60
  const m = Math.floor(totalS / 60)
  if (m === 0) return `${s}s`
  return `${m}min ${String(s).padStart(2, '0')}`
}

/**
 * Parse une saisie « 12,45 » / « 12.45 » / « 1:23,45 » → ms.
 * Retourne null si invalide.
 */
export function parseChrono(input: string): number | null {
  const cleaned = input.trim().replace(',', '.')
  if (cleaned === '') return null
  // Format mm:ss(.cc)
  const colonMatch = /^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/.exec(cleaned)
  if (colonMatch) {
    const m = parseInt(colonMatch[1], 10)
    const s = parseInt(colonMatch[2], 10)
    const frac = colonMatch[3] ? parseFloat('0.' + colonMatch[3]) : 0
    if (s >= 60) return null
    return Math.round((m * 60 + s + frac) * 1000)
  }
  // Format SS(.cc) — secondes en décimal.
  const decMatch = /^(\d+)(?:\.(\d{1,3}))?$/.exec(cleaned)
  if (decMatch) {
    const s = parseInt(decMatch[1], 10)
    const frac = decMatch[2] ? parseFloat('0.' + decMatch[2]) : 0
    return Math.round((s + frac) * 1000)
  }
  return null
}

/**
 * Pour chaque distance, retourne le meilleur temps (PR) + nb de runs + dernier run.
 */
export type DistanceSummary = {
  distance_m: number
  count: number
  best?: Run
  latest?: Run
}

export function summarizeByDistance(runs: Run[]): DistanceSummary[] {
  const byDist = new Map<number, Run[]>()
  for (const r of runs) {
    const arr = byDist.get(r.distance_m)
    if (arr) arr.push(r)
    else byDist.set(r.distance_m, [r])
  }
  const out: DistanceSummary[] = []
  for (const [dist, list] of byDist) {
    const best = list.reduce<Run | undefined>(
      (b, r) => (!b || r.duration_ms < b.duration_ms ? r : b),
      undefined,
    )
    // runs sont déjà triés date desc côté API → latest = premier élément.
    const latest = list[0]
    out.push({ distance_m: dist, count: list.length, best, latest })
  }
  out.sort((a, b) => a.distance_m - b.distance_m)
  return out
}

export function formatRunDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
    .format(d)
    .replace('.', '')
}
