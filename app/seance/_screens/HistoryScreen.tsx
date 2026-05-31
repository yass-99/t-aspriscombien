'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { NavFn, Run } from '../_lib/types'
import { WORKOUT_TYPES } from '../_lib/constants'
import { Card, ConfirmDialog, IconButton, TopBar } from '../_components/primitives'
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Plus,
  Timer,
  Trash,
} from '../_components/icons'
import { useToast } from '../../_components/Toast'
import { formatChrono, groupRunsIntoSessions } from '../_lib/runs'
import { Skeleton, SkeletonHistoryRow } from '../_components/Skeleton'
import { useSeancesSummary, type SeanceSummary } from '../_lib/useSeancesSummary'
import { useRuns, invalidateRuns } from '../_lib/useRuns'
import { invalidateHomeDashboard } from '../_lib/useHomeDashboard'
import { invalidateAfterSeanceMutation } from '../_lib/invalidate'

type Props = { nav: NavFn }

type SeanceListItem = SeanceSummary

type AthleticsListItem = {
  kind: 'athletics'
  id: string
  date: string
  startedAt: string
  endedAt: string
  runs: Run[]
  runIds: string[]
}

type SeanceEntry = SeanceListItem & { kind: 'seance' }

type HistoryEntry = SeanceEntry | AthleticsListItem

const fmt = (n: number) => n.toLocaleString('fr-FR')

export function HistoryScreen({ nav }: Props) {
  // Caches SWR partagés : la liste résumée et les runs ne sont refetchés que si
  // le cache est périmé (TTL 3 min) ou invalidé après une mutation.
  const { data: seances, loading: sLoading } = useSeancesSummary()
  const { runs: runsData, loading: rLoading } = useRuns()
  const runs = runsData
  const loading = sLoading || rLoading

  const [pendingDelete, setPendingDelete] = useState<HistoryEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    try {
      if (pendingDelete.kind === 'seance') {
        const res = await fetch(`/api/seances/${pendingDelete.id}`, { method: 'DELETE' })
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          throw new Error(e.error ?? `Erreur ${res.status}`)
        }
        // Supprimer une séance impacte l'historique, l'accueil, les stats et les exos.
        invalidateAfterSeanceMutation()
      } else {
        // Session athlé = N runs : on les supprime un par un.
        for (const runId of pendingDelete.runIds) {
          const res = await fetch(`/api/runs/${runId}`, { method: 'DELETE' })
          if (!res.ok) {
            const e = await res.json().catch(() => ({}))
            throw new Error(e.error ?? `Erreur ${res.status}`)
          }
        }
        invalidateRuns()
        invalidateHomeDashboard()
      }
      toast.ok('Séance supprimée.')
      setPendingDelete(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur suppression')
    } finally {
      setDeleting(false)
    }
  }

  const entries = useMemo<HistoryEntry[]>(() => {
    const list: HistoryEntry[] = []
    for (const s of seances ?? []) list.push({ kind: 'seance', ...s })
    const athleticsSessions = groupRunsIntoSessions(runs ?? [])
    for (const a of athleticsSessions) {
      list.push({
        kind: 'athletics',
        id: a.id,
        date: a.date,
        startedAt: a.startedAt,
        endedAt: a.endedAt,
        runs: a.runs,
        runIds: a.runs.map((r) => r.id),
      })
    }
    list.sort((a, b) => {
      // Tri par date desc, puis startedAt desc pour athletics
      if (a.date !== b.date) return a.date < b.date ? 1 : -1
      const aTs = a.kind === 'athletics' ? a.startedAt : a.date + 'T00:00:00'
      const bTs = b.kind === 'athletics' ? b.startedAt : b.date + 'T00:00:00'
      return aTs < bTs ? 1 : -1
    })
    return list
  }, [seances, runs])

  const totalCount = entries.length
  const seancesCount = seances?.length ?? 0
  const athleticsCount = entries.filter((e) => e.kind === 'athletics').length

  // Rendu progressif : on n'affiche que les `visibleCount` entrées les plus
  // récentes et on en révèle PAGE de plus dès qu'un capteur arrive en bas. La
  // liste résumée est déjà chargée en un appel léger (cf P1) → aucun appel DB
  // supplémentaire au scroll, juste du rendu.
  const PAGE = 15
  const [visibleCount, setVisibleCount] = useState(PAGE)
  const hasMore = visibleCount < totalCount

  const visibleEntries = useMemo(() => entries.slice(0, visibleCount), [entries, visibleCount])
  const grouped = useMemo(() => groupByMonth(visibleEntries), [visibleEntries])

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!hasMore) return
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (obs) => {
        if (obs[0]?.isIntersecting) setVisibleCount((c) => c + PAGE)
      },
      { rootMargin: '300px' }, // précharge avant d'atteindre le tout dernier pixel
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore])

  return (
    <div
      className="app-scroll"
      style={{ minHeight: '100%', background: 'transparent', position: 'relative' }}
    >
      {/* Halo violet propre à l'historique : il défile AVEC la liste (l'ambient
          global est fixé au viewport et s'efface dès qu'on scrolle). C'est cette
          matière que le verre dépoli des lignes vient réfracter. cf. DESIGN §4. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(68% 22% at 50% 0%, color-mix(in oklch, var(--brand) 22%, transparent) 0%, transparent 70%), radial-gradient(54% 16% at 10% 26%, color-mix(in oklch, var(--brand) 15%, transparent) 0%, transparent 72%), radial-gradient(56% 17% at 92% 54%, color-mix(in oklch, var(--brand-deep, var(--brand)) 17%, transparent) 0%, transparent 72%), radial-gradient(58% 18% at 26% 84%, color-mix(in oklch, var(--brand) 12%, transparent) 0%, transparent 74%)',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
      <TopBar
        leading={
          <IconButton icon={<ChevronLeft size={18} />} label="retour" onClick={() => nav('idle')} />
        }
        title="Historique"
        subtitle={
          loading
            ? '…'
            : athleticsCount > 0
              ? `${seancesCount} muscu · ${athleticsCount} athlé`
              : `${totalCount} séance${totalCount > 1 ? 's' : ''}`
        }
       
      />

      <div style={{ padding: '4px 20px 30px' }}>
        <button
          onClick={() => nav('manual_entry', { seanceId: null })}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            height: 50,
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            fontWeight: 700,
            fontSize: 14,
            fontFamily: 'var(--font)',
            letterSpacing: -0.1,
            boxShadow: '0 10px 24px -10px color-mix(in oklch, var(--brand) 50%, transparent)',
            marginTop: 10,
            marginBottom: 22,
          }}
        >
          <Plus size={16} stroke={2.4} />
          Nouvelle séance manuelle
        </button>

        {/* Chargement : silhouettes de lignes (chrome de la liste déjà en place),
            puis les vraies séances se substituent en cinématique (cf. MonthGroup). */}
        {loading && (
          <div>
            <Skeleton width={96} height={11} style={{ marginBottom: 8, marginLeft: 2 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonHistoryRow key={i} />
              ))}
            </div>
          </div>
        )}

        {!loading && totalCount === 0 && (
          <Card style={{ padding: 22 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}>
              Aucune séance enregistrée.
              <br />
              <span style={{ color: 'var(--brand-bright)', fontWeight: 600 }}>
                Lance ta première séance ou ajoute-en une manuellement.
              </span>
            </div>
          </Card>
        )}

        {grouped.map((g, gi) => (
          <MonthGroup
            key={g.key}
            group={g}
            index={gi}
            nav={nav}

            onRequestDelete={setPendingDelete}
          />
        ))}

        {/* Capteur de fin de liste : déclenche le chargement de la tranche
            suivante. Une silhouette signale qu'il reste des séances à venir. */}
        {hasMore && (
          <div ref={sentinelRef} style={{ marginTop: 8 }}>
            <SkeletonHistoryRow />
          </div>
        )}
      </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Supprimer cette séance ?"
        message={
          pendingDelete?.kind === 'athletics'
            ? `Cette séance contient ${pendingDelete.runs.length} chrono${pendingDelete.runs.length > 1 ? 's' : ''}. La suppression est définitive.`
            : 'La suppression est définitive et retire tous les exercices et séries associés.'
        }
        confirmLabel="Supprimer"
        busyLabel="Suppression…"
        tone="danger"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleting) setPendingDelete(null)
        }}
      />
    </div>
  )
}



function MonthGroup({
  group,
  index,
  nav,

  onRequestDelete,
}: {
  group: { key: string; label: string; items: HistoryEntry[] }
  index: number
  nav: NavFn

  onRequestDelete: (entry: HistoryEntry) => void
}) {
  const reduced = useReducedMotion()
  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduced ? 0 : index * 0.04, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      style={{ marginBottom: 22 }}
    >
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
        {group.label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {group.items.map((entry, i) =>
          entry.kind === 'athletics' ? (
            <AthleticsRow
              key={entry.id}
              session={entry}
              index={i}
              nav={nav}

              onDelete={() => onRequestDelete(entry)}
            />
          ) : (
            <SeanceRow
              key={entry.id}
              seance={entry}
              index={i}
              nav={nav}

              onDelete={() => onRequestDelete(entry)}
            />
          ),
        )}
      </div>
    </motion.section>
  )
}

function DeleteAction({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Supprimer"
      style={{
        appearance: 'none',
        width: 34,
        height: 34,
        borderRadius: 9,
        border: 'none',
        cursor: 'pointer',
        background: hover
          ? 'color-mix(in oklch, var(--danger) 18%, var(--surface))'
          : 'var(--surface)',
        color: 'var(--danger)',
        boxShadow: '0 0 0 1px color-mix(in oklch, var(--danger) 28%, var(--line)) inset',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 140ms',
        flexShrink: 0,
      }}
    >
      <Trash size={15} />
    </button>
  )
}

function SeanceRow({
  seance,
  index,
  nav,

  onDelete,
}: {
  seance: SeanceEntry
  index: number
  nav: NavFn

  onDelete: () => void
}) {
  const reduced = useReducedMotion()
  const type = WORKOUT_TYPES.find((t) => t.id === seance.type)
  return (
    <motion.button
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduced ? 0 : 0.04 + index * 0.03, duration: 0.28 }}
      whileTap={ { scale: 0.985 }}
      onClick={ () => nav('session_detail', { seanceId: seance.id })
      }
      style={{
        appearance: 'none',
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 14px 14px 17px',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        // Verre dépoli : floute les halos violets du fond (DESIGN §4) plutôt
        // qu'un --surface plat. Highlight haut + ring glass pour l'élévation.
        background: 'var(--glass-strong)',
        backdropFilter: 'blur(22px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
        boxShadow: '0 0 0 1px var(--glass-border) inset, 0 1px 0 0 var(--glass-highlight) inset',
        cursor: 'default',
        fontFamily: 'var(--font)',
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 11,
          // Pas de tuile teintée : l'icône seule, en couleur, posée sur le fond.
          background: 'transparent',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Dumbbell size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: -0.2 }}>
          {type?.label ?? seance.type}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
          {formatRowDate(seance.date)} · {seance.exosCount} exercice
          {seance.exosCount > 1 ? 's' : ''} · {fmt(seance.volume)} kg
        </div>
      </div>

    </motion.button>
  )
}

function AthleticsRow({
  session,
  index,
  nav,

  onDelete,
}: {
  session: AthleticsListItem
  index: number
  nav: NavFn

  onDelete: () => void
}) {
  const reduced = useReducedMotion()
  const runCount = session.runs.length
  const best = session.runs.reduce<Run | null>(
    (b, r) => (!b || r.duration_ms < b.duration_ms ? r : b),
    null,
  )
  return (
    <motion.button
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduced ? 0 : 0.04 + index * 0.03, duration: 0.28 }}
      whileTap={reduced ? undefined : { scale: 0.985 }}
      onClick={() => nav('athletics_detail', { athleticsRunIds: session.runIds })
      }
      style={{
        appearance: 'none',
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 14px 14px 17px',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        // Verre dépoli : floute les halos violets du fond (DESIGN §4) plutôt
        // qu'un --surface plat. Highlight haut + ring glass pour l'élévation.
        background: 'var(--glass-strong)',
        backdropFilter: 'blur(22px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
        boxShadow: '0 0 0 1px var(--glass-border) inset, 0 1px 0 0 var(--glass-highlight) inset',
        cursor: 'default',
        fontFamily: 'var(--font)',
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 11,
          // Pas de tuile teintée : l'icône seule, en couleur, posée sur le fond.
          background: 'transparent',
          color: 'var(--warn)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Timer size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: -0.2 }}>
          Sprint
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
          {formatRowDate(session.date)} · {runCount} sprint{runCount > 1 ? 's' : ''}
          {best ? ` · top ${formatChrono(best.duration_ms)}` : ''}
        </div>
      </div>

    </motion.button>
  )
}

function groupByMonth(entries: HistoryEntry[]) {
  const map = new Map<string, { key: string; label: string; items: HistoryEntry[] }>()
  for (const s of entries) {
    const d = new Date(s.date + 'T00:00:00')
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
      .format(d)
      .replace(/^./, (c) => c.toUpperCase())
    const cur = map.get(key) ?? { key, label, items: [] }
    cur.items.push(s)
    map.set(key, cur)
  }
  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1))
}

function formatRowDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(d)
    .replace('.', '')
}
