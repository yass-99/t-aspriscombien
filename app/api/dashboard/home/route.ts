import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServer } from '../../../lib/supabase-server'

// Route légère pour l'accueil (IdleScreen). Celui-ci ne consomme que `week`
// (volume/seances/series/daily) et `lastSeance` — inutile de calculer tout le
// payload StatsScreen (hero/distribution/topExos/blindSpots/recentPrs/sparkline
// 12 sem + requêtes all-time). On se limite donc à : la semaine courante + la
// dernière séance. Cf /api/dashboard pour le payload complet de StatsScreen.

type SerieRow = { poids: number; reps: number }
type WeekExoRow = { series: SerieRow[] | null }
type WeekSeanceRow = { id: string; date: string; exos: WeekExoRow[] | null }

type LastExoRow = { exercises: { nom: string } | null; series: SerieRow[] | null }
type LastSeanceRow = { id: string; type: string; date: string; exos: LastExoRow[] | null }

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay() || 7
  x.setDate(x.getDate() - day + 1)
  return x
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Token Supabase indisponible' }, { status: 401 })

  const supabase = createSupabaseServer(token)

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const thisWeekStart = startOfWeekMonday(now)

  // 1) Séances de la semaine courante (séries minimales pour le volume).
  const { data: weekData, error: wErr } = (await supabase
    .from('seances')
    .select('id, date, exos(series(poids, reps))')
    .gte('date', isoDate(thisWeekStart))
    .order('date', { ascending: false })) as unknown as {
    data: WeekSeanceRow[] | null
    error: { message: string } | null
  }
  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 })

  // 2) Dernière séance (la plus récente, même hors semaine courante).
  const { data: lastData, error: lErr } = (await supabase
    .from('seances')
    .select('id, type, date, exos(exercises(nom), series(poids, reps))')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()) as unknown as {
    data: LastSeanceRow | null
    error: { message: string } | null
  }
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })

  // ----- WEEK -----
  let weekVolume = 0
  let weekSeries = 0
  const weekDaily = new Array(7).fill(0) as number[]
  for (const s of weekData ?? []) {
    const seanceDate = new Date(s.date + 'T00:00:00')
    const dayIdx = Math.min(
      6,
      Math.max(0, Math.floor((seanceDate.getTime() - thisWeekStart.getTime()) / 86400000)),
    )
    for (const e of s.exos ?? []) {
      for (const sr of e.series ?? []) {
        weekSeries++
        weekVolume += sr.poids * sr.reps
        weekDaily[dayIdx] += sr.poids * sr.reps
      }
    }
  }

  // ----- LAST SEANCE -----
  let lastSeance: {
    id: string
    type: string
    date: string
    exos: { nom: string; topSet: { poids: number; reps: number } | null }[]
    seriesCount: number
  } | null = null
  if (lastData) {
    const exos = (lastData.exos ?? []).map((e) => {
      const top = (e.series ?? []).reduce<SerieRow | null>(
        (acc, s) => (acc === null || s.poids > acc.poids ? s : acc),
        null,
      )
      return {
        nom: e.exercises?.nom ?? '',
        topSet: top ? { poids: top.poids, reps: top.reps } : null,
      }
    })
    const seriesCount = (lastData.exos ?? []).reduce((n, e) => n + (e.series?.length ?? 0), 0)
    lastSeance = { id: lastData.id, type: lastData.type, date: lastData.date, exos, seriesCount }
  }

  return NextResponse.json({
    week: {
      volume: weekVolume,
      seances: (weekData ?? []).length,
      series: weekSeries,
      daily: weekDaily,
    },
    lastSeance,
  })
}
