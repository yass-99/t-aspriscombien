'use client'

import { useEffect, useState } from 'react'

// État « onboarding profil repoussé », persistant (pas hebdo) et réactif, partagé
// entre le modal d'accueil (SessionClient) et la pill d'alerte (StatusSpot).
// Tant que le profil n'est pas complété, l'alerte reste disponible dans la pill.
const KEY = 'tcp:onboarding:dismissed'
const listeners = new Set<() => void>()

function read(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function dismissOnboarding() {
  try {
    window.localStorage.setItem(KEY, '1')
  } catch {
    /* ignore */
  }
  for (const l of listeners) l()
}

export function useOnboardingDismiss(): boolean {
  const [dismissed, setDismissed] = useState<boolean>(() => read())
  useEffect(() => {
    const l = () => setDismissed(read())
    listeners.add(l)
    l()
    return () => {
      listeners.delete(l)
    }
  }, [])
  return dismissed
}
