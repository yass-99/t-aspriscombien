import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServer } from '../../../lib/supabase-server'

type IncomingRun = { distance_m: number; duration_ms: number }
type PostBody = {
  runs?: IncomingRun[]
  // ISO YYYY-MM-DD (date LOCALE fournie par le client). Défaut : aujourd'hui serveur.
  date?: string
}

function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T00:00:00').getTime())
}

// Enregistre une séance d'athlétisme entière en un appel : crée la ligne
// athletics_sessions parente puis insère tous les chronos rattachés via session_id.
// Remplace l'ancienne boucle de N POST /api/runs (qui laissait session_id NULL et
// pouvait laisser des runs orphelins en cas d'échec en milieu de boucle).
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

  const runs = body.runs
  if (!Array.isArray(runs) || runs.length === 0) {
    return NextResponse.json({ error: 'Aucun chrono à enregistrer' }, { status: 400 })
  }
  if (runs.length > 200) {
    return NextResponse.json({ error: 'Trop de chronos pour une séance' }, { status: 400 })
  }
  for (const r of runs) {
    const distance = Number(r.distance_m)
    const duration = Number(r.duration_ms)
    if (!Number.isInteger(distance) || distance <= 0 || distance > 10000) {
      return NextResponse.json({ error: 'distance_m invalide' }, { status: 400 })
    }
    if (!Number.isInteger(duration) || duration <= 0 || duration > 24 * 3600 * 1000) {
      return NextResponse.json({ error: 'duration_ms invalide' }, { status: 400 })
    }
  }

  const date =
    body.date && isValidISODate(body.date) ? body.date : new Date().toISOString().slice(0, 10)

  const supabase = createSupabaseServer(token)

  // 1) Session parente. user_id et started_at sont posés par les défauts DB.
  const { data: session, error: sessionErr } = await supabase
    .from('athletics_sessions')
    .insert({ date })
    .select('id')
    .single()

  if (sessionErr || !session) {
    return NextResponse.json(
      { error: sessionErr?.message ?? 'Échec création session athlé' },
      { status: 500 },
    )
  }

  const sessionId = session.id as string

  // 2) Chronos rattachés. created_at décalé d'1 ms par index : un insert batch
  //    partagerait sinon le même now() et l'ordre d'affichage serait indéterminé.
  const base = Date.now()
  const rows = runs.map((r, i) => ({
    session_id: sessionId,
    date,
    distance_m: Number(r.distance_m),
    duration_ms: Number(r.duration_ms),
    created_at: new Date(base + i).toISOString(),
  }))

  const { data: created, error: runsErr } = await supabase
    .from('runs')
    .insert(rows)
    .select('id, created_at')

  if (runsErr || !created) {
    return NextResponse.json(
      { error: runsErr?.message ?? 'Échec enregistrement des chronos' },
      { status: 500 },
    )
  }

  const runIds = [...created]
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map((r) => r.id as string)

  return NextResponse.json({ sessionId, runIds })
}
