'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { NavFn } from '../_lib/types'
import { WORKOUT_TYPES } from '../_lib/constants'
import { formatMMSS } from '../_lib/helpers'
import { Button, Card, IconButton, Pill, TopBar } from '../_components/primitives'
import { Check, ChevronDown, ChevronLeft, Copy, Dumbbell, Trash } from '../_components/icons'
import { fmtChargeLabel, formatSeanceAsText } from '../_lib/helpers'
import { invalidateAfterSeanceMutation } from '../_lib/invalidate'
import { useProfileHeader } from '../_lib/useProfileHeader'
import { useToast } from '../../_components/Toast'

type Props = {
  seanceId: string | null
  nav: NavFn
}

type Serie = {
  id: string
  poids: number
  reps: number
  rir: number
  degressive: boolean
}
type Exo = {
  id: string
  nom: string
  isBodyweight?: boolean
  isUnilateral?: boolean
  series: Serie[]
}
type Seance = {
  id: string
  date: string
  type: string
  restTargetSec: number
  exos: Exo[]
}

const fmt = (n: number) => n.toLocaleString('fr-FR')

export function SessionDetailScreen({ seanceId, nav }: Props) {
  const reduced = useReducedMotion()
  const [seance, setSeance] = useState<Seance | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const toast = useToast()
  const profileHeader = useProfileHeader()

  useEffect(() => {
    if (!seanceId) {
      setLoading(false)
      return
    }
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/seances/${seanceId}`)
        if (cancelled) return
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          toast.error(e.error ?? `Erreur ${res.status}`)
        } else {
          const d = (await res.json()) as { seance: Seance }
          setSeance(d.seance)
        }
      } catch (e) {
        if (!cancelled) toast.warn(e instanceof Error ? e.message : 'Erreur réseau')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [seanceId, toast])

  const handleCopy = async () => {
    if (!seance) return
    const text = formatSeanceAsText(seance, profileHeader)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopyStatus('copied')
      toast.ok('Séance copiée.')
      window.setTimeout(() => setCopyStatus('idle'), 2200)
    } catch {
      setCopyStatus('error')
      toast.warn('Copie impossible.')
      window.setTimeout(() => setCopyStatus('idle'), 2200)
    }
  }

  const handleDelete = async () => {
    if (!seanceId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/seances/${seanceId}`, { method: 'DELETE' })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error ?? `Erreur ${res.status}`)
        setDeleting(false)
        setConfirmDelete(false)
        return
      }
      invalidateAfterSeanceMutation()
      toast.ok('Séance supprimée.')
      nav('history')
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : 'Erreur réseau')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const type = seance ? WORKOUT_TYPES.find((t) => t.id === seance.type) : null
  const totalSeries = seance?.exos.reduce((a, e) => a + e.series.length, 0) ?? 0
  const totalVolume =
    seance?.exos.reduce(
      (a, e) => a + e.series.reduce((b, s) => b + s.poids * s.reps, 0),
      0,
    ) ?? 0

  // Apparition en cascade : on indexe les blocs pour décaler leur entrée.
  const enter = (i: number) =>
    reduced
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const, delay: 0.04 + i * 0.05 },
        }

  return (
    <div className="app-scroll" style={{ minHeight: '100%', background: 'transparent' }}>
      <TopBar
        leading={
          <IconButton
            icon={<ChevronLeft size={18} />}
            label="retour"
            onClick={() => nav('history')}
          />
        }
        title={seance ? formatHeader(seance.date) : 'Séance'}
        subtitle={
          seance
            ? `${type?.label ?? seance.type} · ${totalSeries} séries · ${fmt(totalVolume)} kg`
            : '…'
        }
      />

      {loading && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Chargement…
        </div>
      )}

      {!loading && !seance && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Séance introuvable.
        </div>
      )}

      {seance && (
        <>
        <div style={{ padding: '4px 16px 168px' }}>
          {/* Hero */}
          <motion.div
            {...enter(0)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Dumbbell size={22} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: -0.9,
                  margin: '0 0 2px',
                  fontFamily: 'var(--display)',
                }}
              >
                {type?.label ?? seance.type}
                <span style={{ color: 'var(--accent)' }}>.</span>
              </h2>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
                {formatLongDate(seance.date)}
              </p>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div {...enter(1)}>
            <Card style={{ padding: 14, marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Exos', value: String(seance.exos.length), suffix: '' },
                  { label: 'Séries', value: String(totalSeries), suffix: '' },
                  { label: 'Volume', value: fmt(totalVolume), suffix: 'kg' },
                ].map((s) => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--muted)',
                        fontWeight: 600,
                        letterSpacing: 0.3,
                        textTransform: 'uppercase',
                      }}
                    >
                      {s.label}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 20,
                        fontWeight: 600,
                        letterSpacing: -0.6,
                        marginTop: 4,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {s.value}
                      {s.suffix && (
                        <span style={{ fontSize: 11, color: 'var(--subtle)', marginLeft: 2 }}>
                          {s.suffix}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Repos cible */}
          <motion.div
            {...enter(2)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              marginBottom: 16,
              background: 'var(--surface)',
              borderRadius: 10,
              boxShadow: '0 0 0 1px var(--line) inset',
              fontSize: 12,
              color: 'var(--muted)',
            }}
          >
            <span style={{ fontFamily: 'var(--mono)' }}>Repos cible</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-2)', fontWeight: 600 }}>
              {formatMMSS(seance.restTargetSec)}
            </span>
          </motion.div>

          {/* Détail */}
          <motion.div
            {...enter(3)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 2px 8px',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                fontWeight: 600,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              Détail
            </span>
            <span style={{ fontSize: 11, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>
              tape pour déplier
            </span>
          </motion.div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            {seance.exos.map((exo, i) => (
              <ExoCard key={exo.id} exo={exo} index={i} enter={enter(4 + i)} />
            ))}
          </div>

        </div>

        {/* Barre d'actions collée en bas du viewport. Portalisée sur <body> :
            le will-change:transform du StepSwitcher capture position:fixed et
            calerait sinon la barre en bas du CONTENU, pas du viewport. */}
        {createPortal(
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 30,
            padding: '14px 16px max(22px, env(safe-area-inset-bottom))',
            background: 'linear-gradient(180deg, transparent, var(--bg) 35%)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              maxWidth: 480,
              margin: '0 auto',
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <Button size="lg" full onClick={() => nav('manual_entry', { seanceId: seance.id })}>
              Modifier la séance
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleCopy}
                aria-label={
                  copyStatus === 'copied'
                    ? 'Copié'
                    : copyStatus === 'error'
                      ? 'Impossible de copier'
                      : 'Copier la séance pour LLM (markdown)'
                }
                title={
                  copyStatus === 'copied'
                    ? 'Copié dans le presse-papier'
                    : 'Copier pour LLM (markdown)'
                }
                style={{
                  flex: 1,
                  height: 48,
                  appearance: 'none',
                  border: 'none',
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: copyStatus === 'copied' ? 'var(--accent-soft)' : 'var(--surface)',
                  color: copyStatus === 'copied' ? 'var(--accent)' : 'var(--ink-2)',
                  boxShadow:
                    copyStatus === 'copied'
                      ? '0 0 0 1px var(--accent-line) inset'
                      : '0 0 0 1px var(--line) inset',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font)',
                  transition: 'all 160ms ease',
                }}
              >
                {copyStatus === 'copied' ? <Check size={17} stroke={2.4} /> : <Copy size={17} />}
                {copyStatus === 'copied' ? 'Copié' : 'Copier'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label="Supprimer la séance"
                title="Supprimer la séance"
                style={{
                  width: 48,
                  height: 48,
                  flexShrink: 0,
                  appearance: 'none',
                  border: 'none',
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: 'var(--surface)',
                  color: 'var(--danger)',
                  boxShadow:
                    '0 0 0 1px color-mix(in oklch, var(--danger) 28%, var(--line)) inset',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 160ms ease',
                }}
              >
                <Trash size={17} />
              </button>
            </div>
          </div>
        </div>,
          document.body,
        )}
        </>
      )}

      <AnimatePresence>
        {confirmDelete && (
          <DeleteConfirm
            onCancel={() => setConfirmDelete(false)}
            onConfirm={handleDelete}
            busy={deleting}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ExoCard({
  exo,
  index,
  enter,
}: {
  exo: Exo
  index: number
  enter: Record<string, unknown>
}) {
  const [expanded, setExpanded] = useState(false)
  const volume = exo.series.reduce((a, s) => a + s.poids * s.reps, 0)
  const topSet = exo.series.reduce<Serie | null>(
    (best, s) => (!best || s.poids > best.poids ? s : best),
    null,
  )
  const key = `exo-body-${exo.id}`

  return (
    <motion.div {...enter}>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={key}
          style={{
            width: '100%',
            appearance: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            background: 'var(--line-2)',
            color: 'inherit',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              background: 'var(--surface)',
              color: 'var(--ink-2)',
              boxShadow: '0 0 0 1px var(--line) inset',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {index + 1}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {exo.nom}
              </span>
              {exo.isBodyweight && <Pill tone="accent">PDC</Pill>}
              {exo.isUnilateral && <Pill tone="neutral">uni</Pill>}
            </div>
            {!expanded && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--muted)',
                  fontFamily: 'var(--mono)',
                  marginTop: 2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {exo.series.length} série{exo.series.length > 1 ? 's' : ''}
                {topSet && (
                  <>
                    <span style={{ color: 'var(--subtle)' }}> · top </span>
                    {fmtChargeLabel(topSet.poids, exo.isBodyweight)}×{topSet.reps}
                    <span style={{ color: 'var(--subtle)' }}> · vol </span>
                    {fmt(volume)}kg
                  </>
                )}
              </div>
            )}
          </div>
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              color: 'var(--muted)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 200ms ease',
              flexShrink: 0,
            }}
          >
            <ChevronDown size={16} />
          </span>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              id={key}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '4px 14px 10px' }}>
                {exo.series.map((s, i) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 10,
                      padding: '6px 0',
                      borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
                      fontFamily: 'var(--mono)',
                      fontSize: 12,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span style={{ width: 18, color: 'var(--subtle)' }}>{i + 1}.</span>
                    <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
                      {fmtChargeLabel(s.poids, exo.isBodyweight)} × {s.reps}
                    </span>
                    <span style={{ color: 'var(--muted)' }}>RIR {s.rir}</span>
                    {s.degressive && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'var(--accent-soft)',
                          color: 'var(--accent)',
                          fontFamily: 'var(--font)',
                        }}
                      >
                        dégr
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}

function DeleteConfirm({
  onCancel,
  onConfirm,
  busy,
}: {
  onCancel: () => void
  onConfirm: () => void
  busy: boolean
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  if (!mounted) return null

  const sheet = (
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
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        style={{
          width: '100%',
          maxWidth: 448,
          padding: 20,
          borderRadius: 16,
          background: 'var(--surface)',
          boxShadow: '0 0 0 1px var(--line) inset, 0 22px 60px -22px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--ink)',
            letterSpacing: -0.3,
            marginBottom: 6,
            fontFamily: 'var(--display)',
          }}
        >
          Supprimer cette séance ?
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 18 }}>
          Action irréversible. La séance et toutes ses séries seront supprimées.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="md" full disabled={busy} onClick={onCancel}>
            Annuler
          </Button>
          <Button variant="danger" size="md" full disabled={busy} onClick={onConfirm}>
            {busy ? 'Suppression…' : 'Supprimer'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )

  return createPortal(sheet, document.body)
}

function formatHeader(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(d)
    .replace('.', '')
}

function formatLongDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .format(d)
    .replace(/^./, (c) => c.toUpperCase())
}
