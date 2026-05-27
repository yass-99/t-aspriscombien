'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, animate, useReducedMotion } from 'motion/react'
import type { NavFn, SessionState } from '../_lib/types'
import {
  useDashboard,
  type DashboardData,
  type DistributionItem,
  type TopExo,
  type BlindSpot,
  type RecentPR,
  type Period,
} from '../_lib/useDashboard'
import { Card, IconButton, TopBar } from '../_components/primitives'
import { ChevronLeft, ChevronRight, Flame, Timer } from '../_components/icons'
import { BodyHeatmap } from '../_components/BodyHeatmap'
import { HorizontalCardScroll } from '../_components/HorizontalCardScroll'
import { useHeatmap } from '../_lib/useHeatmap'
import { useRuns } from '../_lib/useRuns'
import { formatChrono, formatRunDate } from '../_lib/runs'
import type { Run } from '../_lib/types'

type Props = {
  session: SessionState
  nav: NavFn
}

const PERIODS: { id: Period; label: string }[] = [
  { id: '7d', label: '7j' },
  { id: '30d', label: '30j' },
  { id: '90d', label: '90j' },
  { id: 'all', label: 'Tout' },
]

const TYPE_COLOR: Record<string, string> = {
  push: 'var(--accent)',
  pull: '#67E8F9',
  legs: '#FBBF24',
  full: '#A78BFA',
  upper: '#F472B6',
  core: 'var(--ink-2)',
}

const fmt = (n: number) => n.toLocaleString('fr-FR')

export function StatsScreen({ nav }: Props) {
  const [period, setPeriod] = useState<Period>('7d')
  const { data, loading } = useDashboard(period)
  const { data: heatmap, loading: heatmapLoading } = useHeatmap(period)
  const { runs, loading: runsLoading } = useRuns()
  const reduced = useReducedMotion()

  return (
    <div className="app-scroll" style={{ minHeight: '100%', background: 'var(--bg)' }}>
      <TopBar
        leading={
          <IconButton
            icon={<ChevronLeft size={18} />}
            label="retour"
            onClick={() => nav('idle')}
          />
        }
        title="Statistiques"
        subtitle={data ? `${data.hero.seances} séance${data.hero.seances > 1 ? 's' : ''} · ${period === 'all' ? 'tout' : `${PERIODS.find((p) => p.id === period)?.label}`}` : '…'}
      />

      <div style={{ padding: '4px 20px 30px' }}>
        <PeriodSwitch value={period} onChange={setPeriod} />

        <AnimatePresence mode="wait">
          <motion.div
            key={period}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Section index={0}>
              <Hero data={data} loading={loading} period={period} />
            </Section>

            <Section index={1}>
              <SectionTitle>Répartition</SectionTitle>
              <HorizontalCardScroll
                slides={[
                  {
                    id: 'heatmap',
                    label: 'Vue corporelle',
                    content: (
                      <BodyHeatmap
                        data={heatmap}
                        loading={heatmapLoading}
                        period={period}
                      />
                    ),
                  },
                  {
                    id: 'donut',
                    label: 'Par type de séance',
                    content: (
                      <DistributionCard
                        items={data?.distribution ?? []}
                        loading={loading}
                      />
                    ),
                  },
                ]}
              />
            </Section>

            <Section index={2}>
              <TopExosBlock items={data?.topExos ?? []} loading={loading} />
            </Section>

            <Section index={3}>
              <BlindSpotsBlock items={data?.blindSpots ?? []} loading={loading} />
            </Section>

            <Section index={4}>
              <RecentPrsBlock items={data?.recentPrs ?? []} loading={loading} />
            </Section>

            <Section index={5}>
              <SprintsBlock
                runs={runs}
                loading={runsLoading}
                onOpenAll={() => nav('athletics', { athleticsView: 'hub' })}
              />
            </Section>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ───────────────────────── Section wrapper ─────────────────────────
function Section({ index, children }: { index: number; children: React.ReactNode }) {
  const reduced = useReducedMotion()
  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: reduced ? 0 : 0.05 + index * 0.06,
        duration: 0.36,
        ease: [0.22, 1, 0.36, 1],
      }}
      style={{ marginTop: index === 0 ? 12 : 22 }}
    >
      {children}
    </motion.section>
  )
}

// ───────────────────────── Period switch ─────────────────────────
function PeriodSwitch({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Période"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 4,
        padding: 4,
        background: 'var(--surface)',
        borderRadius: 12,
        boxShadow: '0 0 0 1px var(--line) inset',
        marginTop: 10,
      }}
    >
      {PERIODS.map((p) => {
        const active = value === p.id
        return (
          <button
            key={p.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p.id)}
            style={{
              position: 'relative',
              height: 36,
              border: 'none',
              borderRadius: 8,
              background: 'transparent',
              color: active ? 'var(--ink)' : 'var(--muted)',
              fontWeight: 600,
              fontSize: 13,
              fontFamily: 'var(--font)',
              letterSpacing: -0.1,
              cursor: 'pointer',
            }}
          >
            {active && (
              <motion.span
                layoutId="period-pill"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 8,
                  background: 'var(--surface-2)',
                  boxShadow: '0 0 0 1px var(--line) inset',
                  zIndex: 0,
                }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>{p.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ───────────────────────── Hero ─────────────────────────
function Hero({
  data,
  loading,
  period,
}: {
  data: DashboardData | null
  loading: boolean
  period: Period
}) {
  const volume = data?.hero.volume ?? 0
  const prev = data?.hero.volumePrev
  const trend = useMemo(() => {
    if (prev == null || prev === 0) return null
    return Math.round(((volume - prev) / prev) * 100)
  }, [volume, prev])

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--muted)',
          fontWeight: 500,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        }}
      >
        Volume {period === 'all' ? 'cumulé' : `· ${PERIODS.find((p) => p.id === period)?.label}`}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: -1.6,
            lineHeight: 1,
            color: 'var(--ink)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {loading ? '…' : <CountUp value={volume} />}
        </span>
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 14,
            color: 'var(--subtle)',
          }}
        >
          kg
        </span>
      </div>
      {trend !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          style={{
            marginTop: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: trend >= 0 ? 'var(--accent)' : 'var(--danger, #F87171)',
            fontFamily: 'var(--mono)',
            fontWeight: 600,
          }}
        >
          <span>{trend >= 0 ? '↑' : '↓'}</span>
          <span>
            {trend >= 0 ? '+' : ''}
            {trend}%
          </span>
          <span style={{ color: 'var(--subtle)', fontWeight: 500 }}>vs période -1</span>
        </motion.div>
      )}
      <Card style={{ padding: '14px 14px 8px', marginTop: 14 }}>
        <Sparkline12w points={data?.hero.sparkline12w ?? []} />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 6,
            fontSize: 10,
            color: 'var(--subtle)',
            fontFamily: 'var(--mono)',
          }}
        >
          <span>12 sem</span>
          <span>maintenant</span>
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
        <MicroStat label="Séances" value={loading ? '…' : String(data?.hero.seances ?? 0)} />
        <MicroStat label="Séries" value={loading ? '…' : String(data?.hero.series ?? 0)} />
        <MicroStat
          label="Charge moy."
          value={loading ? '…' : `${data?.hero.avgLoad ?? 0} kg`}
        />
      </div>
    </div>
  )
}

function MicroStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--surface)',
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
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: -0.4,
          marginTop: 2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function CountUp({ value }: { value: number }) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(reduced ? value : 0)
  useEffect(() => {
    if (reduced) {
      setDisplay(value)
      return
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    })
    return () => controls.stop()
  }, [value, reduced])
  return <>{fmt(Math.round(display))}</>
}

function Sparkline12w({ points }: { points: number[] }) {
  const reduced = useReducedMotion()
  if (points.length < 2 || points.every((p) => p === 0)) {
    return (
      <div
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: 'var(--subtle)',
          fontFamily: 'var(--mono)',
        }}
      >
        Pas encore assez de données.
      </div>
    )
  }
  const max = Math.max(...points, 1)
  const W = 320
  const H = 48
  const step = W / (points.length - 1)
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${H - (p / max) * (H - 6) - 3}`)
    .join(' ')
  const fillD = `${d} L ${W} ${H} L 0 ${H} Z`
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="spark12-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={fillD}
        fill="url(#spark12-fill)"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.4 }}
      />
      <motion.path
        d={d}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  )
}

// ───────────────────────── Distribution donut ─────────────────────────
function DistributionCard({
  items,
  loading,
}: {
  items: DistributionItem[]
  loading: boolean
}) {
  return (
    <Card style={{ padding: 16 }}>
      {loading ? (
        <EmptyLine label="…" />
      ) : items.length === 0 ? (
        <EmptyLine label="Pas de séance sur cette période." />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Donut items={items} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((d, i) => (
              <motion.div
                key={d.type}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.18 + i * 0.05, duration: 0.32 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: TYPE_COLOR[d.type] ?? 'var(--muted)',
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                    {d.label}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--subtle)',
                      fontFamily: 'var(--mono)',
                    }}
                  >
                    {d.seances} séance{d.seances > 1 ? 's' : ''}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--ink-2)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {d.percent}%
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function Donut({ items }: { items: DistributionItem[] }) {
  const reduced = useReducedMotion()
  const R = 38
  const STROKE = 14
  const C = 2 * Math.PI * R
  const total = items.reduce((a, b) => a + b.volume, 0) || 1
  let accumulated = 0
  return (
    <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
      <svg width={100} height={100} viewBox="0 0 100 100" aria-hidden>
        <circle
          cx={50}
          cy={50}
          r={R}
          fill="none"
          stroke="var(--line)"
          strokeWidth={STROKE}
        />
        {items.map((d, i) => {
          const fraction = d.volume / total
          const segLen = fraction * C
          const offset = -accumulated
          accumulated += segLen
          return (
            <motion.circle
              key={d.type}
              cx={50}
              cy={50}
              r={R}
              fill="none"
              stroke={TYPE_COLOR[d.type] ?? 'var(--muted)'}
              strokeWidth={STROKE}
              strokeDasharray={`${segLen} ${C}`}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              transform="rotate(-90 50 50)"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.08, duration: 0.4 }}
            />
          )
        })}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ink)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {items.reduce((a, b) => a + b.seances, 0)}
        </div>
        <div style={{ fontSize: 9, color: 'var(--subtle)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          séances
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Top exos ─────────────────────────
function TopExosBlock({ items, loading }: { items: TopExo[]; loading: boolean }) {
  return (
    <div>
      <SectionTitle>Exos vedettes</SectionTitle>
      <Card style={{ padding: 0 }}>
        {loading ? (
          <EmptyLine label="…" />
        ) : items.length === 0 ? (
          <EmptyLine label="Aucun exercice sur cette période." />
        ) : (
          items.map((exo, i) => (
            <motion.div
              key={exo.nom}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.05, duration: 0.32 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: 'var(--surface-2)',
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={exo.nom}
                >
                  {exo.nom}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--subtle)',
                    fontFamily: 'var(--mono)',
                    marginTop: 2,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmt(exo.volume)} kg
                  {exo.trendPct !== null && (
                    <>
                      {' · '}
                      <span
                        style={{
                          color:
                            exo.trendPct > 0
                              ? 'var(--accent)'
                              : exo.trendPct < 0
                                ? 'var(--danger, #F87171)'
                                : 'var(--subtle)',
                          fontWeight: 600,
                        }}
                      >
                        {exo.trendPct > 0 ? '↑' : exo.trendPct < 0 ? '↓' : '='}
                        {exo.trendPct > 0 ? '+' : ''}
                        {exo.trendPct}%
                      </span>
                    </>
                  )}
                </div>
              </div>
              <MiniSpark points={exo.sparkline} />
            </motion.div>
          ))
        )}
      </Card>
    </div>
  )
}

function MiniSpark({ points }: { points: number[] }) {
  const reduced = useReducedMotion()
  if (points.length < 2 || points.every((p) => p === 0)) {
    return <div style={{ width: 64, height: 22, opacity: 0.25, background: 'var(--line)', borderRadius: 3 }} aria-hidden />
  }
  const max = Math.max(...points, 1)
  const W = 64
  const H = 22
  const step = W / (points.length - 1)
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${H - (p / max) * (H - 4) - 2}`)
    .join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden style={{ flexShrink: 0 }}>
      <motion.path
        d={d}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  )
}

// ───────────────────────── Blind spots ─────────────────────────
function BlindSpotsBlock({
  items,
  loading,
}: {
  items: BlindSpot[]
  loading: boolean
}) {
  const filtered = useMemo(() => {
    return items
      .map((b) => ({ ...b, _key: b.daysSince == null ? 1e9 : b.daysSince }))
      .filter((b) => b.daysSince == null || b.daysSince >= 7)
      .sort((a, b) => b._key - a._key)
  }, [items])

  return (
    <div>
      <SectionTitle>Angles morts</SectionTitle>
      <Card style={{ padding: 0 }}>
        {loading ? (
          <EmptyLine label="…" />
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: '14px 14px',
              fontSize: 12,
              color: 'var(--muted)',
              fontFamily: 'var(--mono)',
            }}
          >
            Rien à signaler. Tout a été vu récemment.
          </div>
        ) : (
          filtered.map((b, i) => (
            <motion.div
              key={b.type}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.32 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background:
                    b.daysSince == null || b.daysSince >= 21
                      ? '#F87171'
                      : b.daysSince >= 14
                        ? '#FBBF24'
                        : 'var(--muted)',
                  flexShrink: 0,
                }}
                aria-hidden
              />
              <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
                {b.label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                  color: 'var(--muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {b.daysSince == null ? 'jamais' : `${b.daysSince} j`}
              </div>
            </motion.div>
          ))
        )}
      </Card>
    </div>
  )
}

// ───────────────────────── Recent PRs ─────────────────────────
function RecentPrsBlock({ items, loading }: { items: RecentPR[]; loading: boolean }) {
  return (
    <div>
      <SectionTitle>Records récents</SectionTitle>
      {loading ? (
        <Card style={{ padding: 14 }}>
          <EmptyLine label="…" />
        </Card>
      ) : items.length === 0 ? (
        <Card style={{ padding: 18 }}>
          <div
            style={{
              fontSize: 13,
              color: 'var(--muted)',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            Aucun record encore. Enregistre quelques séances pour voir tes PRs.
          </div>
        </Card>
      ) : (
        <Card style={{ padding: 0 }}>
          {items.map((pr, i) => (
            <motion.div
              key={pr.nom}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.32 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Flame size={13} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={pr.nom}
                >
                  {pr.nom}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--muted)',
                    fontFamily: 'var(--mono)',
                    marginTop: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {pr.poids} kg × {pr.reps}
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--subtle)',
                  fontFamily: 'var(--mono)',
                  flexShrink: 0,
                }}
              >
                {formatShortDate(pr.date)}
              </div>
            </motion.div>
          ))}
        </Card>
      )}
    </div>
  )
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d).replace('.', '')
}

// ───────────────────────── Shared bits ─────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  )
}

function EmptyLine({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '18px 14px',
        textAlign: 'center',
        fontSize: 12,
        color: 'var(--muted)',
        fontFamily: 'var(--mono)',
      }}
    >
      {label}
    </div>
  )
}

// ───────────────────────── Sprints ─────────────────────────
function SprintsBlock({
  runs,
  loading,
  onOpenAll,
}: {
  runs: Run[]
  loading: boolean
  onOpenAll: () => void
}) {
  // Best perf overall = chrono le plus rapide toutes distances confondues.
  // Pour comparer équitablement entre distances on prend juste le plus rapide
  // de chaque distance et on en garde celui qui a la vitesse (m/s) la plus élevée.
  const bestByDistance = useMemo(() => {
    const map = new Map<number, Run>()
    for (const r of runs) {
      const cur = map.get(r.distance_m)
      if (!cur || r.duration_ms < cur.duration_ms) map.set(r.distance_m, r)
    }
    return Array.from(map.values())
  }, [runs])

  const bestOverall = useMemo(() => {
    let best: Run | null = null
    let bestSpeed = 0
    for (const r of bestByDistance) {
      const speed = r.distance_m / (r.duration_ms / 1000) // m/s
      if (speed > bestSpeed) {
        bestSpeed = speed
        best = r
      }
    }
    return best
  }, [bestByDistance])

  const recent = runs.slice(0, 3)

  return (
    <div>
      <SectionTitle>Sprints</SectionTitle>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <EmptyLine label="…" />
        ) : runs.length === 0 ? (
          <div
            style={{
              padding: '18px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--surface-2)',
                color: 'var(--subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Timer size={15} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500 }}>
                Aucun chrono pour l’instant
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--subtle)',
                  fontFamily: 'var(--mono)',
                  marginTop: 1,
                }}
              >
                Lance ton premier sprint depuis l’accueil
              </div>
            </div>
          </div>
        ) : (
          <>
            {bestOverall && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 14px',
                  borderBottom: '1px solid var(--line-2)',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Flame size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--accent)',
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}
                  >
                    Meilleure perf
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 8,
                      marginTop: 2,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 19,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        letterSpacing: -0.4,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatChrono(bestOverall.duration_ms)}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 12,
                        color: 'var(--accent)',
                        fontWeight: 600,
                      }}
                    >
                      {bestOverall.distance_m}m
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 10,
                        color: 'var(--subtle)',
                        fontFamily: 'var(--mono)',
                      }}
                    >
                      {formatRunDate(bestOverall.date)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {recent.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05, duration: 0.32 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 14px',
                  borderTop: i === 0 && bestOverall ? 'none' : '1px solid var(--line-2)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: 'var(--muted)',
                    width: 38,
                    flexShrink: 0,
                  }}
                >
                  {r.distance_m}m
                </span>
                <span
                  style={{
                    flex: 1,
                    fontFamily: 'var(--mono)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    letterSpacing: -0.3,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatChrono(r.duration_ms)}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--subtle)',
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {formatRunDate(r.date)}
                </span>
              </motion.div>
            ))}

            <button
              onClick={onOpenAll}
              style={{
                width: '100%',
                appearance: 'none',
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                color: 'var(--accent)',
                padding: '12px 14px',
                fontFamily: 'var(--font)',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                borderTop: '1px solid var(--line-2)',
              }}
            >
              Voir tout
              <ChevronRight size={14} />
            </button>
          </>
        )}
      </Card>
    </div>
  )
}
