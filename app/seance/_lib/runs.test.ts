import { describe, expect, it } from 'vitest'
import { bucketActivityWindow, groupRunsIntoSessions } from './runs'
import { isoLocalDate } from './profile'
import type { Run } from './types'

const run = (date: string): Run => ({
  id: date,
  date,
  distance_m: 100,
  duration_ms: 15000,
  created_at: '',
  session_id: null,
})

describe('bucketActivityWindow', () => {
  it("place un run daté aujourd'hui (local) dans la case du jour", () => {
    // 21h heure LOCALE — à l'est de Greenwich, .toISOString() basculait la veille.
    const now = new Date('2026-06-04T21:00:00')
    const todayLocal = isoLocalDate(now) // '2026-06-04' quel que soit le fuseau

    const out = bucketActivityWindow([run(todayLocal)], 0, 7, now)
    const todayCell = out[out.length - 1]

    expect(todayCell.isToday).toBe(true)
    expect(todayCell.date).toBe(todayLocal)
    expect(todayCell.runs).toBe(1)
  })

  it('rend une fenêtre de N jours, terminée aujourd’hui (endDaysAgo=0)', () => {
    const now = new Date('2026-06-04T10:00:00')
    const out = bucketActivityWindow([], 0, 7, now)
    expect(out).toHaveLength(7)
    expect(out[6].date).toBe(isoLocalDate(now))
    expect(out.filter((d) => d.isToday)).toHaveLength(1)
  })
})

// Construit un Run minimal ; la date locale est dérivée du created_at sauf override.
function mkRun(over: Partial<Run> & Pick<Run, 'id' | 'created_at'>): Run {
  return {
    date: over.created_at.slice(0, 10),
    distance_m: 100,
    duration_ms: 12000,
    session_id: null,
    ...over,
  } as Run
}

describe('groupRunsIntoSessions', () => {
  it('regroupe les runs d’un même session_id même à plus de 1h30 d’écart', () => {
    const runs = [
      mkRun({ id: 'a', session_id: 's1', created_at: '2026-06-14T10:00:00Z' }),
      mkRun({ id: 'b', session_id: 's1', created_at: '2026-06-14T13:00:00Z' }),
    ]
    const sessions = groupRunsIntoSessions(runs)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe('s1')
    expect(sessions[0].runs.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('sépare deux session_id distincts même à moins de 1h30 d’écart', () => {
    const runs = [
      mkRun({ id: 'a', session_id: 's1', created_at: '2026-06-14T10:00:00Z' }),
      mkRun({ id: 'b', session_id: 's2', created_at: '2026-06-14T10:05:00Z' }),
    ]
    const sessions = groupRunsIntoSessions(runs)
    expect(sessions).toHaveLength(2)
    expect(new Set(sessions.map((s) => s.id))).toEqual(new Set(['s1', 's2']))
  })

  it('mélange : session_id réel groupé par id, runs NULL repliés sur l’heuristique', () => {
    const a = mkRun({ id: 'a', session_id: 's1', created_at: '2026-06-14T10:00:00Z' })
    const b = mkRun({ id: 'b', session_id: 's1', created_at: '2026-06-14T13:00:00Z' })
    const c = mkRun({ id: 'c', session_id: null, created_at: '2026-06-14T10:30:00Z' })
    const d = mkRun({ id: 'd', session_id: null, created_at: '2026-06-14T10:35:00Z' })
    const sessions = groupRunsIntoSessions([a, b, c, d])
    expect(sessions).toHaveLength(2)
    const real = sessions.find((s) => s.id === 's1')
    expect(real?.runs.map((r) => r.id)).toEqual(['a', 'b'])
    const heuristic = sessions.find((s) => s.id === 'as_c')
    expect(heuristic?.runs.map((r) => r.id)).toEqual(['c', 'd'])
  })

  it('runs NULL : sépare toujours sur un gap > 1h30 (heuristique conservée)', () => {
    const runs = [
      mkRun({ id: 'a', created_at: '2026-06-14T10:00:00Z' }),
      mkRun({ id: 'b', created_at: '2026-06-14T12:00:00Z' }),
    ]
    const sessions = groupRunsIntoSessions(runs)
    expect(sessions).toHaveLength(2)
  })
})
