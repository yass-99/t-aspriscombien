import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServer } from '../../lib/supabase-server'

type SerieRow = {
  id: string
  poids: number
  reps: number
  rir: number
  degressive: boolean
}
type ExoRow = {
  id: string
  // nom provient du join exercises (exercise_id).
  exercises: { nom: string } | null
  series: SerieRow[] | null
}
type SeanceRow = {
  id: string
  type: string
  date: string
  exos: ExoRow[] | null
}

type Period = '7d' | '30d' | '90d'
const VALID_PERIODS: Period[] = ['7d', '30d', '90d']
const PERIOD_DAYS: Record<Period, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}
const TYPE_LABEL: Record<string, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Jambes',
  full: 'Full body',
  upper: 'Upper',
  core: 'Abdos',
}
const TYPE_ORDER = ['push', 'pull', 'legs', 'full', 'upper', 'core']

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

function sumSeanceVolume(s: SeanceRow): number {
  let v = 0
  for (const e of s.exos ?? []) {
    for (const sr of e.series ?? []) v += sr.poids * sr.reps
  }
  return v
}

export async function GET(req: Request) {
  const { userId, getToken } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const token = await getToken()
  if (!token) {
    return NextResponse.json({ error: 'Token Supabase indisponible' }, { status: 401 })
  }

  const url = new URL(req.url)
  const rawPeriod = url.searchParams.get('period') ?? '7d'
  const period: Period = (VALID_PERIODS as string[]).includes(rawPeriod) ? (rawPeriod as Period) : '7d'

  const supabase = createSupabaseServer(token)

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const thisWeekStart = startOfWeekMonday(now)

  const days = PERIOD_DAYS[period]
  const periodStart = new Date(now)
  periodStart.setDate(periodStart.getDate() - days + 1)
  const prevPeriodStart = new Date(periodStart)
  prevPeriodStart.setDate(prevPeriodStart.getDate() - days)
  const prevPeriodEnd = new Date(periodStart)
  prevPeriodEnd.setDate(prevPeriodEnd.getDate() - 1)

  // 12-week window for sparkline + legacy fourWeeks
  const twelveWeeksMonday = new Date(thisWeekStart)
  twelveWeeksMonday.setDate(twelveWeeksMonday.getDate() - 11 * 7)

  // Nested fetch window = the widest of (period+previous), 12 weeks
  const fetchStart = prevPeriodStart < twelveWeeksMonday ? prevPeriodStart : twelveWeeksMonday

  let nestedQuery = supabase
    .from('seances')
    .select('id, type, date, exos(id, exercises(nom), series(id, poids, reps, rir, degressive))')
    .order('date', { ascending: false })
    // Borne le pire cas (period=all) : sans limite la requête nested rapatrie tout
    // l'historique avec ses séries. 500 = même cap que /api/seances et la requête PR.
    // Une fenêtre bornée (12 sem max) reste très en deçà de 500 séances.
    .limit(500)
  if (fetchStart) {
    nestedQuery = nestedQuery.gte('date', isoDate(fetchStart))
  }

  const { data: seances, error: sErr } = (await nestedQuery) as unknown as {
    data: SeanceRow[] | null
    error: { message: string } | null
  }
  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 })
  }
  const list = seances ?? []

  // Light query for blindSpots (all-time, just type+date)
  const { data: allLight } = (await supabase
    .from('seances')
    .select('type, date')
    .order('date', { ascending: false })) as unknown as {
    data: { type: string; date: string }[] | null
  }
  const lastDateByType = new Map<string, string>()
  for (const s of allLight ?? []) {
    if (!lastDateByType.has(s.type)) lastDateByType.set(s.type, s.date)
  }

  // PRs all-time with date (join exos → seances)
  type PRRow = {
    poids: number
    reps: number
    exos: { exercises: { nom: string } | null; seances: { date: string } | null } | null
  }
  const { data: prRows } = (await supabase
    .from('series')
    .select('poids, reps, exos!inner(exercises!inner(nom), seances!inner(date))')
    .order('poids', { ascending: false })
    .limit(500)) as unknown as { data: PRRow[] | null }

  const inRange = (d: string, start: Date | null, end: Date | null) => {
    const dt = new Date(d + 'T00:00:00')
    if (start && dt < start) return false
    if (end && dt > end) return false
    return true
  }

  const periodList = list.filter((s) => inRange(s.date, periodStart, now))
  const prevList = list.filter((s) => inRange(s.date, prevPeriodStart, prevPeriodEnd))

  // ----- HERO (period) -----
  let pVolume = 0
  let pPoidsSum = 0
  let pPoidsCount = 0
  let pSeries = 0
  for (const s of periodList) {
    for (const e of s.exos ?? []) {
      for (const sr of e.series ?? []) {
        pSeries++
        pVolume += sr.poids * sr.reps
        pPoidsSum += sr.poids
        pPoidsCount++
      }
    }
  }
  let prevVolume = 0
  for (const s of prevList) prevVolume += sumSeanceVolume(s)

  // 12-week sparkline (oldest → newest)
  const sparkline12w: number[] = []
  for (let i = 0; i < 12; i++) {
    const wkStart = new Date(twelveWeeksMonday)
    wkStart.setDate(wkStart.getDate() + i * 7)
    const wkEnd = new Date(wkStart)
    wkEnd.setDate(wkEnd.getDate() + 6)
    let v = 0
    for (const s of list) {
      const dt = new Date(s.date + 'T00:00:00')
      if (dt >= wkStart && dt <= wkEnd) v += sumSeanceVolume(s)
    }
    sparkline12w.push(v)
  }

  // ----- DISTRIBUTION (period) -----
  const distMap = new Map<string, { seances: number; volume: number }>()
  for (const s of periodList) {
    const cur = distMap.get(s.type) ?? { seances: 0, volume: 0 }
    cur.seances++
    cur.volume += sumSeanceVolume(s)
    distMap.set(s.type, cur)
  }
  const distTotalVolume = Array.from(distMap.values()).reduce((a, b) => a + b.volume, 0) || 1
  const distribution = TYPE_ORDER.filter((t) => distMap.has(t))
    .map((t) => {
      const x = distMap.get(t)!
      return {
        type: t,
        label: TYPE_LABEL[t] ?? t,
        seances: x.seances,
        volume: x.volume,
        percent: Math.round((x.volume / distTotalVolume) * 100),
      }
    })
    .sort((a, b) => b.volume - a.volume)

  // ----- TOP EXOS (period) -----
  const exoVol = new Map<string, number>()
  for (const s of periodList) {
    for (const e of s.exos ?? []) {
      const nom = e.exercises?.nom
      if (!nom) continue
      let v = 0
      for (const sr of e.series ?? []) v += sr.poids * sr.reps
      exoVol.set(nom, (exoVol.get(nom) ?? 0) + v)
    }
  }
  const exoVolPrev = new Map<string, number>()
  for (const s of prevList) {
    for (const e of s.exos ?? []) {
      const nom = e.exercises?.nom
      if (!nom) continue
      let v = 0
      for (const sr of e.series ?? []) v += sr.poids * sr.reps
      exoVolPrev.set(nom, (exoVolPrev.get(nom) ?? 0) + v)
    }
  }

  // Sparkline buckets per top exo over the period (8 buckets)
  const BUCKETS = 8
  const bucketStart = new Date(periodStart)
  const bucketSizeMs = (now.getTime() + 86400000 - bucketStart.getTime()) / BUCKETS
  const bucketIndex = (d: string) => {
    const t = new Date(d + 'T00:00:00').getTime()
    return Math.max(0, Math.min(BUCKETS - 1, Math.floor((t - bucketStart.getTime()) / bucketSizeMs)))
  }
  const exoSparks = new Map<string, number[]>()
  const periodSource = periodList
  for (const s of periodSource) {
    const bi = bucketIndex(s.date)
    for (const e of s.exos ?? []) {
      const nom = e.exercises?.nom
      if (!nom) continue
      let v = 0
      for (const sr of e.series ?? []) v += sr.poids * sr.reps
      if (v === 0) continue
      const arr = exoSparks.get(nom) ?? new Array(BUCKETS).fill(0)
      arr[bi] += v
      exoSparks.set(nom, arr)
    }
  }

  const topExos = Array.from(exoVol.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nom, volume]) => {
      const volumePrev = exoVolPrev.get(nom) ?? 0
      let trendPct: number | null = null
      if (volumePrev > 0) {
        trendPct = Math.round(((volume - volumePrev) / volumePrev) * 100)
      }
      return {
        nom,
        volume,
        volumePrev,
        trendPct,
        sparkline: exoSparks.get(nom) ?? new Array(BUCKETS).fill(0),
      }
    })

  // ----- BLIND SPOTS -----
  const blindSpots = TYPE_ORDER.map((t) => {
    const lastDate = lastDateByType.get(t)
    let daysSince: number | null = null
    if (lastDate) {
      const dt = new Date(lastDate + 'T00:00:00')
      daysSince = Math.max(0, Math.floor((now.getTime() - dt.getTime()) / 86400000))
    }
    return {
      type: t,
      label: TYPE_LABEL[t] ?? t,
      daysSince,
    }
  })

  // ----- RECENT PRS (with date) -----
  const prByExo = new Map<string, { poids: number; reps: number; date: string }>()
  for (const r of prRows ?? []) {
    const nom = r.exos?.exercises?.nom
    const dt = r.exos?.seances?.date
    if (!nom || !dt) continue
    const cur = prByExo.get(nom)
    if (!cur || cur.poids < r.poids) {
      prByExo.set(nom, { poids: r.poids, reps: r.reps, date: dt })
    }
  }
  const recentPrs = Array.from(prByExo.entries())
    .sort((a, b) => (a[1].date < b[1].date ? 1 : -1))
    .slice(0, 5)
    .map(([nom, x]) => ({ nom, poids: x.poids, reps: x.reps, date: x.date }))

  // ===========================================================
  // LEGACY FIELDS (IdleScreen compatibility) — computed on list
  // ===========================================================

  const weeklyVolumes = new Map<string, number>()
  let totalSeanceCount = 0
  let totalSeriesCount = 0
  let totalVolume = 0
  let totalPoidsSum = 0
  let totalPoidsCount = 0
  for (const s of list) {
    totalSeanceCount++
    const seanceDate = new Date(s.date + 'T00:00:00')
    const weekKey = isoDate(startOfWeekMonday(seanceDate))
    let weekVol = 0
    for (const e of s.exos ?? []) {
      for (const sr of e.series ?? []) {
        totalSeriesCount++
        weekVol += sr.poids * sr.reps
        totalPoidsSum += sr.poids
        totalPoidsCount++
      }
    }
    weeklyVolumes.set(weekKey, (weeklyVolumes.get(weekKey) ?? 0) + weekVol)
    totalVolume += weekVol
  }

  const legacyChart: Array<{ label: string; volume: number; current: boolean }> = []
  for (let i = 3; i >= 0; i--) {
    const wk = new Date(thisWeekStart)
    wk.setDate(wk.getDate() - i * 7)
    const key = isoDate(wk)
    legacyChart.push({
      label: i === 0 ? 'Cette sem.' : `S-${i}`,
      volume: weeklyVolumes.get(key) ?? 0,
      current: i === 0,
    })
  }

  const thisWeekVolume = weeklyVolumes.get(isoDate(thisWeekStart)) ?? 0
  const prevWeekStart = new Date(thisWeekStart)
  prevWeekStart.setDate(prevWeekStart.getDate() - 7)
  const prevWeekVolume = weeklyVolumes.get(isoDate(prevWeekStart)) ?? 0

  let weekSeances = 0
  let weekSeries = 0
  // Volume par jour de la semaine courante (Lun→Dim) → courbe « rythme » sur l'accueil.
  const weekDaily = new Array(7).fill(0) as number[]
  for (const s of list) {
    const seanceDate = new Date(s.date + 'T00:00:00')
    if (seanceDate >= thisWeekStart) {
      weekSeances++
      const dayIdx = Math.min(
        6,
        Math.max(0, Math.floor((seanceDate.getTime() - thisWeekStart.getTime()) / 86400000)),
      )
      weekDaily[dayIdx] += sumSeanceVolume(s)
      for (const e of s.exos ?? []) {
        weekSeries += e.series?.length ?? 0
      }
    }
  }

  const lastSeance = list[0]
  let lastSeanceData: {
    id: string
    type: string
    date: string
    exos: { nom: string; topSet: { poids: number; reps: number } | null }[]
    seriesCount: number
  } | null = null
  if (lastSeance) {
    const exoSummaries = (lastSeance.exos ?? []).map((e) => {
      const top = (e.series ?? []).reduce<SerieRow | null>(
        (acc, s) => (acc === null || s.poids > acc.poids ? s : acc),
        null,
      )
      return {
        nom: e.exercises?.nom ?? '',
        topSet: top ? { poids: top.poids, reps: top.reps } : null,
      }
    })
    const seriesCount = (lastSeance.exos ?? []).reduce(
      (n, e) => n + (e.series?.length ?? 0),
      0,
    )
    lastSeanceData = {
      id: lastSeance.id,
      type: lastSeance.type,
      date: lastSeance.date,
      exos: exoSummaries,
      seriesCount,
    }
  }

  const legacyPrs = Array.from(prByExo.entries())
    .sort((a, b) => b[1].poids - a[1].poids)
    .slice(0, 4)
    .map(([nom, x]) => ({ nom, poids: x.poids, reps: x.reps }))

  return NextResponse.json({
    // Legacy (IdleScreen)
    week: {
      volume: thisWeekVolume,
      volumePrev: prevWeekVolume,
      seances: weekSeances,
      series: weekSeries,
      daily: weekDaily,
    },
    lastSeance: lastSeanceData,
    fourWeeks: {
      volumeTotal: totalVolume,
      seances: totalSeanceCount,
      series: totalSeriesCount,
      avgLoad: totalPoidsCount > 0 ? Math.round(totalPoidsSum / totalPoidsCount) : 0,
      chart: legacyChart,
    },
    prs: legacyPrs,

    // New (StatsScreen)
    period,
    hero: {
      volume: pVolume,
      volumePrev: prevVolume,
      seances: periodList.length,
      series: pSeries,
      avgLoad: pPoidsCount > 0 ? Math.round(pPoidsSum / pPoidsCount) : 0,
      sparkline12w,
    },
    distribution,
    topExos,
    blindSpots,
    recentPrs,
  })
}
