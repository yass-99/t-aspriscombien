import { describe, expect, it } from 'vitest'
import { isoDateInParis, weekDatesFrom } from './helpers'

describe('isoDateInParis', () => {
  it('rend la date locale Europe/Paris au format YYYY-MM-DD', () => {
    // 2026-06-02T23:30:00Z = 01:30 le 3 juin à Paris (CEST, UTC+2)
    expect(isoDateInParis(new Date('2026-06-02T23:30:00Z'))).toBe('2026-06-03')
    // 2026-01-15T00:30:00Z = 01:30 le 15 janvier à Paris (CET, UTC+1)
    expect(isoDateInParis(new Date('2026-01-15T00:30:00Z'))).toBe('2026-01-15')
  })
})

describe('weekDatesFrom', () => {
  it('rend les 7 jours ISO à partir du lundi donné', () => {
    expect(weekDatesFrom('2026-06-08')).toEqual([
      '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11',
      '2026-06-12', '2026-06-13', '2026-06-14',
    ])
  })
})
