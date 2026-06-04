export type PlanEntry = { date: string; type: string }

// Libellés affichables des types (alignés sur WORKOUT_TYPES + athlétisme).
export const TYPE_LABELS: Record<string, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Jambes',
  full: 'Full body',
  upper: 'Upper',
  core: 'Abdos',
  athletics: 'Athlétisme',
}

// Items du StatusSpot hors alertes : si une séance est prévue ce jour, le
// greeting cède la place au rappel ; sinon greeting + entrée de planif.
export function buildIdleItems(greeting: string, plannedLabel: string | null): string[] {
  if (plannedLabel) return [`Aujourd'hui : ${plannedLabel}`, 'Ma semaine']
  return [greeting, 'Planifier ma semaine']
}

type PlanRow = { user_id: string; type: string }
type SubRow = { user_id: string; endpoint: string; p256dh: string; auth: string }
export type PushTask = {
  sub: { endpoint: string; keys: { p256dh: string; auth: string } }
  payload: { title: string; body: string; url: string }
}

// Jointure pure plans×abonnements : pour chaque abonnement dont l'utilisateur a
// une séance ce jour, produit la tâche d'envoi (message + clés).
export function selectNotifiable(plans: PlanRow[], subs: SubRow[]): PushTask[] {
  const typeByUser = new Map(plans.map((p) => [p.user_id, p.type]))
  const tasks: PushTask[] = []
  for (const s of subs) {
    const type = typeByUser.get(s.user_id)
    if (!type) continue
    const label = TYPE_LABELS[type] ?? type
    tasks.push({
      sub: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      payload: {
        title: `Séance ${label} aujourd'hui`,
        body: "On y va ? Ta séance t'attend.",
        url: '/seance',
      },
    })
  }
  return tasks
}

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
