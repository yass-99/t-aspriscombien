import type { SessionState } from './types'
import { WORKOUT_TYPES } from './constants'

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

type SeanceLike = {
  date: string
  type: string
  restTargetSec: number
  exos: {
    nom: string
    series: { poids: number; reps: number | null; rir: number | null; degressive: boolean }[]
  }[]
}

export function formatSeanceAsText(seance: SeanceLike): string {
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
  lines.push(`# Séance ${typeLabel} — ${dateLong}`)
  lines.push('')
  lines.push(`- Repos cible entre séries : ${formatMMSS(seance.restTargetSec)} (${seance.restTargetSec}s)`)
  lines.push(
    `- Total : ${exos.length} exercice${exos.length > 1 ? 's' : ''} · ${totalSeries} série${totalSeries > 1 ? 's' : ''} · ${totalVolume.toLocaleString('fr-FR')} kg`,
  )
  lines.push('')

  for (const exo of exos) {
    lines.push(`## ${exo.nom}`)
    exo.series.forEach((s, i) => {
      const flag = s.degressive ? ' (dégressive)' : ''
      const reps = s.reps == null ? 'JSP' : s.reps
      const rir = s.rir == null ? 'JSP' : s.rir
      lines.push(`${i + 1}. ${fmtPoids(s.poids)} kg × ${reps} reps · RIR ${rir}${flag}`)
    })
    lines.push('')
  }

  return lines.join('\n').trimEnd() + '\n'
}

export function formatSessionAsText(session: SessionState): string {
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
  lines.push(`# Séance ${typeLabel} — ${dateLong}, ${timeStr}`)
  lines.push('')
  lines.push(`- Repos cible entre séries : ${formatMMSS(session.restTargetSec)} (${session.restTargetSec}s)`)
  lines.push(
    `- Total : ${exos.length} exercice${exos.length > 1 ? 's' : ''} · ${totalSeries} série${totalSeries > 1 ? 's' : ''} · ${totalVolume.toLocaleString('fr-FR')} kg`,
  )
  lines.push('')

  for (const exo of exos) {
    lines.push(`## ${exo.nom}`)
    exo.series.forEach((s, i) => {
      const flag = s.degressive ? ' (dégressive)' : ''
      const reps = s.reps == null ? 'JSP' : s.reps
      const rir = s.rir == null ? 'JSP' : s.rir
      lines.push(`${i + 1}. ${fmtPoids(s.poids)} kg × ${reps} reps · RIR ${rir}${flag}`)
    })
    lines.push('')
  }

  return lines.join('\n').trimEnd() + '\n'
}
