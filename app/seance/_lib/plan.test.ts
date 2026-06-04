import { describe, expect, it } from 'vitest'
import { buildIdleItems, planDiff, selectNotifiable, TYPE_LABELS } from './plan'

describe('selectNotifiable', () => {
  it('joint plans et abonnements par user et construit le message', () => {
    const plans = [
      { user_id: 'u1', type: 'push' },
      { user_id: 'u2', type: 'athletics' },
    ]
    const subs = [
      { user_id: 'u1', endpoint: 'e1', p256dh: 'k1', auth: 'a1' },
      { user_id: 'u3', endpoint: 'e3', p256dh: 'k3', auth: 'a3' }, // pas de plan → ignoré
    ]
    const out = selectNotifiable(plans, subs)
    expect(out).toHaveLength(1)
    expect(out[0].sub.endpoint).toBe('e1')
    expect(out[0].sub.keys).toEqual({ p256dh: 'k1', auth: 'a1' })
    expect(out[0].payload.title).toContain('Push')
    expect(out[0].payload.url).toBe('/seance')
  })
})

describe('buildIdleItems', () => {
  it('sans séance du jour : greeting + Planifier', () => {
    expect(buildIdleItems('Bonjour', null)).toEqual(['Bonjour', 'Planifier ma semaine'])
  })
  it('avec séance du jour : remplace le greeting par le rappel + Ma semaine', () => {
    expect(buildIdleItems('Bonjour', TYPE_LABELS.push)).toEqual([
      "Aujourd'hui : Push",
      'Ma semaine',
    ])
  })
})

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
