import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServer } from '../../lib/supabase-server'

type BodyweightRow = {
  id: number
  date: string
  poids_kg: number
}

type PostBody = {
  poidsKg: number
  // ISO YYYY-MM-DD, défaut: aujourd'hui côté serveur.
  date?: string
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
  // Filtre explicite par user_id : on ne dépend pas uniquement de la RLS.
  const { data, error } = (await supabase
    .from('bodyweights')
    .select('id, date, poids_kg')
    .eq('user_id', userId)
    .order('date', { ascending: true })
    .limit(1000)) as unknown as {
    data: BodyweightRow[] | null
    error: { message: string } | null
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const bodyweights = rows.map((r) => ({ id: r.id, date: r.date, poidsKg: r.poids_kg }))
  const last = rows.length ? rows[rows.length - 1] : null

  return NextResponse.json({
    bodyweights,
    current: last ? last.poids_kg : null,
    lastDate: last ? last.date : null,
  })
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

  const poids = Number(body.poidsKg)
  if (!Number.isFinite(poids) || poids <= 0 || poids >= 500) {
    return NextResponse.json({ error: 'poids_kg invalide' }, { status: 400 })
  }
  const date =
    body.date && isValidISODate(body.date) ? body.date : new Date().toISOString().slice(0, 10)

  const supabase = createSupabaseServer(token)
  // user_id explicite : requis pour le onConflict composite (user_id, date).
  const { data, error } = (await supabase
    .from('bodyweights')
    .upsert(
      { user_id: userId, date, poids_kg: poids },
      { onConflict: 'user_id,date' },
    )
    .select('id, date, poids_kg')
    .single()) as unknown as { data: BodyweightRow | null; error: { message: string } | null }

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Échec enregistrement du poids' },
      { status: 500 },
    )
  }
  return NextResponse.json({
    bodyweight: { id: data.id, date: data.date, poidsKg: data.poids_kg },
  })
}
