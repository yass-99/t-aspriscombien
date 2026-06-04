import type { Run, SessionState } from './types'
import type { DashboardData, Period } from './useDashboard'
import { WORKOUT_TYPES } from './constants'
import { formatChrono, groupRunsIntoSessions } from './runs'

export function formatMMSS(s: number): string {
  const sign = s < 0 ? '-' : ''
  const a = Math.abs(s)
  const m = Math.floor(a / 60)
  const r = a % 60
  return `${sign}${m}:${String(r).padStart(2, '0')}`
}

export function greetingFor(): 'matin' | 'après-midi' | 'soir' {
  const h = new Date().getHours()
  if (h < 11) return 'matin'
  if (h < 17) return 'après-midi'
  return 'soir'
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

export function daysAgo(isoDateStr: string): string {
  const d = new Date(isoDateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff <= 0) return "aujourd'hui"
  if (diff === 1) return 'hier'
  if (diff < 7) return `il y a ${diff} jours`
  const weeks = Math.floor(diff / 7)
  if (weeks === 1) return 'il y a 1 sem.'
  return `il y a ${weeks} sem.`
}

export function formatSeanceDate(isoDateStr: string): string {
  const d = new Date(isoDateStr + 'T00:00:00')
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(d)
    .replace('.', '')
}

export function percentChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr > 0 ? null : 0
  return Math.round(((curr - prev) / prev) * 100)
}

function fmtPoids(n: number): string {
  const fixed = Number.isInteger(n) ? String(n) : n.toFixed(1)
  return fixed.replace('.', ',')
}

// Libellé de charge unifié pour l'affichage et l'export.
// PDC + lest>0 → "PDC +10 kg" ; PDC sans lest → "PDC" ; sinon → "80 kg".
export function fmtChargeLabel(poids: number, isBodyweight?: boolean): string {
  if (isBodyweight) {
    return poids > 0 ? `PDC +${fmtPoids(poids)} kg` : 'PDC'
  }
  return `${fmtPoids(poids)} kg`
}

// Libellé d'amplitude pour l'affichage et l'export. null/undefined = complète
// → renvoie null (rien à afficher, on garde le texte coach épuré).
export function amplitudeLabel(a?: string | null): string | null {
  if (a === '90') return '90°'
  if (a === 'partielle') return 'partielle'
  return null
}

// En-tête de profil injecté en tête de l'export texte (contexte pour le LLM).
export type ProfileHeader = {
  sexe?: 'H' | 'F' | 'A' | null
  ageAnnees?: number | null
  tailleCm?: number | null
  poidsKg?: number | null
}

export function formatProfileLine(p?: ProfileHeader): string | null {
  if (!p) return null
  const parts: string[] = []
  if (p.sexe) parts.push(p.sexe === 'H' ? 'Homme' : p.sexe === 'F' ? 'Femme' : 'Autre')
  if (p.ageAnnees != null) parts.push(`${p.ageAnnees} ans`)
  if (p.tailleCm != null) parts.push(`${p.tailleCm} cm`)
  if (p.poidsKg != null) parts.push(`${fmtPoids(p.poidsKg)} kg`)
  return parts.length ? `Profil : ${parts.join(', ')}` : null
}

type ExoSerieLike = {
  poids: number
  reps: number | null
  rir: number | null
  degressive: boolean
  amplitude?: string | null
}
type ExoLike = {
  nom: string
  isBodyweight?: boolean
  isUnilateral?: boolean
  supersetId?: string | null
  series: ExoSerieLike[]
}
type SeanceLike = {
  date: string
  type: string
  restTargetSec: number
  exos: ExoLike[]
}

// Regroupe les exos consécutifs partageant un même supersetId (non nul) ; les exos
// solo restent dans un groupe d'un seul élément. Sert au rendu « Superset » de
// l'export LLM (l'ordre du tableau encode déjà l'ordre du superset).
function groupSupersets<T extends { supersetId?: string | null }>(exos: T[]): T[][] {
  const groups: T[][] = []
  for (const exo of exos) {
    const last = groups[groups.length - 1]
    if (exo.supersetId && last && last[0].supersetId === exo.supersetId) {
      last.push(exo)
    } else {
      groups.push([exo])
    }
  }
  return groups
}

// Ligne markdown d'une série, avec amplitude (si non complète) puis flag dégressive.
function formatSerieLine(i: number, s: ExoSerieLike, isBodyweight?: boolean): string {
  const amp = amplitudeLabel(s.amplitude)
  const ampStr = amp ? ` · ${amp}` : ''
  const flag = s.degressive ? ' (dégressive)' : ''
  const reps = s.reps == null ? 'JSP' : s.reps
  const rir = s.rir == null ? 'JSP' : s.rir
  return `${i + 1}. ${fmtChargeLabel(s.poids, isBodyweight)} × ${reps} reps · RIR ${rir}${ampStr}${flag}`
}

export function formatSeanceAsText(seance: SeanceLike, profile?: ProfileHeader): string {
  const type = WORKOUT_TYPES.find((t) => t.id === seance.type)
  const typeLabel = type?.label ?? seance.type ?? 'Séance'

  const d = new Date(seance.date + 'T00:00:00')
  const dateLong = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)

  const exos = seance.exos.filter((e) => e.series.length > 0)
  const totalSeries = exos.reduce((a, e) => a + e.series.length, 0)
  const totalVolume = exos.reduce(
    (a, e) => a + e.series.reduce((b, s) => (s.reps == null ? b : b + s.poids * s.reps), 0),
    0,
  )

  const lines: string[] = []
  const profileLine = formatProfileLine(profile)
  if (profileLine) {
    lines.push(profileLine)
    lines.push('')
  }
  lines.push(`# Séance ${typeLabel} — ${dateLong}`)
  lines.push('')
  lines.push(`- Repos cible entre séries : ${formatMMSS(seance.restTargetSec)} (${seance.restTargetSec}s)`)
  lines.push(
    `- Total : ${exos.length} exercice${exos.length > 1 ? 's' : ''} · ${totalSeries} série${totalSeries > 1 ? 's' : ''} · ${totalVolume.toLocaleString('fr-FR')} kg`,
  )
  lines.push('')

  for (const group of groupSupersets(exos)) {
    const isSuperset = group.length > 1
    if (isSuperset) {
      lines.push(`## Superset — ${group.map((e) => e.nom).join(' + ')} (alterné)`)
    }
    for (const exo of group) {
      lines.push(
        isSuperset
          ? `**${exo.nom}${exo.isUnilateral ? ' (unilatéral)' : ''}**`
          : `## ${exo.nom}${exo.isUnilateral ? ' (unilatéral)' : ''}`,
      )
      exo.series.forEach((s, i) => lines.push(formatSerieLine(i, s, exo.isBodyweight)))
      lines.push('')
    }
  }

  return lines.join('\n').trimEnd() + '\n'
}

// ═══════════════════════════════════════════════════════════════════════════
// BILAN DE LA SEMAINE — prompt coach + markdown agrégé, prêt à coller dans un LLM.
// C'est l'artefact central de l'app (cf. but : produire le contexte parfait).
// ═══════════════════════════════════════════════════════════════════════════

// Prompt fixe placé en tête : il dit au LLM quoi faire du bloc qui suit.
export const WEEK_COACH_PROMPT = `Tu es un coach de musculation et d'athlétisme.

Analyse ma semaine d'entraînement ci-dessous.
Objectifs de ta réponse :
- Résumer la semaine (points forts / points faibles).
- Commenter la répartition du volume (par groupes musculaires et sprint).
- Me dire si la progression semble logique ou si je stagne sur certains exos.
- Me proposer 2–3 ajustements concrets pour la semaine suivante
  (volume, RIR, choix d'exercices, ordre des séances).

Semaine d'entraînement :`

// Une séance muscu telle que renvoyée par /api/week (réutilise ExoLike).
type WeekSeance = {
  id: string
  date: string
  type: string
  restTargetSec: number
  exos: ExoLike[]
}

export type WeekData = {
  weekStart: string
  weekEnd: string
  seances: WeekSeance[]
  runs: Run[]
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// « 24 au 30 mai 2026 » / « 28 avril au 4 mai 2026 » / années croisées.
function formatWeekRange(startISO: string, endISO: string): string {
  const s = new Date(startISO + 'T00:00:00')
  const e = new Date(endISO + 'T00:00:00')
  const day = (d: Date) => d.getDate()
  const month = (d: Date) =>
    new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(d)
  const year = (d: Date) => d.getFullYear()

  if (year(s) !== year(e)) {
    return `${day(s)} ${month(s)} ${year(s)} au ${day(e)} ${month(e)} ${year(e)}`
  }
  if (s.getMonth() !== e.getMonth()) {
    return `${day(s)} ${month(s)} au ${day(e)} ${month(e)} ${year(e)}`
  }
  return `${day(s)} au ${day(e)} ${month(e)} ${year(e)}`
}

function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return capitalize(
    new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
      .format(d)
      .replace('.', ''),
  )
}

function seanceVolume(s: WeekSeance): number {
  return s.exos.reduce(
    (a, e) => a + e.series.reduce((b, sr) => (sr.reps == null ? b : b + sr.poids * sr.reps), 0),
    0,
  )
}

function seanceSeriesCount(s: WeekSeance): number {
  return s.exos.reduce((a, e) => a + e.series.filter((sr) => sr.reps != null).length, 0)
}

type TopSet = { poids: number; reps: number; isBodyweight: boolean }

// Meilleure série (top set = charge max) de chaque exercice sur une liste de
// séances. Sert de référence « semaine dernière » dans le bilan.
function topSetByExo(seances: WeekSeance[]): Map<string, TopSet> {
  const map = new Map<string, TopSet>()
  for (const s of seances) {
    for (const exo of s.exos) {
      const counted = exo.series.filter((sr) => sr.reps != null)
      if (counted.length === 0) continue
      let top = counted[0]
      for (const sr of counted) {
        if (sr.poids > top.poids || (sr.poids === top.poids && (sr.reps ?? 0) > (top.reps ?? 0))) {
          top = sr
        }
      }
      const key = exo.nom.trim().toLowerCase()
      const cand: TopSet = { poids: top.poids, reps: top.reps ?? 0, isBodyweight: !!exo.isBodyweight }
      const existing = map.get(key)
      if (!existing || cand.poids > existing.poids) map.set(key, cand)
    }
  }
  return map
}

// Indique si la semaine contient au moins une donnée exploitable.
export function weekHasContent(week: WeekData | null): boolean {
  if (!week) return false
  const hasSeance = week.seances.some((s) => s.exos.some((e) => e.series.length > 0))
  return hasSeance || week.runs.length > 0
}

export function formatWeekAsText(
  week: WeekData,
  profile?: ProfileHeader,
  prevWeek?: WeekData | null,
): string {
  const muscuSeances = week.seances.filter((s) => s.exos.some((e) => e.series.length > 0))
  const athleSessions = groupRunsIntoSessions(week.runs)
  const totalSeances = muscuSeances.length + athleSessions.length

  const volumeTotal = muscuSeances.reduce((a, s) => a + seanceVolume(s), 0)
  const seriesTotal = muscuSeances.reduce((a, s) => a + seanceSeriesCount(s), 0)

  // Semaine précédente : volume (pour la variation) + meilleure série par exo
  // (pour la référence de progression dans le détail).
  const prevMuscu = prevWeek
    ? prevWeek.seances.filter((s) => s.exos.some((e) => e.series.length > 0))
    : []
  const prevVolume = prevMuscu.reduce((a, s) => a + seanceVolume(s), 0)
  const prevTopByExo = topSetByExo(prevMuscu)

  // Répartition muscu par type de séance.
  const byType = new Map<string, { seances: number; series: number; volume: number }>()
  for (const s of muscuSeances) {
    const cur = byType.get(s.type) ?? { seances: 0, series: 0, volume: 0 }
    cur.seances++
    cur.series += seanceSeriesCount(s)
    cur.volume += seanceVolume(s)
    byType.set(s.type, cur)
  }

  // Distances d'athlé : nb de chronos + meilleur temps par distance.
  const byDist = new Map<number, { count: number; best: number }>()
  for (const r of week.runs) {
    const cur = byDist.get(r.distance_m)
    if (!cur) byDist.set(r.distance_m, { count: 1, best: r.duration_ms })
    else {
      cur.count++
      if (r.duration_ms < cur.best) cur.best = r.duration_ms
    }
  }
  const distEntries = Array.from(byDist.entries()).sort((a, b) => a[0] - b[0])

  const lines: string[] = []
  lines.push(`# Semaine du ${formatWeekRange(week.weekStart, week.weekEnd)}`)
  lines.push('')

  // Contexte = profil DB uniquement (pas de champ subjectif).
  const profileLine = formatProfileLine(profile)
  if (profileLine) {
    lines.push('## Contexte')
    lines.push(`- ${profileLine.replace(/^Profil : /, '')}`)
    lines.push('')
  }

  // ── Synthèse chiffrée ─────────────────────────────────────────
  lines.push('## Synthèse chiffrée')
  lines.push(`- Nombre de séances : ${totalSeances}`)
  if (muscuSeances.length > 0) {
    lines.push(`  - ${muscuSeances.length} séance${muscuSeances.length > 1 ? 's' : ''} muscu`)
  }
  if (athleSessions.length > 0) {
    lines.push(`  - ${athleSessions.length} séance${athleSessions.length > 1 ? 's' : ''} athlétisme`)
  }
  if (muscuSeances.length > 0) {
    lines.push(`- Volume total muscu : ${volumeTotal.toLocaleString('fr-FR')} kg`)
    if (prevVolume > 0) {
      const pct = Math.round(((volumeTotal - prevVolume) / prevVolume) * 100)
      lines.push(
        `  - Variation vs semaine précédente : ${pct >= 0 ? '+' : ''}${pct} % (${prevVolume.toLocaleString('fr-FR')} kg → ${volumeTotal.toLocaleString('fr-FR')} kg)`,
      )
    }
    lines.push(`- Séries totales (muscu) : ${seriesTotal}`)
    lines.push('- Répartition par type de séance :')
    const ordered = Array.from(byType.entries()).sort((a, b) => b[1].volume - a[1].volume)
    for (const [type, x] of ordered) {
      const label = WORKOUT_TYPES.find((t) => t.id === type)?.label ?? type
      lines.push(
        `  - ${label} : ${x.seances} séance${x.seances > 1 ? 's' : ''} · ${x.series} séries · ${x.volume.toLocaleString('fr-FR')} kg`,
      )
    }
  }
  if (week.runs.length > 0) {
    lines.push('- Athlétisme :')
    for (const [dist, x] of distEntries) {
      lines.push(
        `  - ${dist} m : ${x.count} chrono${x.count > 1 ? 's' : ''} · meilleur ${formatChrono(x.best)}`,
      )
    }
  }
  lines.push('')

  // ── Séances détaillées ────────────────────────────────────────
  lines.push('## Séances détaillées')
  lines.push('')

  // Ordre chronologique mélangeant muscu (par date) et athlé (par startedAt).
  type Block = { date: string; ts: number; render: () => string[] }
  const blocks: Block[] = []

  for (const s of muscuSeances) {
    blocks.push({
      date: s.date,
      ts: new Date(s.date + 'T00:00:00').getTime(),
      render: () => {
        const typeLabel = WORKOUT_TYPES.find((t) => t.id === s.type)?.label ?? s.type
        const out: string[] = []
        out.push(`### ${shortDate(s.date)} — Séance ${typeLabel}`)
        out.push(
          `- Repos cible ${formatMMSS(s.restTargetSec)} · ${s.exos.length} exo${s.exos.length > 1 ? 's' : ''} · ${seanceSeriesCount(s)} séries · ${seanceVolume(s).toLocaleString('fr-FR')} kg`,
        )
        out.push('')
        for (const group of groupSupersets(s.exos)) {
          // Membres du groupe ayant au moins une série comptée (reps != null).
          const counted = group.filter((e) => e.series.some((sr) => sr.reps != null))
          if (counted.length > 1) {
            out.push(`_Superset — ${counted.map((e) => e.nom).join(' + ')} (alterné)_`)
          }
          for (const exo of group) {
            const series = exo.series.filter((sr) => sr.reps != null)
            if (series.length === 0) continue
            out.push(`**${exo.nom}${exo.isUnilateral ? ' (unilatéral)' : ''}**`)
            series.forEach((sr, i) => out.push(formatSerieLine(i, sr, exo.isBodyweight)))
            // Référence de progression : meilleure série de cet exo la semaine d'avant.
            const ref = prevTopByExo.get(exo.nom.trim().toLowerCase())
            if (ref) {
              out.push(`   ↳ réf. sem. dernière : ${fmtChargeLabel(ref.poids, ref.isBodyweight)} × ${ref.reps}`)
            }
            out.push('')
          }
        }
        return out
      },
    })
  }

  for (const sess of athleSessions) {
    blocks.push({
      date: sess.date,
      ts: new Date(sess.startedAt).getTime(),
      render: () => {
        const out: string[] = []
        out.push(`### ${shortDate(sess.date)} — Séance athlétisme`)
        const dmap = new Map<number, number[]>()
        for (const r of sess.runs) {
          const arr = dmap.get(r.distance_m) ?? []
          arr.push(r.duration_ms)
          dmap.set(r.distance_m, arr)
        }
        out.push(
          `- ${sess.runs.length} chrono${sess.runs.length > 1 ? 's' : ''} sur ${dmap.size} distance${dmap.size > 1 ? 's' : ''}`,
        )
        out.push('')
        for (const [dist, times] of Array.from(dmap.entries()).sort((a, b) => a[0] - b[0])) {
          out.push(`- ${dist} m : ${times.map((t) => formatChrono(t)).join(' ; ')}`)
        }
        out.push('')
        return out
      },
    })
  }

  blocks.sort((a, b) => a.ts - b.ts)
  for (const b of blocks) lines.push(...b.render())

  return lines.join('\n').trimEnd() + '\n'
}

// Texte complet à copier : prompt coach + bloc semaine.
export function formatWeekForLLM(
  week: WeekData,
  profile?: ProfileHeader,
  prevWeek?: WeekData | null,
): string {
  return `${WEEK_COACH_PROMPT}\n\n${formatWeekAsText(week, profile, prevWeek)}`
}

// ─────────────────────────────────────────────────────────────────────────
// BILAN PAR PÉRIODE (7/30/90j) — résumé agrégé pour LLM, construit à
// partir des données déjà chargées par l'écran Stats (DashboardData + runs).
// Contrairement au bilan hebdo, on ne détaille pas chaque série : on synthétise
// (volume, répartition, top exos, records, athlé) — adapté aux longues fenêtres.
// ─────────────────────────────────────────────────────────────────────────

const PERIOD_LABEL_LONG: Record<Period, string> = {
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
  '90d': '90 derniers jours',
}

// Durée de la période, pour libeller la comparaison « vs N j précédents »
// (fenêtre glissante de même longueur juste avant la période affichée).
const PERIOD_DAYS_LABEL: Record<Period, string> = {
  '7d': '7 j',
  '30d': '30 j',
  '90d': '90 j',
}

export const PERIOD_COACH_PROMPT = `Tu es un coach de musculation et d'athlétisme.

Analyse mon bilan d'entraînement ci-dessous (synthèse agrégée sur la période indiquée).
Objectifs de ta réponse :
- Résumer la période (points forts / points faibles).
- Commenter la répartition du volume (groupes musculaires et sprint).
- Me dire si la progression semble logique ou si je stagne sur certains exos.
- Me proposer 2–3 ajustements concrets pour la suite
  (volume, RIR, choix d'exercices, équilibre muscu/athlé).

Bilan d'entraînement :`

// Y a-t-il de quoi exporter pour cette période ?
export function periodHasContent(data: DashboardData | null, runs: Run[]): boolean {
  if (!data) return false
  return data.hero.seances > 0 || runs.length > 0
}

export function formatPeriodForLLM(
  data: DashboardData,
  runs: Run[],
  profile: ProfileHeader | undefined,
  period: Period,
): string {
  const hero = data.hero
  const athleSessions = groupRunsIntoSessions(runs)

  const lines: string[] = []
  lines.push(`# Bilan — ${PERIOD_LABEL_LONG[period]}`)
  lines.push('')

  const profileLine = formatProfileLine(profile)
  if (profileLine) {
    lines.push('## Contexte')
    lines.push(`- ${profileLine.replace(/^Profil : /, '')}`)
    lines.push('')
  }

  // ── Synthèse chiffrée ──────────────────────────────────────────
  lines.push('## Synthèse chiffrée')
  const totalSeances = hero.seances + athleSessions.length
  lines.push(`- Nombre de séances : ${totalSeances}`)
  if (hero.seances > 0) lines.push(`  - ${hero.seances} séance${hero.seances > 1 ? 's' : ''} muscu`)
  if (athleSessions.length > 0) {
    lines.push(
      `  - ${athleSessions.length} séance${athleSessions.length > 1 ? 's' : ''} athlétisme (${runs.length} chrono${runs.length > 1 ? 's' : ''})`,
    )
  }
  if (hero.seances > 0) {
    lines.push(`- Volume total muscu : ${hero.volume.toLocaleString('fr-FR')} kg`)
    if (hero.volumePrev != null && hero.volumePrev > 0) {
      const pct = Math.round(((hero.volume - hero.volumePrev) / hero.volumePrev) * 100)
      lines.push(`  - Variation vs période précédente : ${pct >= 0 ? '+' : ''}${pct} %`)
    }
    lines.push(`- Séries totales (muscu) : ${hero.series}`)
    lines.push(`- Charge moyenne par série : ${hero.avgLoad} kg`)
  }
  lines.push('')

  // ── Répartition muscu par type ─────────────────────────────────
  if (data.distribution.length > 0) {
    lines.push('## Répartition muscu par type')
    for (const d of data.distribution) {
      lines.push(
        `- ${d.label} : ${d.seances} séance${d.seances > 1 ? 's' : ''} · ${d.volume.toLocaleString('fr-FR')} kg (${d.percent} %)`,
      )
    }
    lines.push('')
  }

  // ── Exercices les plus travaillés ──────────────────────────────
  if (data.topExos.length > 0) {
    lines.push('## Exercices les plus travaillés')
    data.topExos.forEach((e, i) => {
      const trend =
        e.trendPct != null
          ? ` · ${e.trendPct >= 0 ? '+' : ''}${e.trendPct} % vs ${PERIOD_DAYS_LABEL[period]} précédents`
          : ''
      lines.push(`${i + 1}. ${e.nom} — ${e.volume.toLocaleString('fr-FR')} kg${trend}`)
    })
    lines.push('')
  }

  // ── Records récents (charge max par exo) ───────────────────────
  if (data.recentPrs.length > 0) {
    lines.push('## Records récents')
    for (const pr of data.recentPrs) {
      lines.push(`- ${pr.nom} : ${pr.poids} kg × ${pr.reps}`)
    }
    lines.push('')
  }

  // ── Athlétisme par distance ────────────────────────────────────
  if (runs.length > 0) {
    const byDist = new Map<number, { count: number; best: number }>()
    for (const r of runs) {
      const cur = byDist.get(r.distance_m)
      if (!cur) byDist.set(r.distance_m, { count: 1, best: r.duration_ms })
      else {
        cur.count++
        if (r.duration_ms < cur.best) cur.best = r.duration_ms
      }
    }
    lines.push('## Athlétisme par distance')
    for (const [dist, x] of Array.from(byDist.entries()).sort((a, b) => a[0] - b[0])) {
      lines.push(
        `- ${dist} m : ${x.count} chrono${x.count > 1 ? 's' : ''} · meilleur ${formatChrono(x.best)}`,
      )
    }
    lines.push('')
  }

  return `${PERIOD_COACH_PROMPT}\n\n${lines.join('\n').trimEnd()}\n`
}

// ─────────────────────────────────────────────────────────────────────────
// PLANIFICATION — helpers de date partagés (UI + cron).
// ─────────────────────────────────────────────────────────────────────────

// Date du jour au fuseau Europe/Paris, format YYYY-MM-DD (en-CA = ISO).
export function isoDateInParis(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

// Les 7 dates ISO (YYYY-MM-DD) d'une semaine à partir de son lundi.
export function weekDatesFrom(mondayIso: string): string[] {
  const base = new Date(mondayIso + 'T00:00:00Z')
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

export function formatSessionAsText(session: SessionState, profile?: ProfileHeader): string {
  const type = WORKOUT_TYPES.find((t) => t.id === session.type)
  const typeLabel = type?.label ?? session.type ?? 'Séance'

  const now = new Date()
  const dateLong = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now)
  const timeStr = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(now)

  const exos = session.exos.filter((e) => e.series.length > 0)
  const totalSeries = exos.reduce((a, e) => a + e.series.length, 0)
  const totalVolume = exos.reduce(
    (a, e) => a + e.series.reduce((b, s) => (s.reps == null ? b : b + s.poids * s.reps), 0),
    0,
  )

  const lines: string[] = []
  const profileLine = formatProfileLine(profile)
  if (profileLine) {
    lines.push(profileLine)
    lines.push('')
  }
  lines.push(`# Séance ${typeLabel} — ${dateLong}, ${timeStr}`)
  lines.push('')
  lines.push(`- Repos cible entre séries : ${formatMMSS(session.restTargetSec)} (${session.restTargetSec}s)`)
  lines.push(
    `- Total : ${exos.length} exercice${exos.length > 1 ? 's' : ''} · ${totalSeries} série${totalSeries > 1 ? 's' : ''} · ${totalVolume.toLocaleString('fr-FR')} kg`,
  )
  lines.push('')

  for (const group of groupSupersets(exos)) {
    const isSuperset = group.length > 1
    if (isSuperset) {
      lines.push(`## Superset — ${group.map((e) => e.nom).join(' + ')} (alterné)`)
    }
    for (const exo of group) {
      lines.push(
        isSuperset
          ? `**${exo.nom}${exo.isUnilateral ? ' (unilatéral)' : ''}**`
          : `## ${exo.nom}${exo.isUnilateral ? ' (unilatéral)' : ''}`,
      )
      exo.series.forEach((s, i) => lines.push(formatSerieLine(i, s, exo.isBodyweight)))
      lines.push('')
    }
  }

  return lines.join('\n').trimEnd() + '\n'
}
