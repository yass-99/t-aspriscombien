import { describe, expect, it } from 'vitest'
import { planDiff } from './plan'

const WEEK = ['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12','2026-06-13','2026-06-14']

describe('planDiff', () => {
  it('détecte ajouts, changements et suppressions dans la semaine', () => {
    const existing = [
      { date: '2026-06-08', type: 'push' },
      { date: '2026-06-10', type: 'pull' },
    ]
    const edited = [
      { date: '2026-06-08', type: 'push' }, // inchangé → ni upsert ni delete
      { date: '2026-06-10', type: 'legs' }, // changé → upsert
      { date: '2026-06-12', type: 'core' }, // nouveau → upsert
    ]
    const { upserts, deletes } = planDiff(WEEK, existing, edited)
    expect(upserts).toEqual([
      { date: '2026-06-10', type: 'legs' },
      { date: '2026-06-12', type: 'core' },
    ])
    expect(deletes).toEqual([])
  })

  it('supprime un jour retiré de la semaine', () => {
    const existing = [{ date: '2026-06-08', type: 'push' }]
    const edited: { date: string; type: string }[] = []
    const { upserts, deletes } = planDiff(WEEK, existing, edited)
    expect(upserts).toEqual([])
    expect(deletes).toEqual(['2026-06-08'])
  })

  it('ignore les dates hors de la semaine', () => {
    const { upserts, deletes } = planDiff(
      WEEK,
      [],
      [{ date: '2026-07-01', type: 'push' }],
    )
    expect(upserts).toEqual([])
    expect(deletes).toEqual([])
  })
})
