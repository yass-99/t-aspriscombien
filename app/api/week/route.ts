import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServer } from '../../lib/supabase-server'

// Détail complet d'une semaine d'entraînement (lundi → dimanche) en une seule
// requête — sert de source au « bilan de la semaine » exporté pour un LLM.
// Voir formatWeekAsText() dans _lib/helpers.ts pour le rendu markdown.

type SerieRow = {
  poids: number
  reps: number
  rir: number
  degressive: boolean
  recup: number
  amplitude: '90' | 'partielle' | null
}
type ExoRow = {
  id: string
  exercises: { nom: string; is_bodyweight: boolean | null; is_unilateral: boolean | null } | null
  superset_group: number | null
  series: SerieRow[] | null
}
type SeanceRow = {
  id: string
  type: string
  date: string
  exos: ExoRow[] | null
}
type RunRow = {
  id: string
  date: string
  distance_m: number
  duration_ms: number
  created_at: string
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay() || 7
  x.setDate(x.getDate() - day + 1)
  return x
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Token Supabase indisponible' }, { status: 401 })

  // Décalage de semaines : 0 = semaine courante, 1 = semaine précédente, etc.
  const offsetRaw = parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10)
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0

  const now = new Date()
  const weekStart = startOfWeekMonday(now)
  if (offset > 0) weekStart.setDate(weekStart.getDate() - offset * 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const startStr = isoDate(weekStart)
  const endStr = isoDate(weekEnd)

  const supabase = createSupabaseServer(token)

  const { data: seancesData, error: sErr } = (await supabase
    .from('seances')
    .select(
      'id, date, type, exos(id, superset_group, exercises(nom, is_bodyweight, is_unilateral), series(id, poids, reps, rir, degressive, recup, amplitude))',
    )
    .gte('date', startStr)
    .lte('date', endStr)
    .order('date', { ascending: true })
    .order('id', { ascending: true, foreignTable: 'exos' })) as unknown as {
    data: SeanceRow[] | null
    error: { message: string } | null
  }
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

  const { data: runsData, error: rErr } = (await supabase
    .from('runs')
    .select('id, date, distance_m, duration_ms, created_at')
    .gte('date', startStr)
    .lte('date', endStr)
    .order('created_at', { ascending: true })) as unknown as {
    data: RunRow[] | null
    error: { message: string } | null
  }
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })

  const seances = (seancesData ?? []).map((s) => {
    // restTargetSec inféré depuis le 1er recup non nul des séries.
    let restTargetSec = 90
    for (const e of s.exos ?? []) {
      const found = (e.series ?? []).find((sr) => sr.recup)
      if (found) {
        restTargetSec = found.recup
        break
      }
    }
    return {
      id: s.id,
      date: s.date,
      type: s.type,
      restTargetSec,
      exos: (s.exos ?? []).map((e) => ({
        nom: e.exercises?.nom ?? '',
        isBodyweight: !!e.exercises?.is_bodyweight,
        isUnilateral: !!e.exercises?.is_unilateral,
        supersetId: e.superset_group != null ? `g${e.superset_group}` : null,
        series: (e.series ?? []).map((sr) => ({
          poids: sr.poids,
          reps: sr.reps,
          rir: sr.rir,
          degressive: sr.degressive,
          amplitude: sr.amplitude ?? null,
        })),
      })),
    }
  })

  return NextResponse.json({
    weekStart: startStr,
    weekEnd: endStr,
    seances,
    runs: runsData ?? [],
  })
}
