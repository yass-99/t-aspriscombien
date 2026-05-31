import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createSupabaseServer } from '../../lib/supabase-server'

type SerieRow = {
  poids: number
  reps: number
}
type ExoRow = {
  // nom + flags vivent désormais sur exercises (join via exercise_id).
  exercises: { nom: string; is_bodyweight: boolean | null; is_unilateral: boolean | null } | null
  series: SerieRow[] | null
  seances: { date: string; type: string } | null
}

export type ExoSuggestion = {
  nom: string
  count: number
  lastDate: string | null
  lastPoids: number | null
  lastReps: number | null
  topPoids: number | null
  // Flags du dernier usage — servent à pré-cocher PDC / unilatéral à la saisie.
  lastIsBodyweight: boolean
  lastIsUnilateral: boolean
  // Types de séance où cet exo a été pratiqué (push, pull, legs…).
  types: string[]
}

export async function GET() {
  const { userId, getToken } = await auth()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const token = await getToken()
  if (!token) return NextResponse.json({ error: 'Token Supabase indisponible' }, { status: 401 })

  const supabase = createSupabaseServer(token)
  const { data, error } = (await supabase
    .from('exos')
    .select('exercises(nom, is_bodyweight, is_unilateral), series(poids, reps), seances!inner(date, type)')
    .order('id', { ascending: false })
    .limit(2000)) as unknown as {
    data: ExoRow[] | null
    error: { message: string } | null
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggrégation par nom d'exo (case-insensitive sur le trim).
  const map = new Map<string, ExoSuggestion>()
  for (const row of data ?? []) {
    const nom = row.exercises?.nom
    if (!nom) continue
    const key = nom.trim()
    if (!key) continue
    const cur =
      map.get(key) ??
      ({
        nom: key,
        count: 0,
        lastDate: null,
        lastPoids: null,
        lastReps: null,
        topPoids: null,
        lastIsBodyweight: false,
        lastIsUnilateral: false,
        types: [],
      } as ExoSuggestion)
    cur.count += 1
    const seanceDate = row.seances?.date ?? null
    const seanceType = row.seances?.type ?? null
    if (seanceDate && (!cur.lastDate || seanceDate > cur.lastDate)) {
      cur.lastDate = seanceDate
      // Flags du dernier usage (séance la plus récente de cet exo).
      cur.lastIsBodyweight = !!row.exercises?.is_bodyweight
      cur.lastIsUnilateral = !!row.exercises?.is_unilateral
      // Récupérer la dernière charge non nulle pour cette séance
      const topOfSeance = (row.series ?? []).reduce<SerieRow | null>(
        (acc, s) => (!acc || (s.poids ?? 0) > (acc.poids ?? 0) ? s : acc),
        null,
      )
      if (topOfSeance) {
        cur.lastPoids = topOfSeance.poids
        cur.lastReps = topOfSeance.reps
      }
    }
    for (const s of row.series ?? []) {
      if (cur.topPoids == null || s.poids > cur.topPoids) cur.topPoids = s.poids
    }
    if (seanceType && !cur.types.includes(seanceType)) cur.types.push(seanceType)
    map.set(key, cur)
  }

  // Catalogue : exercices globaux + persos, même jamais pratiqués. On les ajoute
  // comme suggestions à count 0 (lastDate null) pour qu'ils soient trouvables à la
  // recherche par nom — sans écraser une entrée qui a déjà un historique.
  const { data: catalogue } = (await supabase
    .from('exercises')
    .select('nom, is_bodyweight, is_unilateral')
    .or(`is_global.eq.true,created_by.eq.${userId}`)) as unknown as {
    data: { nom: string; is_bodyweight: boolean | null; is_unilateral: boolean | null }[] | null
  }
  for (const ex of catalogue ?? []) {
    if (!ex.nom) continue
    const key = ex.nom.trim()
    if (!key || map.has(key)) continue
    map.set(key, {
      nom: key,
      count: 0,
      lastDate: null,
      lastPoids: null,
      lastReps: null,
      topPoids: null,
      lastIsBodyweight: !!ex.is_bodyweight,
      lastIsUnilateral: !!ex.is_unilateral,
      types: [],
    })
  }

  const exos = Array.from(map.values()).sort((a, b) => {
    // Récents d'abord, puis par fréquence.
    if (a.lastDate && b.lastDate && a.lastDate !== b.lastDate) {
      return a.lastDate < b.lastDate ? 1 : -1
    }
    if (a.lastDate && !b.lastDate) return -1
    if (!a.lastDate && b.lastDate) return 1
    return b.count - a.count
  })

  return NextResponse.json({ exos })
}
