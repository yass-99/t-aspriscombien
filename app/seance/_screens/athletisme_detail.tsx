'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { NavFn, Run } from '../_lib/types'
import {
  computeSessionRunsWithPR,
  formatAthleticsSessionAsText,
  formatChrono,
  formatPct,
  formatRunTime,
  formatSessionDuration,
  type RunWithPR,
} from '../_lib/runs'
import { Button, Card, IconButton, Pill, TopBar } from '../_components/primitives'
import { Check, ChevronLeft, Copy, Flame, Trash } from '../_components/icons'
import { useToast } from '../../_components/Toast'
import { useProfileHeader } from '../_lib/useProfileHeader'
import { invalidateRuns } from '../_lib/useRuns'
import { invalidateHomeDashboard } from '../_lib/useHomeDashboard'

type Props = {
  // IDs des runs qui forment la séance consultée depuis l'historique.
  runIds: string[]
  nav: NavFn
}

// Athlétisme = ambre (--warn). Le violet reste réservé au fond ambient.
const WARN_SOFT = 'color-mix(in oklch, var(--warn) 16%, var(--surface))'
const WARN_LINE = 'color-mix(in oklch, var(--warn) 38%, var(--surface))'

const fmtDist = (m: number) => `${m} m`

export function AthleticsDetailScreen({ runIds, nav }: Props) {
  const reduced = useReducedMotion()
  const [allRuns, setAllRuns] = useState<Run[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()
  const profileHeader = useProfileHeader()

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/runs', { cache: 'no-store' })
        if (cancelled) return
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          toast.error(e.error ?? `Erreur ${res.status}`)
          setAllRuns([])
        } else {
          const d = (await res.json()) as { runs: Run[] }
          setAllRuns(d.runs)
        }
      } catch (e) {
        if (!cancelled) toast.warn(e instanceof Error ? e.message : 'Erreur réseau')
        if (!cancelled) setAllRuns([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [toast])

  // Sépare : runs de la séance vs historique (le reste).
  // Le %PR ne doit pas se comparer à soi-même → on exclut la session courante.
  const { sessionRuns, historical } = useMemo(() => {
    const ids = new Set(runIds)
    const session: Run[] = []
    const hist: Run[] = []
    for (const r of allRuns ?? []) {
      if (ids.has(r.id)) session.push(r)
      else hist.push(r)
    }
    return { sessionRuns: session, historical: hist }
  }, [allRuns, runIds])

  const runsWithPR = useMemo(
    () => computeSessionRunsWithPR(sessionRuns, historical),
    [sessionRuns, historical],
  )

  const meta = useMemo(() => {
    if (sessionRuns.length === 0) return null
    const sorted = [...sessionRuns].sort((a, b) => a.created_at.localeCompare(b.created_at))
    return {
      date: sorted[0].date,
      startedAt: sorted[0].created_at,
      endedAt: sorted[sorted.length - 1].created_at,
    }
  }, [sessionRuns])

  const stats = useMemo(() => {
    const distances = new Set(runsWithPR.map((r) => r.run.distance_m))
    let bestPct: number | null = null
    let newPRs = 0
    for (const r of runsWithPR) {
      if (r.pctOfPR != null && (bestPct == null || r.pctOfPR > bestPct)) bestPct = r.pctOfPR
      if (r.isNewPR) newPRs++
    }
    return { count: runsWithPR.length, distances: distances.size, bestPct, newPRs }
  }, [runsWithPR])

  const handleCopy = async () => {
    if (!meta) return
    const text = formatAthleticsSessionAsText({
      date: meta.date,
      startedAt: meta.startedAt,
      endedAt: meta.endedAt,
      runsWithPR,
      profile: profileHeader,
    })
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
      window.setTimeout(() => setCopyStatus('idle'), 2200)
    } catch {
      setCopyStatus('error')
      window.setTimeout(() => setCopyStatus('idle'), 2200)
    }
  }

  const handleDelete = async () => {
    if (sessionRuns.length === 0) return
    setDeleting(true)
    try {
      // Une séance athlé = un lot de runs ; on les supprime tous.
      const results = await Promise.all(
        sessionRuns.map((r) =>
          fetch(`/api/runs/${r.id}`, { method: 'DELETE' }).then((res) => res.ok),
        ),
      )
      if (results.some((ok) => !ok)) {
        toast.error('Certains chronos n’ont pas pu être supprimés.')
        setDeleting(false)
        setConfirmDelete(false)
        return
      }
      // Purge les caches partagés sinon l'historique (useRuns caché) reconstruit
      // la séance fantôme depuis des runs périmés, et l'accueil garde le compte.
      invalidateRuns()
      invalidateHomeDashboard()
      toast.ok('Séance supprimée.')
      nav('history')
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : 'Erreur réseau')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const back = () => nav('history')

  const enter = (i: number) =>
    reduced
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const, delay: 0.04 + i * 0.05 },
        }

  if (loading) {
    return (
      <div className="app-scroll" style={{ minHeight: '100%', background: 'transparent' }}>
        <TopBar
          leading={<IconButton icon={<ChevronLeft size={18} />} label="retour" onClick={back} />}
          title="Séance athlétisme"
          subtitle="…"
        />
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Chargement…
        </div>
      </div>
    )
  }

  if (!meta || sessionRuns.length === 0) {
    return (
      <div className="app-scroll" style={{ minHeight: '100%', background: 'transparent' }}>
        <TopBar
          leading={<IconButton icon={<ChevronLeft size={18} />} label="retour" onClick={back} />}
          title="Séance athlétisme"
        />
        <div style={{ padding: '20px' }}>
          <Card style={{ padding: 22 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}>
              Aucun chrono pour cette séance.
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // Footer d'actions collé en bas du viewport. Portalisé sur <body> car les
  // écrans du flux séance sont enveloppés d'un wrapper `will-change: transform`
  // (StepSwitcher) qui « capture » position:fixed → sans portal, la barre se
  // calerait en bas du CONTENU, pas du viewport.
  const actionBar = (
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
      <div style={{ maxWidth: 480, margin: '0 auto', pointerEvents: 'auto', display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copyStatus === 'copied' ? 'Copié' : 'Copier la séance pour LLM (markdown)'}
          title={copyStatus === 'copied' ? 'Copié dans le presse-papier' : 'Copier pour LLM (markdown)'}
          style={{
            flex: 1,
            height: 48,
            appearance: 'none',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            background: copyStatus === 'copied' ? WARN_SOFT : 'var(--surface)',
            color: copyStatus === 'copied' ? 'var(--warn)' : 'var(--ink-2)',
            boxShadow:
              copyStatus === 'copied'
                ? `0 0 0 1px ${WARN_LINE} inset`
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
            boxShadow: '0 0 0 1px color-mix(in oklch, var(--danger) 28%, var(--line)) inset',
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
  )

  return (
    <div className="app-scroll" style={{ minHeight: '100%', background: 'transparent' }}>
      <TopBar
        leading={<IconButton icon={<ChevronLeft size={18} />} label="retour" onClick={back} />}
        title={formatHeader(meta.date)}
        subtitle={`${formatRunTime(meta.startedAt)} → ${formatRunTime(meta.endedAt)} · ${formatSessionDuration(meta.startedAt, meta.endedAt)}`}
      />

      <div style={{ padding: '4px 16px 116px' }}>
        {/* Hero stats */}
        <motion.div {...enter(0)} style={{ marginBottom: 16 }}>
          <Card style={{ padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
              <StatCell label="Chronos" value={String(stats.count)} />
              <StatCell label="Distances" value={String(stats.distances)} />
              <StatCell label="Best %PR" value={formatPct(stats.bestPct)} warn />
              <StatCell
                label="Records"
                value={stats.newPRs > 0 ? `${stats.newPRs} 🔥` : '—'}
                warn={stats.newPRs > 0}
              />
            </div>
          </Card>
        </motion.div>

        <motion.div
          {...enter(1)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}
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
            Détail des chronos
          </span>
          <span style={{ fontSize: 11, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>% du PR</span>
        </motion.div>

        <motion.div {...enter(2)}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {runsWithPR.map((rwp, i) => (
              <RunRow key={rwp.run.id} rwp={rwp} first={i === 0} index={i} />
            ))}
          </Card>
        </motion.div>
      </div>

      {createPortal(actionBar, document.body)}

      <AnimatePresence>
        {confirmDelete && (
          <DeleteConfirm
            count={sessionRuns.length}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={handleDelete}
            busy={deleting}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function StatCell({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 10,
          color: 'var(--muted)',
          fontWeight: 600,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: -0.4,
          fontVariantNumeric: 'tabular-nums',
          color: warn ? 'var(--warn)' : 'var(--ink)',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function RunRow({ rwp, first, index }: { rwp: RunWithPR; first: boolean; index: number }) {
  const { run, ref, pctOfPR, isNewPR } = rwp
  const pctColor =
    pctOfPR == null
      ? 'var(--subtle)'
      : pctOfPR >= 100
        ? 'var(--warn)'
        : pctOfPR >= 95
          ? 'var(--ink)'
          : 'var(--muted)'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        borderTop: first ? 'none' : '1px solid var(--line-2)',
      }}
    >
      <span style={{ width: 16, color: 'var(--subtle)', fontFamily: 'var(--mono)', fontSize: 12 }}>
        {index + 1}.
      </span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', minWidth: 52 }}>
        {fmtDist(run.distance_m)}
      </span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
        {formatChrono(run.duration_ms)}
      </span>
      {isNewPR && (
        <Pill tone="warn" icon={<Flame size={11} />}>
          PR
        </Pill>
      )}
      {ref?.scaled && !isNewPR && (
        <span style={{ fontSize: 10, color: 'var(--subtle)' }}>extrapolé</span>
      )}
      <span style={{ flex: 1 }} />
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 13,
          fontWeight: 600,
          color: pctColor,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatPct(pctOfPR)}
      </span>
    </div>
  )
}

function DeleteConfirm({
  count,
  onCancel,
  onConfirm,
  busy,
}: {
  count: number
  onCancel: () => void
  onConfirm: () => void
  busy: boolean
}) {
  // Lock body scroll while the sheet is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

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
        padding: 0,
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
          // Collé au bord bas : coins arrondis en haut seulement, safe-area gérée
          // par le padding bas interne (les boutons ne passent pas sous le home bar).
          padding: '20px 20px max(20px, env(safe-area-inset-bottom))',
          borderRadius: '16px 16px 0 0',
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
          Action irréversible. {count} chrono{count > 1 ? 's' : ''} seront supprimés.
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
