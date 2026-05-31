'use client'

import { useEffect, useState } from 'react'

/**
 * Vrai uniquement après le montage côté client. Sert à éviter les mismatches
 * d'hydratation pour le contenu dérivé de localStorage ou de l'heure courante :
 * on rend l'état « serveur » (neutre) tant que `mounted` est faux.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])
  return mounted
}
