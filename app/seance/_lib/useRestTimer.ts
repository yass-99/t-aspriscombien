'use client'

import { Dispatch, SetStateAction, useEffect, useCallback, useRef } from 'react'
import type { SessionState } from './types'
import { playRestEndAlert } from './restAlert'
import { readPrefs } from './prefs'

export function useRestTimer(
  session: SessionState,
  setSession: Dispatch<SetStateAction<SessionState>>,
) {
  const status = session.timer.status
  const targetEndAt = session.timer.targetEndAt ?? null
  const alertedRef = useRef(false)

  // Reset the alert latch whenever a new rest period starts.
  useEffect(() => {
    alertedRef.current = false
  }, [targetEndAt])

  // Wall-clock tick: recompute remainingSec from targetEndAt so the timer
  // survives backgrounded tabs / locked phones / suspended setInterval.
  useEffect(() => {
    if ((status !== 'running' && status !== 'finished') || targetEndAt == null) return

    const tick = () => {
      const now = Date.now()
      setSession((s) => {
        const end = s.timer.targetEndAt
        if (end == null) return s
        const diffMs = end - now
        if (diffMs > 0) {
          const remaining = Math.ceil(diffMs / 1000)
          if (
            s.timer.remainingSec === remaining &&
            s.timer.status === 'running' &&
            s.timer.overtimeSec === 0 &&
            !s.timer.justFinished
          ) {
            return s
          }
          return {
            ...s,
            timer: {
              ...s.timer,
              remainingSec: remaining,
              status: 'running',
              overtimeSec: 0,
              justFinished: false,
            },
          }
        }
        const overtime = Math.floor(-diffMs / 1000)
        const wasRunning = s.timer.status === 'running'
        return {
          ...s,
          timer: {
            ...s.timer,
            remainingSec: 0,
            status: 'finished',
            overtimeSec: overtime,
            justFinished: wasRunning,
          },
        }
      })
    }

    tick()
    const id = setInterval(tick, 1000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
    }
  }, [status, targetEndAt, setSession])

  useEffect(() => {
    if (!session.timer.justFinished) return
    if (alertedRef.current) return
    alertedRef.current = true
    const prefs = readPrefs()
    playRestEndAlert({ sound: prefs.soundEnabled, haptic: prefs.hapticEnabled })
    const id = setTimeout(
      () =>
        setSession((s) => ({
          ...s,
          timer: { ...s.timer, justFinished: false },
        })),
      900,
    )
    return () => clearTimeout(id)
  }, [session.timer.justFinished, setSession])

  const adjust = useCallback(
    (delta: number) => {
      setSession((s) => {
        const now = Date.now()
        const currentEnd = s.timer.targetEndAt ?? now + s.timer.remainingSec * 1000
        const newEnd = currentEnd + delta * 1000
        if (newEnd > now) {
          return {
            ...s,
            timer: {
              ...s.timer,
              targetEndAt: newEnd,
              remainingSec: Math.ceil((newEnd - now) / 1000),
              status: 'running',
              overtimeSec: 0,
              justFinished: false,
            },
          }
        }
        return {
          ...s,
          timer: {
            ...s.timer,
            targetEndAt: null,
            remainingSec: 0,
            status: 'idle',
            overtimeSec: 0,
            justFinished: false,
          },
        }
      })
    },
    [setSession],
  )

  return { adjust }
}
