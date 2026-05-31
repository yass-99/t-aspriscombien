'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check, X } from './icons'
import { WeightChart, type WeightPoint } from './WeightChart'
import { WeightDial, fmtKg, round1 } from './WeightDial'
import { useBodyweight, invalidateBodyweightCache } from '../_lib/useBodyweight'
import { weekStartMonday } from '../_lib/profile'

/**
 * Modal de saisie du poids de corps (même dial ludique que le check-in).
 * Ouvert depuis la pill d'alerte (StatusSpot) une fois le check-in repoussé.
 */
export function WeightModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { bodyweights, current } = useBodyweight()
  const [weight, setWeight] = useState<number>(75)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // (Ré)initialise le dial à l'ouverture avec la dernière pesée connue.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setWeight(current ?? 75)
  }, [open, current])

  // Verrouille le scroll du body tant que le modal est ouvert.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

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

  const liveDelta = prevWeekValue != null ? round1(weight - prevWeekValue) : null

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
        onClose()
      }, 900)
    } catch {
      setSaving(false)
    } finally {
      setSaving(false)
    }
  }

  if (!mounted) return null

  const sheet = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px 16px max(16px, env(safe-area-inset-bottom))',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) onClose()
          }}
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 448,
              padding: 20,
              borderRadius: 18,
              background: 'var(--surface)',
              boxShadow: '0 0 0 1px var(--line) inset, 0 22px 60px -22px rgba(0,0,0,0.5)',
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
                    gap: 10,
                    background: 'var(--surface)',
                    zIndex: 2,
                  }}
                >
                  <motion.span
                    initial={{ scale: 0.4 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 999,
                      background: 'var(--ok)',
                      color: 'var(--bg)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={24} stroke={3} />
                  </motion.span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand)' }}>
                    {fmtKg(weight)} kg — noté&nbsp;!
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  letterSpacing: -0.3,
                  fontFamily: 'var(--display)',
                  flex: 1,
                }}
              >
                Ta pesée de la semaine
              </span>
              <button
                onClick={onClose}
                aria-label="fermer"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--surface-2)',
                  color: 'var(--ink-2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={15} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              Glisse ou ajuste, puis valide.
            </div>

            <WeightDial value={weight} onChange={setWeight} />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 4,
                marginBottom: 12,
                minHeight: 18,
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
            </div>

            {chartPoints.length >= 2 && (
              <div style={{ margin: '0 -4px 14px' }}>
                <WeightChart points={chartPoints} height={44} />
              </div>
            )}

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
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Enregistrement…' : 'Valider ma pesée'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(sheet, document.body)
}
