import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServer } from '../../../lib/supabase-server'
import { resolveExerciseId } from '../../../lib/exercises'

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
type PutBody = {
  date: string
  type: string
  restTargetSec: number
  exos: ExoIn[]
}

type SerieRow = {
  id: string
  poids: number
  reps: number
  rir: number
  degressive: boolean
  recup: number
}
type ExoRow = {
  id: string
  // nom + flags proviennent du join exercises (exercise_id).
  exercises: { nom: string; is_bodyweight: boolean | null; is_unilateral: boolean | null } | null
  series: SerieRow[] | null
}
type SeanceRow = {
  id: string
  type: string
  date: string
  exos: ExoRow[] | null
}

function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T00:00:00').getTime())
}

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Token Supabase indisponible' }, { status: 401 })

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

  const supabase = createSupabaseServer(token)
  const { data, error } = (await supabase
    .from('seances')
    .select('id, date, type, exos(id, exercises(nom, is_bodyweight, is_unilateral), series(id, poids, reps, rir, degressive, recup))')
    .eq('id', id)
    .single()) as unknown as { data: SeanceRow | null; error: { message: string } | null }

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Séance introuvable' }, { status: 404 })
  }

  // Infer restTargetSec from the most common recup value (or first one)
  let restTargetSec = 90
  for (const e of data.exos ?? []) {
    for (const sr of e.series ?? []) {
      if (sr.recup) {
        restTargetSec = sr.recup
        break
      }
    }
    if (restTargetSec !== 90) break
  }

  const seance = {
    id: data.id,
    date: data.date,
    type: data.type,
    restTargetSec,
    exos: (data.exos ?? []).map((e) => ({
      id: e.id,
      nom: e.exercises?.nom ?? '',
      isBodyweight: !!e.exercises?.is_bodyweight,
      isUnilateral: !!e.exercises?.is_unilateral,
      series: (e.series ?? []).map((s) => ({
        id: s.id,
        poids: s.poids,
        reps: s.reps,
        rir: s.rir,
        degressive: s.degressive,
      })),
    })),
  }

  return NextResponse.json({ seance })
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Token Supabase indisponible' }, { status: 401 })

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

  let body: PutBody
  try {
    body = (await req.json()) as PutBody
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  if (!body.date || !isValidISODate(body.date)) {
    return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
  }
  if (!body.type) {
    return NextResponse.json({ error: 'Type manquant' }, { status: 400 })
  }
  if (!body.exos || body.exos.length === 0) {
    return NextResponse.json({ error: 'Aucun exercice' }, { status: 400 })
  }

  const supabase = createSupabaseServer(token)

  // Update the seance row (date + type)
  const { error: upErr } = await supabase
    .from('seances')
    .update({ date: body.date, type: body.type })
    .eq('id', id)
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  // Remove all existing exos for this seance (cascade should drop series)
  const { error: delErr } = await supabase.from('exos').delete().eq('seance_id', id)
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  // Re-insert exos + series
  for (const exo of body.exos) {
    if (!exo.nom?.trim() || !exo.series || exo.series.length === 0) continue
    // nom + flags vivent sur exercises → on résout (ou crée) l'exercice d'abord.
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
      .insert({
        seance_id: id,
        exercise_id: exerciseId,
      })
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

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Token Supabase indisponible' }, { status: 401 })

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

  const supabase = createSupabaseServer(token)
  const { error } = await supabase.from('seances').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
