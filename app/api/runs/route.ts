import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServer } from '../../lib/supabase-server'

// La colonne DB s'appelle `duration_seconds` (int) mais stocke en réalité des ms.
// On expose `duration_ms` côté front pour garder une sémantique correcte.
type RunRowDB = {
  id: string
  date: string
  distance_m: number
  duration_seconds: number
  created_at: string
}

type RunOut = {
  id: string
  date: string
  distance_m: number
  duration_ms: number
  created_at: string
}

function toOut(r: RunRowDB): RunOut {
  return {
    id: r.id,
    date: r.date,
    distance_m: r.distance_m,
    duration_ms: r.duration_seconds,
    created_at: r.created_at,
  }
}

type PostBody = {
  distance_m: number
  duration_ms: number
  // ISO YYYY-MM-DD, défaut: aujourd'hui côté serveur.
  date?: string
}

function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T00:00:00').getTime())
}

export async function GET(req: NextRequest) {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Token Supabase indisponible' }, { status: 401 })

  const distanceParam = req.nextUrl.searchParams.get('distance_m')
  const distance = distanceParam ? parseInt(distanceParam, 10) : null

  const supabase = createSupabaseServer(token)
  let query = supabase
    .from('runs')
    .select('id, date, distance_m, duration_seconds, created_at')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)

  if (distance && !Number.isNaN(distance)) {
    query = query.eq('distance_m', distance)
  }

  const { data, error } = (await query) as unknown as {
    data: RunRowDB[] | null
    error: { message: string } | null
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ runs: (data ?? []).map(toOut) })
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

  const distance = Number(body.distance_m)
  const duration = Number(body.duration_ms)
  if (!Number.isInteger(distance) || distance <= 0 || distance > 10000) {
    return NextResponse.json({ error: 'distance_m invalide' }, { status: 400 })
  }
  if (!Number.isInteger(duration) || duration <= 0 || duration > 24 * 3600 * 1000) {
    return NextResponse.json({ error: 'duration_ms invalide' }, { status: 400 })
  }

  const date =
    body.date && isValidISODate(body.date) ? body.date : new Date().toISOString().slice(0, 10)

  const supabase = createSupabaseServer(token)
  const { data, error } = (await supabase
    .from('runs')
    .insert({ distance_m: distance, duration_seconds: duration, date })
    .select('id, date, distance_m, duration_seconds, created_at')
    .single()) as unknown as {
    data: RunRowDB | null
    error: { message: string } | null
  }

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Échec création du chrono' },
      { status: 500 },
    )
  }
  return NextResponse.json({ run: toOut(data) })
}
