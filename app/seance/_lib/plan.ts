export type PlanEntry = { date: string; type: string }

// Compare l'état édité au stocké, restreint à la semaine, et rend les écritures
// minimales : upserts (jours ajoutés/changés) + deletes (jours retirés).
export function planDiff(
  weekDates: string[],
  existing: PlanEntry[],
  edited: PlanEntry[],
): { upserts: PlanEntry[]; deletes: string[] } {
  const week = new Set(weekDates)
  const editedMap = new Map(edited.filter((e) => week.has(e.date)).map((e) => [e.date, e.type]))
  const existingMap = new Map(existing.filter((e) => week.has(e.date)).map((e) => [e.date, e.type]))

  const upserts: PlanEntry[] = []
  for (const [date, type] of editedMap) {
    if (existingMap.get(date) !== type) upserts.push({ date, type })
  }
  const deletes: string[] = []
  for (const date of existingMap.keys()) {
    if (!editedMap.has(date)) deletes.push(date)
  }
  return { upserts, deletes }
}
