import { describe, expect, it } from 'vitest'
import { bucketActivityWindow } from './runs'
import { isoLocalDate } from './profile'
import type { Run } from './types'

const run = (date: string): Run => ({
  id: date,
  date,
  distance_m: 100,
  duration_ms: 15000,
  created_at: '',
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
