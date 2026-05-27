'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { NavFn } from '../_lib/types'
import { WORKOUT_TYPES } from '../_lib/constants'
import { formatMMSS } from '../_lib/helpers'
import { Button, Card, IconButton, TopBar } from '../_components/primitives'
import { ChevronLeft, Copy, Trash } from '../_components/icons'
import { formatSeanceAsText } from '../_lib/helpers'
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
type Exo = { id: string; nom: string; series: Serie[] }
type Seance = {
  id: string
  date: string
  type: string
  restTargetSec: number
  exos: Exo[]
}

const fmt = (n: number) => n.toLocaleString('fr-FR')

export function SessionDetailScreen({ seanceId, nav }: Props) {
  const [seance, setSeance] = useState<Seance | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()

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
    const text = formatSeanceAsText(seance)
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
      toast.ok('Séance copiée.')
    } catch {
      toast.warn('Copie impossible.')
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
  const totalVolume = seance?.exos.reduce(
    (a, e) => a + e.series.reduce((b, s) => b + s.poids * s.reps, 0),
    0,
  ) ?? 0

  return (
    <div className="app-scroll" style={{ minHeight: '100%', background: 'var(--bg)' }}>
      <TopBar
        leading={
          <IconButton
            icon={<ChevronLeft size={18} />}
            label="retour"
            onClick={() => nav('history')}
          />
        }
        title={seance ? formatHeader(seance.date) : 'Séance'}
        subtitle={seance ? `${type?.label ?? seance.type} · ${totalSeries} séries · ${fmt(totalVolume)} kg` : '…'}
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
        <div style={{ padding: '4px 20px 110px' }}>
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: '10px 0 16px',
              alignItems: 'stretch',
            }}
          >
            <Button
              variant="secondary"
              size="md"
              full
              onClick={() => nav('manual_entry', { seanceId: seance.id })}
            >
              Modifier
            </Button>
            <SquareIconButton
              icon={<Copy size={17} />}
              label="Copier la séance"
              onClick={handleCopy}
            />
            <SquareIconButton
              icon={<Trash size={17} />}
              label="Supprimer la séance"
              tone="danger"
              onClick={() => setConfirmDelete(true)}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              marginBottom: 12,
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
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {seance.exos.map((exo, i) => (
              <ExoBlock key={exo.id} exo={exo} index={i} />
            ))}
          </div>
        </div>
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

function SquareIconButton({
  icon,
  onClick,
  label,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  onClick: () => void
  label: string
  tone?: 'neutral' | 'danger'
}) {
  const [hover, setHover] = useState(false)
  const isDanger = tone === 'danger'
  const color = isDanger ? 'var(--danger)' : 'var(--ink)'
  const ring = isDanger
    ? 'color-mix(in oklch, var(--danger) 28%, var(--line))'
    : 'var(--line)'
  const hoverBg = isDanger
    ? 'color-mix(in oklch, var(--danger) 14%, var(--surface))'
    : 'var(--surface-2)'
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        background: hover ? hoverBg : 'var(--surface)',
        color,
        boxShadow: `0 0 0 1px ${ring} inset`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 140ms',
      }}
    >
      {icon}
    </button>
  )
}

function ExoBlock({ exo, index }: { exo: Exo; index: number }) {
  const reduced = useReducedMotion()
  const volume = exo.series.reduce((a, s) => a + s.poids * s.reps, 0)
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduced ? 0 : 0.04 + index * 0.04, duration: 0.3 }}
    >
      <Card style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{exo.nom}</span>
          <span
            style={{
              flex: 1,
              fontSize: 11,
              color: 'var(--subtle)',
              fontFamily: 'var(--mono)',
              textAlign: 'right',
            }}
          >
            {exo.series.length} séries · {fmt(volume)} kg
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                {fmtPoids(s.poids)} kg × {s.reps}
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

function fmtPoids(n: number): string {
  return (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace('.', ',')
}
