'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Card } from './primitives'
import { Check, Plus, X } from './icons'
import { WeightChart, type WeightPoint } from './WeightChart'
import { SkeletonChart } from './Skeleton'
import { WeightDial, fmtKg, round1 } from './WeightDial'
import { useBodyweight, invalidateBodyweightCache } from '../_lib/useBodyweight'
import { useMounted } from '../_lib/useMounted'

type Range = '30d' | '90d' | '1y' | 'all'

const RANGES: { id: Range; label: string }[] = [
  { id: '30d', label: '30j' },
  { id: '90d', label: '90j' },
  { id: '1y', label: '1 an' },
  { id: 'all', label: 'Tout' },
]

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
    .format(d)
    .replace('.', '')
}

/**
 * Modal détaillé du suivi de poids (ouvert depuis la carte Global des stats).
 * Courbe sur période ajustable, stats min/max/moyenne/variation, historique
 * complet et saisie rapide d'une pesée (datée du jour côté serveur).
 */
export function WeightDetailModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mounted = useMounted()
  const { bodyweights, current, loading } = useBodyweight()
  const [range, setRange] = useState<Range>('90d')

  // Saisie rapide repliable.
  const [entryOpen, setEntryOpen] = useState(false)
  const [weight, setWeight] = useState<number>(75)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  // (Ré)initialise le dial à l'ouverture avec la dernière pesée connue.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWeight(current ?? 75)
    setEntryOpen(false)
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

  const points: WeightPoint[] = useMemo(() => {
    const mapped = bodyweights.map((b) => ({ date: b.date, value: b.poidsKg }))
    if (range === 'all') return mapped
    const days = range === '30d' ? 30 : range === '90d' ? 90 : 365
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() - days)
    return mapped.filter((p) => new Date(p.date + 'T00:00:00').getTime() >= cutoff.getTime())
  }, [bodyweights, range])

  const stats = useMemo(() => {
    if (points.length === 0) return null
    const values = points.map((p) => p.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const variation = round1(values[values.length - 1] - values[0])
    return { min, max, avg: round1(avg), variation, count: points.length }
  }, [points])

  // Historique le plus récent en premier, avec le delta vs la pesée précédente.
  const history = useMemo(() => {
    const asc = [...bodyweights]
    return asc
      .map((b, i) => ({
        ...b,
        delta: i > 0 ? round1(b.poidsKg - asc[i - 1].poidsKg) : null,
      }))
      .reverse()
  }, [bodyweights])

  const liveCurrent = points.length ? points[points.length - 1].value : current

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
        setEntryOpen(false)
      }, 1000)
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
            className="app-scroll"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 448,
              maxHeight: '88vh',
              overflowY: 'auto',
              padding: 20,
              borderRadius: 18,
              background: 'var(--surface)',
              boxShadow: '0 0 0 1px var(--line) inset, 0 22px 60px -22px rgba(0,0,0,0.5)',
            }}
          >
            {/* En-tête */}
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
                Suivi du poids
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

            {/* Valeur actuelle + variation sur la période */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 40,
                  fontWeight: 600,
                  letterSpacing: -1.4,
                  lineHeight: 1,
                  color: 'var(--ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {liveCurrent != null ? fmtKg(liveCurrent) : '—'}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--subtle)' }}>
                kg
              </span>
              {stats && stats.variation !== 0 && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'var(--mono)',
                    color: 'var(--muted)',
                  }}
                >
                  {stats.variation > 0 ? '▲ +' : '▼ −'}
                  {fmtKg(Math.abs(stats.variation))} kg
                </span>
              )}
            </div>

            {/* Sélecteur de période */}
            <RangeSwitch value={range} onChange={setRange} />

            {/* Courbe */}
            <div style={{ marginTop: 14 }}>
              {loading ? (
                <SkeletonChart height={120} />
              ) : (
                <WeightChart points={points} height={120} />
              )}
            </div>

            {/* Stats min / max / moyenne */}
            {stats && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 8,
                  marginTop: 14,
                }}
              >
                <Stat label="Min" value={`${fmtKg(stats.min)} kg`} />
                <Stat label="Max" value={`${fmtKg(stats.max)} kg`} />
                <Stat label="Moyenne" value={`${fmtKg(stats.avg)} kg`} />
              </div>
            )}

            {/* Saisie rapide */}
            <div style={{ marginTop: 16 }}>
              <AnimatePresence mode="wait" initial={false}>
                {entryOpen ? (
                  <motion.div
                    key="entry"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        padding: 16,
                        borderRadius: 14,
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
                            <span
                              style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)' }}
                            >
                              {fmtKg(weight)} kg — noté&nbsp;!
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--ink-2)',
                          marginBottom: 12,
                          fontWeight: 600,
                        }}
                      >
                        Pesée du jour
                      </div>
                      <WeightDial value={weight} onChange={setWeight} />
                      <button
                        onClick={save}
                        disabled={saving}
                        style={{
                          width: '100%',
                          marginTop: 12,
                          appearance: 'none',
                          border: 'none',
                          borderRadius: 12,
                          cursor: saving ? 'default' : 'pointer',
                          background: 'var(--brand)',
                          color: 'var(--brand-ink)',
                          fontSize: 14,
                          fontWeight: 700,
                          fontFamily: 'var(--font)',
                          height: 46,
                          opacity: saving ? 0.7 : 1,
                        }}
                      >
                        {saving ? 'Enregistrement…' : 'Valider ma pesée'}
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    key="add-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setEntryOpen(true)}
                    style={{
                      width: '100%',
                      appearance: 'none',
                      cursor: 'pointer',
                      borderRadius: 12,
                      border: 'none',
                      background: 'var(--surface-2)',
                      color: 'var(--ink-2)',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: 'var(--font)',
                      height: 46,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 0 0 1px var(--line) inset',
                    }}
                  >
                    <Plus size={15} />
                    Noter une pesée
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Historique complet */}
            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--muted)',
                  fontWeight: 600,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  paddingLeft: 2,
                }}
              >
                Historique{history.length > 0 ? ` · ${history.length}` : ''}
              </div>
              <Card glass={false} style={{ padding: 0, overflow: 'hidden' }}>
                {history.length === 0 ? (
                  <div
                    style={{
                      padding: '18px 14px',
                      textAlign: 'center',
                      fontSize: 12,
                      color: 'var(--muted)',
                      fontFamily: 'var(--mono)',
                    }}
                  >
                    Aucune pesée enregistrée.
                  </div>
                ) : (
                  history.map((h, i) => (
                    <div
                      key={h.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '11px 14px',
                        borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color: 'var(--ink)',
                          fontWeight: 500,
                          fontFamily: 'var(--mono)',
                        }}
                      >
                        {formatDate(h.date)}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--ink)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {fmtKg(h.poidsKg)} kg
                      </div>
                      <div
                        style={{
                          minWidth: 58,
                          textAlign: 'right',
                          fontFamily: 'var(--mono)',
                          fontSize: 11,
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          color:
                            h.delta == null || h.delta === 0
                              ? 'var(--subtle)'
                              : 'var(--muted)',
                        }}
                      >
                        {h.delta == null
                          ? '—'
                          : h.delta === 0
                            ? '='
                            : `${h.delta > 0 ? '+' : '−'}${fmtKg(Math.abs(h.delta))}`}
                      </div>
                    </div>
                  ))
                )}
              </Card>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(sheet, document.body)
}

function RangeSwitch({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Période du suivi"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 4,
        padding: 4,
        background: 'var(--surface-2)',
        borderRadius: 12,
        boxShadow: '0 0 0 1px var(--line) inset',
      }}
    >
      {RANGES.map((r) => {
        const active = value === r.id
        return (
          <button
            key={r.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(r.id)}
            style={{
              position: 'relative',
              height: 32,
              border: 'none',
              borderRadius: 8,
              background: 'transparent',
              color: active ? 'var(--ink)' : 'var(--muted)',
              fontWeight: 600,
              fontSize: 12,
              fontFamily: 'var(--font)',
              letterSpacing: -0.1,
              cursor: 'pointer',
            }}
          >
            {active && (
              <motion.span
                layoutId="weight-range-pill"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 8,
                  background: 'var(--surface)',
                  boxShadow: '0 0 0 1px var(--line) inset',
                  zIndex: 0,
                }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>{r.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--surface-2)',
        borderRadius: 10,
        boxShadow: '0 0 0 1px var(--line) inset',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: 'var(--muted)',
          fontWeight: 500,
          letterSpacing: 0.2,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: -0.4,
          marginTop: 2,
          color: 'var(--ink)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  )
}
