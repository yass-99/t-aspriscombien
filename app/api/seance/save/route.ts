import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServer } from '../../../lib/supabase-server'
import { resolveExerciseId } from '../../../lib/exercises'
import type { SessionState } from '../../../seance/_lib/types'

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth()
  if (!userId) {
    console.error('[SEANCE_SAVE_AUTH] Aucun userId Clerk dans la requête')
    return NextResponse.json(
      { error: 'Non authentifié', code: 'SEANCE_SAVE_AUTH' },
      { status: 401 },
    )
  }

  const token = await getToken()
  if (!token) {
    console.error('[SEANCE_SAVE_TOKEN] Clerk getToken() a retourné null pour userId', userId)
    return NextResponse.json(
      {
        error: 'Token Supabase indisponible (Clerk getToken null)',
        code: 'SEANCE_SAVE_TOKEN',
      },
      { status: 401 },
    )
  }

  let body: { sessionState?: SessionState }
  try {
    body = await req.json()
  } catch (e) {
    console.error('[SEANCE_SAVE_BODY] JSON invalide', e)
    return NextResponse.json(
      { error: 'Body JSON invalide', code: 'SEANCE_SAVE_BODY' },
      { status: 400 },
    )
  }

  const sessionState = body.sessionState
  if (!sessionState) {
    return NextResponse.json(
      { error: 'sessionState manquant', code: 'SEANCE_SAVE_PAYLOAD' },
      { status: 400 },
    )
  }
  if (!sessionState.exos || sessionState.exos.length === 0) {
    return NextResponse.json(
      { error: 'Aucun exercice à sauvegarder', code: 'SEANCE_SAVE_EMPTY' },
      { status: 400 },
    )
  }

  const supabase = createSupabaseServer(token)
  const today = new Date().toISOString().slice(0, 10)

  const { data: seance, error: seanceErr } = await supabase
    .from('seances')
    .insert({
      date: today,
      type: sessionState.type,
    })
    .select('id')
    .single()

  if (seanceErr || !seance) {
    console.error(
      '[SEANCE_SAVE_INSERT_SEANCE] Échec insert seances',
      { userId, error: seanceErr },
    )
    return NextResponse.json(
      {
        error: seanceErr?.message ?? 'Échec création séance',
        code: 'SEANCE_SAVE_INSERT_SEANCE',
      },
      { status: 500 },
    )
  }

  const seanceId = seance.id as string

  // Supersets : les supersetId (tokens client) sont mappés vers des entiers stables
  // par séance (1, 2, …) pour la colonne exos.superset_group.
  const supersetGroups = new Map<string, number>()

  for (const exo of sessionState.exos) {
    if (!exo.series || exo.series.length === 0) continue

    let supersetGroup: number | null = null
    if (exo.supersetId) {
      if (!supersetGroups.has(exo.supersetId)) {
        supersetGroups.set(exo.supersetId, supersetGroups.size + 1)
      }
      supersetGroup = supersetGroups.get(exo.supersetId)!
    }

    // nom + flags vivent désormais sur exercises → résolution (ou création).
    const exerciseId = await resolveExerciseId(
      supabase,
      userId,
      exo.nom,
      !!exo.isBodyweight,
      !!exo.isUnilateral,
    )
    if (exerciseId == null) {
      console.error('[SEANCE_SAVE_RESOLVE_EXO] Échec résolution exercice', {
        userId,
        seanceId,
        exoNom: exo.nom,
      })
      return NextResponse.json(
        { error: 'Échec résolution exercice', code: 'SEANCE_SAVE_RESOLVE_EXO' },
        { status: 500 },
      )
    }

    const { data: exoRow, error: exoErr } = await supabase
      .from('exos')
      .insert({
        seance_id: seanceId,
        exercise_id: exerciseId,
        superset_group: supersetGroup,
      })
      .select('id')
      .single()

    if (exoErr || !exoRow) {
      console.error(
        '[SEANCE_SAVE_INSERT_EXO] Échec insert exos',
        { userId, seanceId, exoNom: exo.nom, error: exoErr },
      )
      return NextResponse.json(
        {
          error: exoErr?.message ?? 'Échec création exo',
          code: 'SEANCE_SAVE_INSERT_EXO',
        },
        { status: 500 },
      )
    }

    // Les séries non comptées (reps null) sont filtrées en amont (cf. SummaryScreen).
    const seriesRows = exo.series
      .filter((s) => s.reps != null)
      .map((s) => ({
        exo_id: exoRow.id,
        reps: s.reps,
        poids: s.poids,
        recup: sessionState.restTargetSec,
        rir: s.rir ?? 0,
        degressive: s.degressive,
        amplitude: s.amplitude ?? null,
      }))
    if (seriesRows.length === 0) continue

    const { error: seriesErr } = await supabase.from('series').insert(seriesRows)
    if (seriesErr) {
      console.error(
        '[SEANCE_SAVE_INSERT_SERIES] Échec insert series',
        { userId, seanceId, exoId: exoRow.id, error: seriesErr },
      )
      return NextResponse.json(
        {
          error: seriesErr.message ?? 'Échec création séries',
          code: 'SEANCE_SAVE_INSERT_SERIES',
        },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ ok: true, seanceId })
}
