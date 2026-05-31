export type Sexe = 'H' | 'F' | 'A'

export type Profile = {
  sexe: Sexe | null
  tailleCm: number | null
  birthDate: string | null // ISO yyyy-mm-dd
}

export type Bodyweight = {
  id: number
  date: string // ISO yyyy-mm-dd
  poidsKg: number
}

// Âge en années pleines depuis une date de naissance ISO. null si absente/invalide.
export function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null
  const d = new Date(birthDate + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age >= 0 && age < 130 ? age : null
}

// Lundi 00:00 (heure locale) de la semaine contenant `d`. Aligné sur le dashboard.
export function weekStartMonday(d: Date = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay() || 7
  x.setDate(x.getDate() - day + 1)
  return x
}

// Clé de semaine ISO locale "yyyy-mm-dd" du lundi (sert de clé de skip hebdo).
export function weekKey(d: Date = new Date()): string {
  const w = weekStartMonday(d)
  const y = w.getFullYear()
  const m = String(w.getMonth() + 1).padStart(2, '0')
  const day = String(w.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Une pesée datée (ISO) tombe-t-elle dans la semaine courante (lundi→dimanche, local) ?
export function isThisWeek(isoDate: string | null | undefined, now: Date = new Date()): boolean {
  if (!isoDate) return false
  const d = new Date(isoDate + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() >= weekStartMonday(now).getTime()
}
