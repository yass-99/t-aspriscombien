'use client'

import { useEffect, useState } from 'react'

export type Prefs = {
  soundEnabled: boolean
  hapticEnabled: boolean
}

const KEY = 'tpc.prefs.v1'
const CHANGE_EVENT = 'tpc.prefs.changed'

const defaults: Prefs = {
  soundEnabled: true,
  hapticEnabled: true,
}

export function readPrefs(): Prefs {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : defaults.soundEnabled,
      hapticEnabled:
        typeof parsed.hapticEnabled === 'boolean' ? parsed.hapticEnabled : defaults.hapticEnabled,
    }
  } catch {
    return defaults
  }
}

export function writePrefs(next: Prefs) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent<Prefs>(CHANGE_EVENT, { detail: next }))
  } catch {
    // ignore quota / disabled storage
  }
}

export function usePrefs(): [Prefs, (next: Partial<Prefs>) => void] {
  const [prefs, setPrefs] = useState<Prefs>(defaults)

  useEffect(() => {
    setPrefs(readPrefs())
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Prefs>).detail
      if (detail) setPrefs(detail)
    }
    window.addEventListener(CHANGE_EVENT, onChange as EventListener)
    return () => window.removeEventListener(CHANGE_EVENT, onChange as EventListener)
  }, [])

  const update = (patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const merged = { ...p, ...patch }
      writePrefs(merged)
      return merged
    })
  }

  return [prefs, update]
}
