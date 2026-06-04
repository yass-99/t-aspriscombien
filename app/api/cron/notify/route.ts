import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createSupabaseAdmin } from '../../../lib/supabase-server'
import { selectNotifiable } from '../../../seance/_lib/plan'
import { isoDateInParis } from '../../../seance/_lib/helpers'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  // Auth cron : Vercel injecte `Authorization: Bearer ${CRON_SECRET}`.
  const authz = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authz !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Interdit' }, { status: 401 })
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )

  const supabase = createSupabaseAdmin()
  const today = isoDateInParis(new Date())

  const { data: plans, error: pErr } = await supabase
    .from('planned_sessions')
    .select('user_id, type')
    .eq('date', today)
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!plans || plans.length === 0) return NextResponse.json({ sent: 0 })

  const userIds = [...new Set(plans.map((p) => p.user_id))]
  const { data: subs, error: sErr } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

  const tasks = selectNotifiable(plans, subs ?? [])
  let sent = 0
  const dead: string[] = []
  for (const t of tasks) {
    try {
      await webpush.sendNotification(
        { endpoint: t.sub.endpoint, keys: t.sub.keys },
        JSON.stringify(t.payload),
      )
      sent++
    } catch (e: unknown) {
      const code = (e as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) dead.push(t.sub.endpoint)
    }
  }
  if (dead.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', dead)
  }
  return NextResponse.json({ sent, removed: dead.length })
}
