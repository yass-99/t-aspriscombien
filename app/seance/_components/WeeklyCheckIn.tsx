'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Spark } from './icons'
import { WeightChart, type WeightPoint } from './WeightChart'
import { WeightDial, fmtKg, round1 } from './WeightDial'
import {
  useBodyweight,
  invalidateBodyweightCache,
} from '../_lib/useBodyweight'
import { isThisWeek, weekStartMonday } from '../_lib/profile'
import { useCheckinSkip, skipCheckinThisWeek } from '../_lib/useCheckinSkip'
import { useMounted } from '../_lib/useMounted'

type View = 'due' | 'done' | 'hidden'

export function WeeklyCheckIn() {
  const mounted = useMounted()
  const { bodyweights, current, lastDate, loading } = useBodyweight()
  const skipped = useCheckinSkip()
  // override = action utilisateur qui prime sur l'état naturel (réédition).
  const [override, setOverride] = useState<'edit' | null>(null)
  const [weight, setWeight] = useState<number>(75)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  // Vue dérivée des données + de l'override (pas de setState dans un effet).
  const doneThisWeek = isThisWeek(lastDate)
  let view: View | null
  if (loading) view = null
  else if (justSaved) view = 'due' // garde la carte pendant l'animation de succès
  else if (override === 'edit') view = 'due'
  else if (doneThisWeek) view = 'done'
  else if (skipped) view = 'hidden' // repoussé → l'alerte vit dans la pill (StatusSpot)
  else view = 'due'

  // Valeur initiale du dial = dernière pesée connue (ou 75).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (current != null) setWeight(current)
  }, [current])

  // Dernière mesure AVANT la semaine courante → base du delta.
  const prevWeekValue = useMemo(() => {
    const weekStart = weekStartMonday().getTime()
    let v: number | null = null
    for (const b of bodyweights) {
      if (new Date(b.date + 'T00:00:00').getTime() < weekStart) v = b.poidsKg
    }
    return v
  }, [bodyweights])

  const chartPoints: WeightPoint[] = useMemo(
    () => bodyweights.map((b) => ({ date: b.date, value: b.poidsKg })),
    [bodyweights],
  )

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/bodyweight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poidsKg: weight }),
      })
      if (!res.ok) {
        setSaving(false)
        return
      }
      invalidateBodyweightCache()
      setJustSaved(true)
      window.setTimeout(() => {
        setJustSaved(false)
        setOverride(null) // l'état naturel devient « done » après le refetch
      }, 1100)
    } catch {
      setSaving(false)
    } finally {
      setSaving(false)
    }
  }

  const skip = () => {
    skipCheckinThisWeek()
    setOverride(null)
  }

  // L'état « faite » est désormais rendu en pastille verte dans le hero (StatusSpot).
  // Ce composant n'affiche QUE la saisie de la pesée (« due »).
  if (!mounted || view !== 'due') return null

  const liveDelta = prevWeekValue != null ? round1(weight - prevWeekValue) : null

  let message: string
  if (liveDelta == null) message = 'Première pesée — on lance le suivi.'
  else if (Math.abs(liveDelta) < 0.3) message = 'Constant. Solide.'
  else if (liveDelta > 0) message = 'Ça monte — surveille la prise.'
  else message = 'En sèche ? Garde le cap.'

  return (
    <div style={{ padding: '0 20px 14px' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key="due"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            style={{
              position: 'relative',
              padding: 18,
              borderRadius: 'var(--radius)',
              background: 'var(--brand-soft)',
              boxShadow: '0 0 0 1px var(--brand-line) inset',
              overflow: 'hidden',
            }}
          >
            <AnimatePresence>
              {justSaved && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    background: 'var(--brand-soft)',
                    zIndex: 2,
                  }}
                >
                  <motion.span
                    initial={{ scale: 0.4 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 999,
                      background: 'var(--ok)',
                      color: 'var(--bg)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={22} stroke={3} />
                  </motion.span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)' }}>
                    {fmtKg(weight)} kg — noté&nbsp;!
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* En-tête */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
                animation: 'fadeUp 560ms 0.12s cubic-bezier(0.22, 1, 0.36, 1) both',
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Spark size={12} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                Check-in hebdo
              </span>
              <span style={{ flex: 1 }} />
              <button
                onClick={skip}
                style={{
                  appearance: 'none',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--muted)',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'var(--font)',
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                plus tard
              </button>
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-2)',
                marginBottom: 14,
                animation: 'fadeUp 560ms 0.22s cubic-bezier(0.22, 1, 0.36, 1) both',
              }}
            >
              Nouvelle semaine — t&apos;as pris combien&nbsp;?
            </div>

            {/* Dial draggable */}
            <div style={{ animation: 'fadeUp 620ms 0.34s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
              <WeightDial value={weight} onChange={setWeight} />
            </div>

            {/* Delta + message */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 4,
                marginBottom: 12,
                minHeight: 18,
                animation: 'fadeUp 560ms 0.46s cubic-bezier(0.22, 1, 0.36, 1) both',
              }}
            >
              {liveDelta != null && liveDelta !== 0 && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'var(--mono)',
                    color: 'var(--muted)',
                  }}
                >
                  {liveDelta > 0 ? '▲ +' : '▼ −'}
                  {fmtKg(Math.abs(liveDelta))} kg vs S-1
                </span>
              )}
              <span style={{ fontSize: 12, color: 'var(--subtle)' }}>{message}</span>
            </div>

            {/* Mini-courbe */}
            {chartPoints.length >= 2 && (
              <div
                style={{
                  margin: '0 -4px 12px',
                  animation: 'fadeUp 580ms 0.56s cubic-bezier(0.22, 1, 0.36, 1) both',
                }}
              >
                <WeightChart points={chartPoints} height={40} />
              </div>
            )}

            <div style={{ animation: 'fadeUp 580ms 0.66s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  width: '100%',
                  appearance: 'none',
                  border: 'none',
                  borderRadius: 12,
                  cursor: saving ? 'default' : 'pointer',
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: 'var(--font)',
                  height: 48,
                  boxShadow: '0 8px 22px -8px color-mix(in oklch, var(--brand) 55%, transparent)',
                  transition: 'opacity 140ms',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Enregistrement…' : 'Valider ma pesée'}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
