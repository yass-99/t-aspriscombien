import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServer } from '../../lib/supabase-server'
import { planDiff, type PlanEntry } from '../../seance/_lib/plan'
import { weekDatesFrom } from '../../seance/_lib/helpers'

const VALID = new Set(['push', 'pull', 'legs', 'full', 'upper', 'core', 'athletics'])
const ISO = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Token indisponible' }, { status: 401 })

  const weekStart = req.nextUrl.searchParams.get('weekStart')
  if (!weekStart || !ISO.test(weekStart)) {
    return NextResponse.json({ error: 'weekStart invalide' }, { status: 400 })
  }
  const dates = weekDatesFrom(weekStart)
  const supabase = createSupabaseServer(token)
  const { data, error } = await supabase
    .from('planned_sessions')
    .select('date, type')
    .gte('date', dates[0])
    .lte('date', dates[6])
    .order('date', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Token indisponible' }, { status: 401 })

  let body: { weekStart?: string; entries?: PlanEntry[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }
  const { weekStart, entries } = body
  if (!weekStart || !ISO.test(weekStart) || !Array.isArray(entries)) {
    return NextResponse.json({ error: 'Payload invalide' }, { status: 400 })
  }
  if (entries.some((e) => !VALID.has(e.type) || !ISO.test(e.date))) {
    return NextResponse.json({ error: 'Entrée invalide' }, { status: 400 })
  }

  const dates = weekDatesFrom(weekStart)
  const supabase = createSupabaseServer(token)

  const { data: existing, error: exErr } = await supabase
    .from('planned_sessions')
    .select('date, type')
    .gte('date', dates[0])
    .lte('date', dates[6])
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })

  const { upserts, deletes } = planDiff(dates, (existing ?? []) as PlanEntry[], entries)

  if (upserts.length) {
    const rows = upserts.map((u) => ({ user_id: userId, date: u.date, type: u.type }))
    const { error } = await supabase
      .from('planned_sessions')
      .upsert(rows, { onConflict: 'user_id,date' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (deletes.length) {
    const { error } = await supabase.from('planned_sessions').delete().in('date', deletes)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
