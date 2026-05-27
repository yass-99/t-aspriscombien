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
// Sert à récupérer ses mappings musculaires pour distribuer le volume des runs.
const SPRINT_EXERCISE_NAME = 'Sprint courte distance'

// Conversion distance → "kg-équivalent" pour mixer runs et muscu dans la même
// échelle de heatmap. Calibrage : 100 m ≈ 800 (~ 1 grosse série de squat).
// À ajuster si le rendu visuel donne trop ou pas assez d'importance aux runs.
const RUN_VOLUME_PER_METER = 8

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

type RunRow = { date: string; distance_m: number; duration_seconds: number }
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
  // 3 queries en parallèle :
  //  - séances (avec joins exos/series/exercises/exercise_muscles/muscles)
  //  - runs sur la période
  //  - mappings musculaires de l'exercice global "Sprint courte distance"
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
    .select('date, distance_m, duration_seconds')
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

  const [seancesRes, runsRes, sprintRes] = (await Promise.all([
    seancesQuery,
    runsQuery,
    sprintQuery,
  ])) as unknown as [
    { data: SeanceRow[] | null; error: { message: string } | null },
    { data: RunRow[] | null; error: { message: string } | null },
    { data: SprintExerciseRow | null; error: { message: string } | null },
  ]

  if (seancesRes.error) {
    return NextResponse.json({ error: seancesRes.error.message }, { status: 500 })
  }
  // Erreurs sur runs/sprint : on log mais on continue (la heatmap reste partielle
  // plutôt que de planter complètement si runs n'est pas encore peuplée).
  const seances = seancesRes.data ?? []
  const runs = runsRes.error ? [] : (runsRes.data ?? [])
  const sprintMappings = sprintRes.error
    ? []
    : (sprintRes.data?.exercise_muscles ?? [])

  // Accumulateur par group_id : volume pondéré + nb séries + date la plus récente.
  const stats = new Map<
    number,
    { volume: number; series: number; lastDate: string | null }
  >()
  for (let gid = 1; gid <= 12; gid++) {
    stats.set(gid, { volume: 0, series: 0, lastDate: null })
  }

  for (const s of seances) {
    for (const e of s.exos ?? []) {
      if (!e.exercise_id || !e.exercises) continue
      const mappings = e.exercises.exercise_muscles ?? []
      if (mappings.length === 0) continue

      // Volume brut de cet exo sur cette séance.
      let exoVolume = 0
      const seriesCount = (e.series ?? []).length
      for (const sr of e.series ?? []) {
        exoVolume += (sr.poids ?? 0) * (sr.reps ?? 0)
      }
      if (exoVolume === 0 && seriesCount === 0) continue

      // Distribué sur chaque muscle touché, pondéré par le rôle.
      for (const em of mappings) {
        const gid = em.muscles?.group_id
        if (!gid) continue
        const w = ROLE_WEIGHT[em.role] ?? 0
        if (w === 0) continue
        const cur = stats.get(gid)!
        cur.volume += exoVolume * w
        cur.series += seriesCount
        if (cur.lastDate == null || s.date > cur.lastDate) {
          cur.lastDate = s.date
        }
      }
    }
  }

  // Distribution des runs sur les muscles via le mapping de "Sprint courte distance".
  // Chaque run compte comme 1 « série » et son volume = distance × RUN_VOLUME_PER_METER.
  if (sprintMappings.length > 0) {
    for (const r of runs) {
      if (!r.distance_m || r.distance_m <= 0) continue
      const runVolume = r.distance_m * RUN_VOLUME_PER_METER
      for (const em of sprintMappings) {
        const gid = em.muscles?.group_id
        if (!gid) continue
        const w = ROLE_WEIGHT[em.role] ?? 0
        if (w === 0) continue
        const cur = stats.get(gid)!
        cur.volume += runVolume * w
        cur.series += 1
        if (cur.lastDate == null || r.date > cur.lastDate) {
          cur.lastDate = r.date
        }
      }
    }
  }

  // Conversion en tableau + normalisation.
  const groups = Array.from(stats.entries()).map(([gid, x]) => {
    let daysSince: number | null = null
    if (x.lastDate) {
      const dt = new Date(x.lastDate + 'T00:00:00')
      daysSince = Math.max(0, Math.floor((now.getTime() - dt.getTime()) / 86400000))
    }
    return {
      groupId: gid,
      groupKey: GROUP_KEY[gid],
      label: GROUP_LABEL[gid],
      volume: Math.round(x.volume),
      series: x.series,
      lastSessionDaysAgo: daysSince,
    }
  })

  const maxVolume = groups.reduce((m, g) => (g.volume > m ? g.volume : m), 0)

  return NextResponse.json({
    period,
    maxVolume,
    groups,
  })
}
