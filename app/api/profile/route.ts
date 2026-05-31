import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServer } from '../../lib/supabase-server'

type ProfileRow = {
  sexe: string | null
  taille_cm: number | null
  birth_date: string | null
}

type PutBody = {
  sexe?: 'H' | 'F' | 'A' | null
  tailleCm?: number | null
  birthDate?: string | null
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
  // Filtre explicite par user_id : on ne dépend pas uniquement de la RLS. Si
  // plusieurs profils étaient visibles (RLS permissive / dev), `.maybeSingle()`
  // renverrait une erreur — ici on cible une seule ligne, la bonne.
  const { data, error } = (await supabase
    .from('profiles')
    .select('sexe, taille_cm, birth_date')
    .eq('user_id', userId)
    .maybeSingle()) as unknown as { data: ProfileRow | null; error: { message: string } | null }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    profile: data
      ? { sexe: data.sexe, tailleCm: data.taille_cm, birthDate: data.birth_date }
      : null,
  })
}

export async function PUT(req: NextRequest) {
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

  if (body.sexe != null && !['H', 'F', 'A'].includes(body.sexe)) {
    return NextResponse.json({ error: 'sexe invalide' }, { status: 400 })
  }
  let taille: number | null = null
  if (body.tailleCm != null) {
    taille = Math.round(Number(body.tailleCm))
    if (!Number.isInteger(taille) || taille < 80 || taille > 260) {
      return NextResponse.json({ error: 'taille_cm invalide' }, { status: 400 })
    }
  }
  if (body.birthDate != null && !isValidISODate(body.birthDate)) {
    return NextResponse.json({ error: 'birth_date invalide' }, { status: 400 })
  }

  const supabase = createSupabaseServer(token)
  // user_id passé explicitement : requis pour le onConflict de l'upsert.
  const { data, error } = (await supabase
    .from('profiles')
    .upsert(
      {
        user_id: userId,
        sexe: body.sexe ?? null,
        taille_cm: taille,
        birth_date: body.birthDate ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('sexe, taille_cm, birth_date')
    .single()) as unknown as { data: ProfileRow | null; error: { message: string } | null }

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Échec mise à jour profil' }, { status: 500 })
  }

  return NextResponse.json({
    profile: { sexe: data.sexe, tailleCm: data.taille_cm, birthDate: data.birth_date },
  })
}
