import type { Run } from './types'
import { formatProfileLine, type ProfileHeader } from './helpers'

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
 * Vitesse maximale (m/s) connue pour chaque distance, sur l'historique complet.
 * Sert de base au calcul du %PR sur une période donnée (intensité cardio par muscle, etc.).
 */
export function computePrSpeedByDistance(allRuns: Run[]): Map<number, number> {
  const out = new Map<number, number>()
  for (const r of allRuns) {
    if (!r.distance_m || !r.duration_ms || r.duration_ms <= 0) continue
    const speed = r.distance_m / (r.duration_ms / 1000)
    const cur = out.get(r.distance_m)
    if (cur == null || speed > cur) out.set(r.distance_m, speed)
  }
  return out
}

/**
 * Intensité moyenne pondérée par distance : Σ(distance × %PR) / Σ distance.
 * Retourne null si aucun run exploitable.
 *   - Si la distance n'a pas de PR connu (1ʳᵉ fois), prPct = 1 (le run est son propre PR).
 */
export function computeAvgPrPct(
  runs: Run[],
  prSpeedByDistance: Map<number, number>,
): number | null {
  let weightedSum = 0
  let weightTotal = 0
  for (const r of runs) {
    if (!r.distance_m || !r.duration_ms || r.duration_ms <= 0) continue
    const runSpeed = r.distance_m / (r.duration_ms / 1000)
    const prSpeed = prSpeedByDistance.get(r.distance_m) ?? runSpeed
    const prPct = prSpeed > 0 ? runSpeed / prSpeed : 0
    weightedSum += r.distance_m * prPct
    weightTotal += r.distance_m
  }
  return weightTotal > 0 ? weightedSum / weightTotal : null
}

/**
 * Allure moyenne (m/s) pondérée par distance sur une liste de runs.
 * Retourne 0 si aucun run.
 */
export function computeAvgSpeed(runs: Run[]): number {
  let weightedSum = 0
  let weightTotal = 0
  for (const r of runs) {
    if (!r.distance_m || !r.duration_ms || r.duration_ms <= 0) continue
    const speed = r.distance_m / (r.duration_ms / 1000)
    weightedSum += r.distance_m * speed
    weightTotal += r.distance_m
  }
  return weightTotal > 0 ? weightedSum / weightTotal : 0
}

/**
 * Activité par jour sur les N derniers jours glissants (par défaut 28 = 4 semaines).
 * Le résultat est ordonné du plus ancien au plus récent ; le dernier élément est aujourd'hui.
 */
export type DayActivity = {
  date: string
  isToday: boolean
  runs: number
}

export function bucketActivityDays(allRuns: Run[], daysWindow = 28): DayActivity[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  const runsByDate = new Map<string, number>()
  for (const r of allRuns) {
    if (!r.date) continue
    runsByDate.set(r.date, (runsByDate.get(r.date) ?? 0) + 1)
  }

  const out: DayActivity[] = []
  for (let i = daysWindow - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    out.push({
      date: dateStr,
      isToday: dateStr === todayStr,
      runs: runsByDate.get(dateStr) ?? 0,
    })
  }
  return out
}

/**
 * Activité par jour sur une fenêtre glissante de `windowDays` jours se terminant
 * `endDaysAgo` jours avant aujourd'hui (0 = fenêtre finissant aujourd'hui).
 * Sert à paginer le calendrier de régularité par tranches sans recharger.
 */
export function bucketActivityWindow(
  allRuns: Run[],
  endDaysAgo: number,
  windowDays: number,
): DayActivity[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  const runsByDate = new Map<string, number>()
  for (const r of allRuns) {
    if (!r.date) continue
    runsByDate.set(r.date, (runsByDate.get(r.date) ?? 0) + 1)
  }

  const out: DayActivity[] = []
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - endDaysAgo - i)
    const dateStr = d.toISOString().slice(0, 10)
    out.push({
      date: dateStr,
      isToday: dateStr === todayStr,
      runs: runsByDate.get(dateStr) ?? 0,
    })
  }
  return out
}

/**
 * Nombre de jours (>=1) entre le 1er run et aujourd'hui. 0 si aucun run.
 * Helper hors composant : encapsule `new Date()` pour ne pas violer la règle
 * de pureté du render (react-hooks/purity).
 */
export function daysSinceFirstRun(runs: Run[]): number {
  if (runs.length === 0) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let first = Infinity
  for (const r of runs) {
    if (!r.date) continue
    const t = new Date(r.date + 'T00:00:00').getTime()
    if (t < first) first = t
  }
  if (!Number.isFinite(first)) return 0
  return Math.ceil((today.getTime() - first) / 86400000) + 1
}

/**
 * Allure moyenne (m/s) par semaine sur les N dernières semaines glissantes.
 * Une "semaine" = bloc de 7 jours ending à aujourd'hui. Index 0 = la semaine la plus ancienne.
 * Retourne `0` pour une semaine sans run (pour rester compatible avec Sparkline12w).
 */
export function bucketWeeklyAvgSpeed(allRuns: Run[], weeks = 12): number[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const buckets: Run[][] = Array.from({ length: weeks }, () => [])
  for (const r of allRuns) {
    if (!r.date) continue
    const d = new Date(r.date + 'T00:00:00')
    const daysAgo = Math.floor((today.getTime() - d.getTime()) / 86400000)
    if (daysAgo < 0) continue
    const weekIdx = Math.floor(daysAgo / 7)
    if (weekIdx >= weeks) continue
    // weekIdx=0 = cette semaine ; on veut index 0 = la plus ancienne → inverser.
    buckets[weeks - 1 - weekIdx].push(r)
  }
  return buckets.map((b) => computeAvgSpeed(b))
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

/**
 * Formate un timestamptz ISO → « HH:MM » locale FR. Pour les heures de runs.
 */
export function formatRunTime(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * Durée écoulée entre deux timestamps ISO → « 26 min », « 1 h 12 min ».
 */
export function formatSessionDuration(startedAt: string, endedAt: string): string {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  if (ms <= 0) return '0 min'
  const totalMin = Math.round(ms / 60000)
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

// ═══════════════════════════════════════════════════════════════════════════
// CALCUL % DU PR
// ═══════════════════════════════════════════════════════════════════════════

export type PRReference = {
  // ms du PR de référence (extrapolé ou exact)
  prMs: number
  // Distance source du PR. Égale à la distance courue si exact, > sinon.
  sourceDistance: number
  // True si la référence vient d'une distance plus longue (linear scaling).
  scaled: boolean
}

export type RunWithPR = {
  run: Run
  ref: PRReference | null
  // ratio = ref.prMs / run.duration_ms × 100 (lower time → higher %).
  // null si pas de référence (1ère fois sur cette distance, pas de longer non plus).
  pctOfPR: number | null
  // True si la course bat le PR historique exact (n'est marquée que pour le meilleur
  // résultat de la séance courante pour éviter de polluer avec des « beats » multiples).
  isNewPR: boolean
}

/**
 * Trouve le PR de référence pour une distance donnée parmi les runs passés.
 *   1. Match exact sur la distance → utilisé directement.
 *   2. Sinon, plus proche distance PLUS LONGUE avec un run → scaling linéaire par allure :
 *      pr_extrapolé = pr_source × (distance_actuelle / distance_source)
 *   3. Sinon (premier chrono sans distance plus longue disponible) → null.
 *
 * `pastRuns` doit exclure les runs de la session courante pour ne pas se comparer à soi-même.
 */
export function findPRReference(
  currentDistance: number,
  pastRuns: Run[],
): PRReference | null {
  // 1. Exact
  let bestExact: Run | null = null
  for (const r of pastRuns) {
    if (r.distance_m !== currentDistance) continue
    if (!bestExact || r.duration_ms < bestExact.duration_ms) bestExact = r
  }
  if (bestExact) {
    return { prMs: bestExact.duration_ms, sourceDistance: currentDistance, scaled: false }
  }

  // 2. Plus proche distance plus longue
  let closestLonger = Infinity
  for (const r of pastRuns) {
    if (r.distance_m > currentDistance && r.distance_m < closestLonger) {
      closestLonger = r.distance_m
    }
  }
  if (!Number.isFinite(closestLonger)) return null

  let bestLonger: Run | null = null
  for (const r of pastRuns) {
    if (r.distance_m !== closestLonger) continue
    if (!bestLonger || r.duration_ms < bestLonger.duration_ms) bestLonger = r
  }
  if (!bestLonger) return null

  return {
    prMs: bestLonger.duration_ms * (currentDistance / closestLonger),
    sourceDistance: closestLonger,
    scaled: true,
  }
}

/**
 * Calcule le % du PR pour chaque run de la session, marque le meilleur résultat
 * de la session comme « nouveau PR » s'il bat le PR historique exact.
 */
export function computeSessionRunsWithPR(
  sessionRuns: Run[],
  historicalRuns: Run[],
): RunWithPR[] {
  // sessionRuns triés chronologiquement (par created_at asc) pour l'affichage.
  const sorted = [...sessionRuns].sort((a, b) => a.created_at.localeCompare(b.created_at))

  // Pour identifier les « new PR » : on regarde, pour chaque distance présente
  // dans la session, le meilleur temps de la session vs le PR historique exact.
  const bestPerDistInSession = new Map<number, Run>()
  for (const r of sorted) {
    const cur = bestPerDistInSession.get(r.distance_m)
    if (!cur || r.duration_ms < cur.duration_ms) bestPerDistInSession.set(r.distance_m, r)
  }

  return sorted.map((run) => {
    const ref = findPRReference(run.distance_m, historicalRuns)
    const pct = ref ? (ref.prMs / run.duration_ms) * 100 : null

    // « New PR » uniquement si :
    //  - on a un PR historique exact (pas de scaling, sinon comparaison non fiable)
    //  - ce run est le meilleur de la session sur cette distance
    //  - il bat strictement le PR historique
    const isBestOfSession = bestPerDistInSession.get(run.distance_m)?.id === run.id
    const isNewPR =
      ref != null &&
      !ref.scaled &&
      isBestOfSession &&
      run.duration_ms < ref.prMs

    return { run, ref, pctOfPR: pct, isNewPR }
  })
}

/**
 * Formate le % du PR pour affichage : « 96,8 % », « 102,3 % », « — ».
 */
export function formatPct(pct: number | null): string {
  if (pct == null) return '—'
  return `${pct.toFixed(1).replace('.', ',')} %`
}

// ═══════════════════════════════════════════════════════════════════════════
// GROUPEMENT EN « SÉANCES » D'ATHLÉTISME
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Une « séance d'athlétisme » dérivée des runs : on regroupe par date locale,
 * puis on découpe sur les gaps > GROUP_GAP_MS (par défaut 90 min).
 * Pas de modèle DB dédié — on infère depuis `runs.created_at`.
 */
export type DerivedAthleticsSession = {
  // Identifiant stable basé sur le premier run.
  id: string
  date: string
  startedAt: string // ISO, premier created_at
  endedAt: string // ISO, dernier created_at
  runs: Run[]
}

const GROUP_GAP_MS = 90 * 60 * 1000 // 1h30

export function groupRunsIntoSessions(runs: Run[]): DerivedAthleticsSession[] {
  if (runs.length === 0) return []

  // Tri chrono ascendant pour grouper, puis on retournera dans l'ordre desc.
  const sorted = [...runs].sort((a, b) => a.created_at.localeCompare(b.created_at))

  const groups: Run[][] = []
  let current: Run[] = []
  let currentDate: string | null = null
  let lastTs: number | null = null

  for (const r of sorted) {
    const ts = new Date(r.created_at).getTime()
    const sameDay = r.date === currentDate
    const closeEnough = lastTs != null && ts - lastTs <= GROUP_GAP_MS
    if (current.length === 0 || (sameDay && closeEnough)) {
      current.push(r)
    } else {
      groups.push(current)
      current = [r]
    }
    currentDate = r.date
    lastTs = ts
  }
  if (current.length > 0) groups.push(current)

  const sessions: DerivedAthleticsSession[] = groups.map((g) => ({
    id: `as_${g[0].id}`,
    date: g[0].date,
    startedAt: g[0].created_at,
    endedAt: g[g.length - 1].created_at,
    runs: g,
  }))

  // Retourner desc (plus récent en premier) pour coller au reste de l'app.
  sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return sessions
}

/**
 * Formate une durée en ms vers une forme texte « 12,4s » / « 1:23,4 ».
 * Variante d'affichage pour le markdown — un seul décimal pour rester lisible.
 */
function formatChronoMd(ms: number): string {
  if (ms < 0) ms = 0
  const totalCs = Math.round(ms / 100) // dixièmes
  const ds = totalCs % 10
  const totalS = Math.floor(totalCs / 10)
  const s = totalS % 60
  const m = Math.floor(totalS / 60)
  if (m === 0) return `${s},${ds}s`
  return `${m}:${String(s).padStart(2, '0')},${ds}`
}

/**
 * Formate une séance d'athlétisme + ses %PR en markdown copiable pour LLM.
 * On reçoit déjà la liste enrichie (RunWithPR) pour éviter de recalculer ici.
 */
export function formatAthleticsSessionAsText(args: {
  date: string
  startedAt: string
  endedAt: string
  runsWithPR: RunWithPR[]
  profile?: ProfileHeader
}): string {
  const { date, startedAt, endedAt, runsWithPR, profile } = args
  const d = new Date(date + 'T00:00:00')
  const dateLong = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)

  const startTime = formatRunTime(startedAt)
  const endTime = formatRunTime(endedAt)
  const duration = formatSessionDuration(startedAt, endedAt)

  const distinctDistances = new Set(runsWithPR.map((r) => r.run.distance_m))
  const bestPct = runsWithPR.reduce<number | null>(
    (b, r) => (r.pctOfPR != null && (b == null || r.pctOfPR > b) ? r.pctOfPR : b),
    null,
  )
  const newPRs = runsWithPR.filter((r) => r.isNewPR).length

  const lines: string[] = []
  const profileLine = formatProfileLine(profile)
  if (profileLine) {
    lines.push(profileLine)
    lines.push('')
  }
  lines.push(`# Séance Athlétisme — ${dateLong}`)
  lines.push('')
  lines.push(`- Horaires : ${startTime} → ${endTime} (${duration})`)
  lines.push(
    `- Total : ${runsWithPR.length} chrono${runsWithPR.length > 1 ? 's' : ''} sur ${distinctDistances.size} distance${distinctDistances.size > 1 ? 's' : ''}`,
  )
  if (bestPct != null) {
    lines.push(`- Meilleur % PR de la séance : ${formatPct(bestPct)}`)
  }
  if (newPRs > 0) {
    lines.push(`- 🔥 ${newPRs} nouveau${newPRs > 1 ? 'x' : ''} record${newPRs > 1 ? 's' : ''} personnel${newPRs > 1 ? 's' : ''}`)
  }
  lines.push('')

  // Détail par chrono — chrono N : distance × temps · % PR (scaled note).
  runsWithPR.forEach((rwp, i) => {
    const { run, ref, pctOfPR, isNewPR } = rwp
    const time = new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(run.created_at))
    let pctStr = ''
    if (pctOfPR == null) {
      pctStr = ' · % PR : — (1ʳᵉ fois sur cette distance)'
    } else if (ref && ref.scaled) {
      pctStr = ` · % PR : ${formatPct(pctOfPR)} (extrapolé depuis le PR ${ref.sourceDistance}m, plus proche distance plus longue)`
    } else {
      pctStr = ` · % PR : ${formatPct(pctOfPR)}`
    }
    const prFlag = isNewPR ? ' 🔥 nouveau PR' : ''
    lines.push(
      `${i + 1}. ${run.distance_m}m — ${formatChronoMd(run.duration_ms)} · ${time}${pctStr}${prFlag}`,
    )
  })

  return lines.join('\n').trimEnd() + '\n'
}
