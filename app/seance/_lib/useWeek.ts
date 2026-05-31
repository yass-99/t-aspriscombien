'use client'

import { useEffect, useState } from 'react'
import type { WeekData } from './helpers'
import { useToast } from '../../_components/Toast'

// Charge le détail complet d'une semaine (lundi → dimanche) pour le bilan LLM.
// `enabled` permet de différer le fetch jusqu'à l'ouverture de la feuille.
export function useWeek(enabled: boolean, offset = 0) {
  const [data, setData] = useState<WeekData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/week?offset=${offset}`)
        if (cancelled) return
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          const msg = e.error || `Erreur ${res.status}`
          setError(msg)
          toast.error(`Bilan semaine : ${msg}`)
        } else {
          setData((await res.json()) as WeekData)
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Erreur réseau'
          setError(msg)
          toast.warn(`Hors ligne ? ${msg}`)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [enabled, offset, toast])

  return { data, loading, error }
}
