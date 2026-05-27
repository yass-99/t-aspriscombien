'use client'

import { useEffect, useState } from 'react'
import { useToast } from '../../_components/Toast'
import type { Period } from './useDashboard'

export type MuscleGroupKey =
  | 'chest'
  | 'shoulders'
  | 'back'
  | 'biceps'
  | 'forearms'
  | 'triceps'
  | 'quads'
  | 'glutes'
  | 'hamstrings'
  | 'calves'
  | 'traps'
  | 'core'

export type HeatmapGroup = {
  groupId: number
  groupKey: MuscleGroupKey
  label: string
  volume: number
  series: number
  lastSessionDaysAgo: number | null
}

export type HeatmapData = {
  period: Period
  maxVolume: number
  groups: HeatmapGroup[]
}

export function useHeatmap(period?: Period) {
  const [data, setData] = useState<HeatmapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const qs = period ? `?period=${encodeURIComponent(period)}` : ''
        const res = await fetch(`/api/heatmap${qs}`)
        if (cancelled) return
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          const msg = e.error || `Erreur ${res.status}`
          setError(msg)
          toast.error(`Heatmap : ${msg}`)
        } else {
          const d = (await res.json()) as HeatmapData
          setData(d)
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
  }, [toast, period])

  return { data, loading, error }
}
