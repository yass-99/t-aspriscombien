'use client'

import { useEffect, useMemo, useState } from 'react'
import type { NavFn, Run } from '../_lib/types'
import {
  computeSessionRunsWithPR,
  formatAthleticsSessionAsText,
  formatChrono,
  formatPct,
  formatRunTime,
  formatSessionDuration,
} from '../_lib/runs'
import { Button, Card, IconButton, Pill, TopBar } from '../_components/primitives'
import {
  Check,
  ChevronLeft,
  Copy,
  Flame,
  Plus,
  Timer,
} from '../_components/icons'
import { useToast } from '../../_components/Toast'
import { useProfileHeader } from '../_lib/useProfileHeader'

type Props = {
  // IDs des runs qui forment la séance. Si vide → fallback message + retour.
  runIds: string[]
  // Origine de la navigation, pour le bouton retour :
  //   - 'live' : on vient de terminer la séance depuis AthleticsScreen
  //   - 'history' : on consulte une séance passée depuis HistoryScreen
  origin?: 'live' | 'history'
  nav: NavFn
}

export function AthleticsSummaryScreen({ runIds, origin = 'live', nav }: Props) {
  const [allRuns, setAllRuns] = useState<Run[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
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

  // Méta-données de la séance.
  const meta = useMemo(() => {
    if (sessionRuns.length === 0) return null
    const sorted = [...sessionRuns].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    )
    return {
      date: sorted[0].date,
      startedAt: sorted[0].created_at,
      endedAt: sorted[sorted.length - 1].created_at,
    }
  }, [sessionRuns])

  // Stats agrégées.
  const stats = useMemo(() => {
    if (runsWithPR.length === 0) {
      return { count: 0, distances: 0, bestPct: null as number | null, newPRs: 0 }
    }
    const distances = new Set(runsWithPR.map((r) => r.run.distance_m))
    let bestPct: number | null = null
    let newPRs = 0
    for (const r of runsWithPR) {
      if (r.pctOfPR != null && (bestPct == null || r.pctOfPR > bestPct)) {
        bestPct = r.pctOfPR
      }
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

  const back = () => nav(origin === 'history' ? 'history' : 'idle')
  const newSession = () => nav('athletics')

  if (loading) {
    return (
      <div className="app-scroll" style={{ minHeight: '100%', background: 'transparent' }}>
        <TopBar
          leading={<IconButton icon={<ChevronLeft size={18} />} label="retour" onClick={back} />}
          title="Récap séance"
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
          title="Récap séance"
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

  return (
    <div className="app-scroll" style={{ minHeight: '100%', background: 'transparent' }}>
      <TopBar
        leading={<IconButton icon={<ChevronLeft size={18} />} label="retour" onClick={back} />}
        title="Séance athlétisme"
        subtitle={`${formatRunTime(meta.startedAt)} → ${formatRunTime(meta.endedAt)} · ${formatSessionDuration(meta.startedAt, meta.endedAt)}`}
      />

      <div style={{ padding: '4px 16px 30px', animation: 'fadeUp 360ms ease both' }}>
        {/* Hero */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'color-mix(in oklch, var(--warn) 14%, var(--bg))',
              color: 'var(--warn)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {stats.newPRs > 0 ? <Flame size={22} /> : <Timer size={22} />}
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
              {stats.newPRs > 0 ? (
                <>
                  Nouveau record<span style={{ color: 'var(--warn)' }}>.</span>
                </>
              ) : (
                <>
                  Belle séance<span style={{ color: 'var(--warn)' }}>.</span>
                </>
              )}
            </h2>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
              {stats.count} chrono{stats.count > 1 ? 's' : ''} · {stats.distances} distance
              {stats.distances > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Stats card */}
        <Card style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <StatCell label="Chronos" value={String(stats.count)} />
            <StatCell label="Durée" value={formatSessionDuration(meta.startedAt, meta.endedAt)} />
            <StatCell
              label="Meilleur %"
              value={stats.bestPct != null ? formatPct(stats.bestPct) : '—'}
              highlight={stats.bestPct != null && stats.bestPct >= 100}
            />
          </div>
        </Card>

        {/* Détail chrono par chrono */}
        <div
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
            Détail des chronos
          </span>
          <span style={{ fontSize: 11, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>
            % du PR
          </span>
        </div>

        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          {runsWithPR.map((rwp, i) => (
            <RunRow key={rwp.run.id} rwp={rwp} first={i === 0} />
          ))}
        </Card>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
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
                : copyStatus === 'error'
                  ? 'Impossible de copier'
                  : 'Copier pour LLM (markdown)'
            }
            style={{
              width: 52,
              height: 52,
              flexShrink: 0,
              appearance: 'none',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              background: copyStatus === 'copied' ? 'var(--accent-soft)' : 'var(--surface)',
              color: copyStatus === 'copied' ? 'var(--accent)' : 'var(--ink-2)',
              boxShadow:
                copyStatus === 'copied'
                  ? '0 0 0 1px var(--brand-line) inset'
                  : '0 0 0 1px var(--line) inset',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 160ms ease',
            }}
          >
            {copyStatus === 'copied' ? <Check size={18} stroke={2.4} /> : <Copy size={18} />}
          </button>
          <Button onClick={newSession} icon={<Plus size={16} />} style={{ flex: 1 }}>
            Nouvelle séance
          </Button>
        </div>
        <button
          type="button"
          onClick={() => nav('idle')}
          style={{
            appearance: 'none',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--muted)',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'var(--font)',
            padding: '8px 12px',
            width: '100%',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            textDecorationColor: 'var(--line)',
          }}
        >
          Retour au menu principal
        </button>
      </div>
    </div>
  )
}

function StatCell({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 10,
          color: 'var(--muted)',
          fontWeight: 600,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: -0.5,
          marginTop: 4,
          color: highlight ? 'var(--warn)' : 'var(--ink)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function RunRow({
  rwp,
  first,
}: {
  rwp: ReturnType<typeof computeSessionRunsWithPR>[number]
  first: boolean
}) {
  const { run, ref, pctOfPR, isNewPR } = rwp
  const time = formatRunTime(run.created_at)

  // Tonalité visuelle du % :
  //   ≥ 100 % → accent (PR battu)
  //   ≥ 95 %  → ok
  //   ≥ 85 %  → neutre
  //   < 85 %  → subtle
  const pctTone =
    pctOfPR == null
      ? 'subtle'
      : pctOfPR >= 100
        ? 'accent'
        : pctOfPR >= 95
          ? 'ok'
          : pctOfPR >= 85
            ? 'ink'
            : 'subtle'
  const pctColor = {
    accent: 'var(--warn)',
    ok: 'var(--ok)',
    ink: 'var(--ink-2)',
    subtle: 'var(--subtle)',
  }[pctTone]

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
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          background: isNewPR ? 'color-mix(in oklch, var(--warn) 14%, var(--bg))' : 'var(--surface-2)',
          color: isNewPR ? 'var(--warn)' : 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--mono)',
          fontWeight: 600,
          fontSize: 12,
          flexShrink: 0,
          letterSpacing: -0.3,
        }}
      >
        {isNewPR ? <Flame size={14} /> : `${run.distance_m}`}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            fontFamily: 'var(--mono)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--ink)',
            letterSpacing: -0.3,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>{formatChrono(run.duration_ms)}</span>
          {!isNewPR && (
            <span style={{ fontSize: 11, color: 'var(--subtle)', fontWeight: 500 }}>
              · {run.distance_m}m
            </span>
          )}
          {isNewPR && (
            <span style={{ fontSize: 10, color: 'var(--warn)', fontWeight: 700, letterSpacing: 0.4 }}>
              NEW PR · {run.distance_m}m
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--subtle)',
            marginTop: 2,
            fontFamily: 'var(--mono)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <span>{time}</span>
          {ref && ref.scaled && (
            <Pill tone="outline">extrapolé · PR {ref.sourceDistance}m</Pill>
          )}
          {pctOfPR == null && (
            <span style={{ fontStyle: 'italic' }}>1ʳᵉ fois sur cette distance</span>
          )}
        </div>
      </div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 14,
          fontWeight: 700,
          color: pctColor,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
          minWidth: 56,
          textAlign: 'right',
        }}
      >
        {formatPct(pctOfPR)}
      </div>
    </div>
  )
}
