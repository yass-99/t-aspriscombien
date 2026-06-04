import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServer } from '../../../lib/supabase-server'

export async function POST(req: NextRequest) {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Token indisponible' }, { status: 401 })

  let body: { endpoint?: string; p256dh?: string; auth?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }
  if (!body.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json({ error: 'Abonnement incomplet' }, { status: 400 })
  }

  const supabase = createSupabaseServer(token)
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, endpoint: body.endpoint, p256dh: body.p256dh, auth: body.auth },
      { onConflict: 'endpoint' },
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
