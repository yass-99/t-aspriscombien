import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServer } from '../../../lib/supabase-server'

type PutBody = {
  duration_ms?: number
  distance_m?: number
  date?: string
}

function isValidISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + 'T00:00:00').getTime())
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Token Supabase indisponible' }, { status: 401 })

  const supabase = createSupabaseServer(token)
  const { error } = await supabase.from('runs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Token Supabase indisponible' }, { status: 401 })

  let body: PutBody
  try {
    body = (await req.json()) as PutBody
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
  }

  // Colonne DB = `duration_seconds` (mais stocke des ms — sémantique gérée côté front).
  const patch: Record<string, number | string> = {}
  if (body.duration_ms !== undefined) {
    const d = Number(body.duration_ms)
    if (!Number.isInteger(d) || d <= 0 || d > 24 * 3600 * 1000) {
      return NextResponse.json({ error: 'duration_ms invalide' }, { status: 400 })
    }
    patch.duration_seconds = d
  }
  if (body.distance_m !== undefined) {
    const dist = Number(body.distance_m)
    if (!Number.isInteger(dist) || dist <= 0 || dist > 10000) {
      return NextResponse.json({ error: 'distance_m invalide' }, { status: 400 })
    }
    patch.distance_m = dist
  }
  if (body.date !== undefined) {
    if (!isValidISODate(body.date)) {
      return NextResponse.json({ error: 'date invalide' }, { status: 400 })
    }
    patch.date = body.date
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })
  }

  const supabase = createSupabaseServer(token)
  const { data, error } = (await supabase
    .from('runs')
    .update(patch)
    .eq('id', id)
    .select('id, date, distance_m, duration_seconds, created_at')
    .single()) as unknown as {
    data: {
      id: string
      date: string
      distance_m: number
      duration_seconds: number
      created_at: string
    } | null
    error: { message: string } | null
  }

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Échec mise à jour' }, { status: 500 })
  }
  return NextResponse.json({
    run: {
      id: data.id,
      date: data.date,
      distance_m: data.distance_m,
      duration_ms: data.duration_seconds,
      created_at: data.created_at,
    },
  })
}
