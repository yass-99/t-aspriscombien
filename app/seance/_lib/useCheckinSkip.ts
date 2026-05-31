'use client'

import { useEffect, useState } from 'react'
import { weekKey } from './profile'

// État « check-in repoussé cette semaine », partagé et réactif entre la grosse
// carte (WeeklyCheckIn) et la pill d'alerte (StatusSpot). Persisté en localStorage
// sous tcp:checkin:skip = clé de la semaine ISO courante.
const KEY = 'tcp:checkin:skip'
const listeners = new Set<() => void>()

function read(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(KEY) === weekKey()
  } catch {
    return false
  }
}

export function skipCheckinThisWeek() {
  try {
    window.localStorage.setItem(KEY, weekKey())
  } catch {
    /* ignore */
  }
  for (const l of listeners) l()
}

export function useCheckinSkip(): boolean {
  const [skipped, setSkipped] = useState<boolean>(() => read())
  useEffect(() => {
    const l = () => setSkipped(read())
    listeners.add(l)
    // Resynchronise au montage (le store a pu changer avant l'abonnement).
    l()
    return () => {
      listeners.delete(l)
    }
  }, [])
  return skipped
}
