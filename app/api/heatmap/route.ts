import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServer } from '../../lib/supabase-server'

type Period = '7d' | '30d' | '90d' | 'all'
const VALID_PERIODS: Period[] = ['7d', '30d', '90d', 'all']
const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

// Pondération du volume selon le rôle du muscle dans l'exercice.
// Primary = effort direct, secondary = sollicitation accessoire.
const ROLE_WEIGHT: Record<string, number> = {
  primary: 1.0,
  secondary: 0.5,
}

// Nom de l'exercice global "course/sprint" dans la table exercises.
// Sert à récupérer les muscles sollicités par la course pour alimenter le bloc
// `running` du groupe (sans jamais convertir la distance en kg-équivalent).
const SPRINT_EXERCISE_NAME = 'Sprint courte distance'

// Mapping group_id → clé stable côté frontend.
// Aligné sur l'ordre du seed : voir rapport §3.2 (table muscle_groups).
const GROUP_KEY: Record<number, MuscleGroupKey> = {
  1: 'chest',
  2: 'shoulders',
  3: 'back',
  4: 'biceps',
  5: 'forearms',
  6: 'triceps',
  7: 'quads',
  8: 'glutes',
  9: 'hamstrings',
  10: 'calves',
  11: 'traps',
  12: 'core',
}

const GROUP_LABEL: Record<number, string> = {
  1: 'Pectoraux',
  2: 'Épaules',
  3: 'Dos',
  4: 'Biceps',
  5: 'Avant-bras',
  6: 'Triceps',
  7: 'Quadriceps',
  8: 'Fessiers',
  9: 'Ischio-jambiers',
  10: 'Mollets',
  11: 'Trapèzes',
  12: 'Core',
}

export type MuscleGroupKey =
  | 'chest'
  | 'shoulders'
  | 'back'
  | 'biceps'
  | 'forearms'
  | 'triceps'
  | 'quads'
  | 'glutes'
  | 'hamstrings'
  | 'calves'
  | 'traps'
  | 'core'

type MuscleRow = { group_id: number }
type ExerciseMuscleRow = { role: string; muscles: MuscleRow | null }
type ExerciseRow = { exercise_muscles: ExerciseMuscleRow[] | null }
type SerieRow = { poids: number; reps: number }
type ExoRow = {
  exercise_id: number | null
  series: SerieRow[] | null
  exercises: ExerciseRow | null
}
type SeanceRow = { date: string; exos: ExoRow[] | null }

type RunRow = { date: string; distance_m: number; duration_ms: number }
type AllRunRow = { distance_m: number; duration_ms: number }
type SprintExerciseRow = { exercise_muscles: ExerciseMuscleRow[] | null }

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET(req: Request) {
  const { userId, getToken } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const token = await getToken()
  if (!token) {
    return NextResponse.json({ error: 'Token Supabase indisponible' }, { status: 401 })
  }

  const url = new URL(req.url)
  const rawPeriod = url.searchParams.get('period') ?? '7d'
  const period: Period = (VALID_PERIODS as string[]).includes(rawPeriod)
    ? (rawPeriod as Period)
    : '7d'

  const supabase = createSupabaseServer(token)

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  let periodStart: Date | null = null
  if (period !== 'all') {
    const days = PERIOD_DAYS[period]
    periodStart = new Date(now)
    periodStart.setDate(periodStart.getDate() - days + 1)
  }

  // RLS filtre déjà par utilisateur via le JWT Clerk → pas besoin de WHERE user_id ici.
  // 4 queries en parallèle :
  //  - séances de la période (avec joins exos/series/exercises/exercise_muscles/muscles)
  //  - runs de la période
  //  - mappings musculaires de l'exercice global "Sprint courte distance"
  //  - tous les runs (pour calculer les PR absolus par distance, indépendants de la période)
  let seancesQuery = supabase
    .from('seances')
    .select(
      'date, exos(exercise_id, series(poids, reps), exercises(exercise_muscles(role, muscles(group_id))))',
    )
    .order('date', { ascending: false })
  if (periodStart) {
    seancesQuery = seancesQuery.gte('date', isoDate(periodStart))
  }

  let runsQuery = supabase
    .from('runs')
    .select('date, distance_m, duration_ms')
    .order('date', { ascending: false })
  if (periodStart) {
    runsQuery = runsQuery.gte('date', isoDate(periodStart))
  }

  const sprintQuery = supabase
    .from('exercises')
    .select('exercise_muscles(role, muscles(group_id))')
    .eq('nom', SPRINT_EXERCISE_NAME)
    .eq('is_global', true)
    .maybeSingle()

  // PRs absolus : pas de filtre période, on veut le meilleur temps de tous les temps.
  const allRunsQuery = supabase.from('runs').select('distance_m, duration_ms')

  const [seancesRes, runsRes, sprintRes, allRunsRes] = (await Promise.all([
    seancesQuery,
    runsQuery,
    sprintQuery,
    allRunsQuery,
  ])) as unknown as [
    { data: SeanceRow[] | null; error: { message: string } | null },
    { data: RunRow[] | null; error: { message: string } | null },
    { data: SprintExerciseRow | null; error: { message: string } | null },
    { data: AllRunRow[] | null; error: { message: string } | null },
  ]

  if (seancesRes.error) {
    return NextResponse.json({ error: seancesRes.error.message }, { status: 500 })
  }
  // Erreurs sur runs/sprint/allRuns : on log mais on continue (la heatmap reste partielle
  // plutôt que de planter complètement si runs n'est pas encore peuplée).
  const seances = seancesRes.data ?? []
  const runs = runsRes.error ? [] : (runsRes.data ?? [])
  const sprintMappings = sprintRes.error
    ? []
    : (sprintRes.data?.exercise_muscles ?? [])
  const allRuns = allRunsRes.error ? [] : (allRunsRes.data ?? [])

  // PR par distance : meilleure vitesse (m/s) absolue connue pour chaque distance jamais courue.
  // Permet ensuite de calculer le %PR de chaque run de la période.
  const prSpeedByDistance = new Map<number, number>()
  for (const r of allRuns) {
    if (!r.distance_m || !r.duration_ms || r.duration_ms <= 0) continue
    const speed = r.distance_m / (r.duration_ms / 1000)
    const cur = prSpeedByDistance.get(r.distance_m)
    if (cur == null || speed > cur) prSpeedByDistance.set(r.distance_m, speed)
  }

  // Accumulateur par group_id : un bloc weighted (muscu) et un bloc running (course),
  // jamais additionnés. La couche UI choisit lequel afficher selon le mode.
  type Bucket = {
    weighted: {
      volume: number
      series: number
      lastDate: string | null
    }
    running: {
      distance: number
      duration: number
      runs: number
      // Pour calculer avgPrPct (moyenne pondérée par distance) en fin de boucle.
      prWeightedSum: number
      prWeightSum: number
      bestRun: { distance_m: number; duration_ms: number; prPct: number } | null
      lastDate: string | null
    }
  }
  const stats = new Map<number, Bucket>()
  for (let gid = 1; gid <= 12; gid++) {
    stats.set(gid, {
      weighted: { volume: 0, series: 0, lastDate: null },
      running: {
        distance: 0,
        duration: 0,
        runs: 0,
        prWeightedSum: 0,
        prWeightSum: 0,
        bestRun: null,
        lastDate: null,
      },
    })
  }

  // ─── Muscu : tonnage brut × rôle, par muscle ───────────────────────
  for (const s of seances) {
    for (const e of s.exos ?? []) {
      if (!e.exercise_id || !e.exercises) continue
      const mappings = e.exercises.exercise_muscles ?? []
      if (mappings.length === 0) continue

      let exoVolume = 0
      const seriesCount = (e.series ?? []).length
      for (const sr of e.series ?? []) {
        exoVolume += (sr.poids ?? 0) * (sr.reps ?? 0)
      }
      if (exoVolume === 0 && seriesCount === 0) continue

      for (const em of mappings) {
        const gid = em.muscles?.group_id
        if (!gid) continue
        const w = ROLE_WEIGHT[em.role] ?? 0
        if (w === 0) continue
        const cur = stats.get(gid)!
        cur.weighted.volume += exoVolume * w
        cur.weighted.series += seriesCount
        if (cur.weighted.lastDate == null || s.date > cur.weighted.lastDate) {
          cur.weighted.lastDate = s.date
        }
      }
    }
  }

  // ─── Course : distance + temps + intensité %PR, par muscle ─────────
  // Les runs sont distribués sur les muscles via le mapping de l'exercice global
  // "Sprint courte distance" (quads / glutes / hamstrings principalement).
  // Aucune conversion distance → kg : on garde la sémantique cardio intacte.
  //
  // Important : on déduplique les group_id avant la boucle. Un même muscle peut
  // apparaître plusieurs fois dans exercise_muscles (rôle primary + secondary,
  // gauche + droit, etc.). Sans dédoublonnage, chaque mètre couru serait compté
  // N fois par muscle au lieu d'une seule fois. La pondération par rôle n'a pas
  // de sens pour la distance : tous les mètres courus sollicitent chaque muscle
  // concerné à 100% de la distance parcourue.
  const sprintGroupIds = new Set<number>()
  for (const em of sprintMappings) {
    const gid = em.muscles?.group_id
    if (!gid) continue
    if ((ROLE_WEIGHT[em.role] ?? 0) <= 0) continue
    sprintGroupIds.add(gid)
  }

  if (sprintGroupIds.size > 0) {
    for (const r of runs) {
      if (!r.distance_m || r.distance_m <= 0) continue
      if (!r.duration_ms || r.duration_ms <= 0) continue
      const runSpeed = r.distance_m / (r.duration_ms / 1000)
      const prSpeed = prSpeedByDistance.get(r.distance_m) ?? runSpeed
      const prPct = prSpeed > 0 ? runSpeed / prSpeed : 0

      for (const gid of sprintGroupIds) {
        const cur = stats.get(gid)!.running
        cur.distance += r.distance_m
        cur.duration += r.duration_ms
        cur.runs += 1
        cur.prWeightedSum += r.distance_m * prPct
        cur.prWeightSum += r.distance_m
        if (!cur.bestRun || prPct > cur.bestRun.prPct) {
          cur.bestRun = {
            distance_m: r.distance_m,
            duration_ms: r.duration_ms,
            prPct,
          }
        }
        if (cur.lastDate == null || r.date > cur.lastDate) {
          cur.lastDate = r.date
        }
      }
    }
  }

  // ─── Sérialisation + normalisation ─────────────────────────────────
  const groups = Array.from(stats.entries()).map(([gid, x]) => {
    const weightedDays = daysSince(x.weighted.lastDate, now)
    const runningDays = daysSince(x.running.lastDate, now)
    const avgPrPct = x.running.prWeightSum > 0
      ? x.running.prWeightedSum / x.running.prWeightSum
      : null
    return {
      groupId: gid,
      groupKey: GROUP_KEY[gid],
      label: GROUP_LABEL[gid],
      weighted: {
        volume: Math.round(x.weighted.volume),
        series: x.weighted.series,
        lastSessionDaysAgo: weightedDays,
      },
      running: {
        distance: Math.round(x.running.distance),
        duration: x.running.duration,
        runs: x.running.runs,
        avgPrPct,
        bestRun: x.running.bestRun,
        lastSessionDaysAgo: runningDays,
      },
    }
  })

  const maxWeightedVolume = groups.reduce(
    (m, g) => (g.weighted.volume > m ? g.weighted.volume : m),
    0,
  )
  const maxRunningDistance = groups.reduce(
    (m, g) => (g.running.distance > m ? g.running.distance : m),
    0,
  )

  return NextResponse.json({
    period,
    maxWeightedVolume,
    maxRunningDistance,
    groups,
  })
}

function daysSince(date: string | null, now: Date): number | null {
  if (!date) return null
  const dt = new Date(date + 'T00:00:00')
  return Math.max(0, Math.floor((now.getTime() - dt.getTime()) / 86400000))
}
