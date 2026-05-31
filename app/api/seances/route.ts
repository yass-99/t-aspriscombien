import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServer } from '../../lib/supabase-server'
import { resolveExerciseId } from '../../lib/exercises'

type SerieIn = {
  poids: number
  reps: number
  rir: number
  degressive: boolean
}
type ExoIn = {
  nom: string
  isBodyweight?: boolean
  isUnilateral?: boolean
  series: SerieIn[]
}
type PostBody = {
  date: string
  type: string
  restTargetSec: number
  exos: ExoIn[]
}

type SummaryRow = {
  id: string
  date: string
  type: string
  exos_count: number
  series_count: number
  volume: number
}

function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T00:00:00').getTime())
}

export async function GET() {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Token Supabase indisponible' }, { status: 401 })

  const supabase = createSupabaseServer(token)
  // Agrégation (count/sum) faite côté Postgres : on ne transporte plus toutes les
  // séries de chaque séance, seulement le résumé affiché dans l'historique.
  const { data, error } = (await supabase.rpc('seance_history_summary')) as unknown as {
    data: SummaryRow[] | null
    error: { message: string } | null
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const seances = (data ?? []).map((s) => ({
    id: s.id,
    date: s.date,
    type: s.type,
    exosCount: s.exos_count,
    seriesCount: s.series_count,
    volume: s.volume,
  }))

  return NextResponse.json({ seances })
}

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Token Supabase indisponible' }, { status: 401 })

  let body: PostBody
  try {
    body = (await req.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  if (!body.date || !isValidISODate(body.date)) {
    return NextResponse.json({ error: 'Date invalide (YYYY-MM-DD attendu)' }, { status: 400 })
  }
  if (!body.type) {
    return NextResponse.json({ error: 'Type manquant' }, { status: 400 })
  }
  if (!body.exos || body.exos.length === 0) {
    return NextResponse.json({ error: 'Aucun exercice' }, { status: 400 })
  }

  const supabase = createSupabaseServer(token)

  const { data: seance, error: sErr } = await supabase
    .from('seances')
    .insert({ date: body.date, type: body.type })
    .select('id')
    .single()
  if (sErr || !seance) {
    return NextResponse.json({ error: sErr?.message ?? 'Échec création séance' }, { status: 500 })
  }
  const seanceId = seance.id as string

  for (const exo of body.exos) {
    if (!exo.nom?.trim() || !exo.series || exo.series.length === 0) continue
    // nom + flags vivent sur exercises → résolution (ou création) avant insert exos.
    const exerciseId = await resolveExerciseId(
      supabase,
      userId,
      exo.nom,
      !!exo.isBodyweight,
      !!exo.isUnilateral,
    )
    if (exerciseId == null) {
      return NextResponse.json({ error: 'Échec résolution exercice' }, { status: 500 })
    }
    const { data: exoRow, error: eErr } = await supabase
      .from('exos')
      .insert({ seance_id: seanceId, exercise_id: exerciseId })
      .select('id')
      .single()
    if (eErr || !exoRow) {
      return NextResponse.json({ error: eErr?.message ?? 'Échec création exo' }, { status: 500 })
    }
    const rows = exo.series.map((s) => ({
      exo_id: exoRow.id,
      reps: s.reps,
      poids: s.poids,
      recup: body.restTargetSec,
      rir: s.rir,
      degressive: s.degressive,
    }))
    const { error: srErr } = await supabase.from('series').insert(rows)
    if (srErr) {
      return NextResponse.json({ error: srErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, seanceId })
}
