'use client'

import type { NavFn, SessionState } from '../_lib/types'
import { daysAgo, formatSeanceDate, greetingFor, percentChange } from '../_lib/helpers'
import { WORKOUT_TYPES } from '../_lib/constants'
import { useDashboard } from '../_lib/useDashboard'
import { useRuns } from '../_lib/useRuns'
import { formatChrono, formatRunDate } from '../_lib/runs'
import { Button, Card, Pill } from '../_components/primitives'
import { ArrowUpRight, ChevronRight, Dumbbell, Spark, Timer, TrendUp } from '../_components/icons'

type Props = {
  session: SessionState
  nav: NavFn
}

export function IdleScreen({ nav }: Props) {
  const { data, loading } = useDashboard()
  const { runs } = useRuns()
  const lastRun = runs[0] ?? null

  const weekVolume = data?.week.volume ?? 0
  const weekSeances = data?.week.seances ?? 0
  const weekSeries = data?.week.series ?? 0
  const change =
    data && data.week.volumePrev > 0
      ? percentChange(data.week.volume, data.week.volumePrev)
      : null

  const last = data?.lastSeance ?? null
  const lastType = last ? WORKOUT_TYPES.find((t) => t.id === last.type) : null

  return (
    <div
      className="app-scroll"
      style={{
        minHeight: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'var(--bg)',
        paddingBottom: 40,
      }}
    >
      {/* HERO */}
      <div
        style={{
          padding: '20px 22px 22px',
          animation: 'fadeUp 480ms cubic-bezier(0.22, 1, 0.36, 1) both',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px 4px 6px',
            borderRadius: 999,
            background: 'var(--surface)',
            boxShadow: '0 0 0 1px var(--line) inset',
            marginBottom: 18,
          }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Spark size={11} />
          </span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500 }}>
            Prêt à reprendre&nbsp;? · {greetingFor()}
          </span>
        </div>
        <h1
          style={{
            fontSize: 40,
            lineHeight: 1.02,
            letterSpacing: -1.8,
            fontWeight: 700,
            margin: '0 0 8px',
            color: 'var(--ink)',
            textWrap: 'balance',
            fontFamily: 'var(--display)',
          }}
        >
          Bonjour.
          <br />
          <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>
            T&apos;as pris combien
            <span style={{ color: 'var(--accent)' }}>?</span>
          </span>
        </h1>
        <p
          style={{
            margin: '0 0 22px',
            color: 'var(--muted)',
            fontSize: 14,
            lineHeight: 1.45,
            maxWidth: 320,
          }}
        >
          Une séance guidée, série par série. Pas de tableaux de bord — juste ce que tu portes, et combien de fois.
        </p>
        <Button size="lg" onClick={() => nav('config')} icon={<Dumbbell size={16} />}>
          Commencer une séance
        </Button>

        {/* Raccourci Sprint — ouvre directement le ChronoView avec la dernière distance utilisée. */}
        <button
          onClick={() => nav('athletics', { athleticsView: 'chrono' })}
          aria-label="Lancer un sprint"
          style={{
            marginTop: 10,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 14px',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            background: 'var(--surface)',
            borderRadius: 14,
            boxShadow: '0 0 0 1px var(--line) inset',
            color: 'var(--ink)',
            transition: 'box-shadow 160ms, transform 120ms',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'var(--surface-2)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Timer size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
              Sprint
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                marginTop: 2,
                fontFamily: 'var(--mono)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {lastRun
                ? `${lastRun.distance_m}m · dernier ${formatChrono(lastRun.duration_ms)} · ${formatRunDate(lastRun.date)}`
                : 'Premier chrono'}
            </div>
          </div>
          <ChevronRight size={14} color="var(--muted)" />
        </button>
      </div>

      {/* Volume stat card */}
      <div style={{ padding: '0 20px 14px' }}>
        <Card interactive onClick={() => nav('stats')} style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <TrendUp size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--muted)',
                  fontWeight: 500,
                  letterSpacing: 0.2,
                  textTransform: 'uppercase',
                }}
              >
                Volume cette semaine
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 28,
                    fontWeight: 600,
                    letterSpacing: -1,
                  }}
                >
                  {loading ? '…' : weekVolume.toLocaleString('fr-FR')}
                </span>
                <span style={{ fontSize: 13, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>
                  kg soulevés
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                {change !== null && (
                  <Pill tone={change >= 0 ? 'ok' : 'warn'} icon={<TrendUp size={10} />}>
                    {change >= 0 ? `+${change}` : change}% vs S-1
                  </Pill>
                )}
                <span style={{ fontSize: 11, color: 'var(--subtle)' }}>
                  {weekSeances} séance{weekSeances > 1 ? 's' : ''} · {weekSeries} série
                  {weekSeries > 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div style={{ color: 'var(--subtle)', alignSelf: 'center' }}>
              <ArrowUpRight size={18} />
            </div>
          </div>
          {data && (
            <div style={{ marginTop: 14, height: 38, position: 'relative' }}>
              <Sparkline points={data.fourWeeks.chart.map((c) => c.volume)} />
            </div>
          )}
        </Card>
      </div>

      {/* Last workout */}
      {last && lastType && (
        <div style={{ padding: '6px 20px 14px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 4px 10px',
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
              Dernière séance
            </span>
            <button
              onClick={() => nav('history')}
              style={{
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--ink-2)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                padding: '4px 6px',
                margin: '-4px -6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Tout l&apos;historique
              <ChevronRight size={11} stroke={2.4} />
            </button>
          </div>
          <Card
            interactive
            onClick={() => nav('session_detail', { seanceId: last.id })}
            style={{ padding: 16 }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--mono)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {lastType.emoji}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Séance {lastType.label}</div>
                  <div
                    style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}
                  >
                    {formatSeanceDate(last.date)}
                  </div>
                </div>
              </div>
              <Pill tone="outline">
                {last.exos.length} exo{last.exos.length > 1 ? 's' : ''}
              </Pill>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {last.exos.map((e) => (
                <div
                  key={e.nom}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: 'var(--line-2)',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{e.nom}</span>
                  {e.topSet && (
                    <span
                      style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)' }}
                    >
                      {e.topSet.poids} kg × {e.topSet.reps}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {last.seriesCount} série{last.seriesCount > 1 ? 's' : ''} · {daysAgo(last.date)}
              </span>
              <ChevronRight size={14} color="var(--subtle)" />
            </div>
          </Card>
        </div>
      )}

      {!loading && !last && (
        <div style={{ padding: '6px 20px 14px' }}>
          <Card style={{ padding: 18 }}>
            <div
              style={{
                fontSize: 13,
                color: 'var(--muted)',
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              Pas encore de séance enregistrée.
              <br />
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                Lance ta première séance.
              </span>
            </div>
            <button
              onClick={() => nav('history')}
              style={{
                marginTop: 14,
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'var(--ink-2)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              ou ajouter une séance manuellement
            </button>
          </Card>
        </div>
      )}

      <div
        style={{
          padding: '20px 24px 0',
          fontSize: 11,
          color: 'var(--subtle)',
          textAlign: 'center',
          fontFamily: 'var(--mono)',
        }}
      >
        v0.4.2 — local-first
      </div>
    </div>
  )
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2 || points.every((p) => p === 0)) return null
  const max = Math.max(...points, 1)
  const W = 320,
    H = 38,
    step = W / (points.length - 1)
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${H - (p / max) * (H - 4) - 2}`)
    .join(' ')
  const fill = `${path} L ${W} ${H} L 0 ${H} Z`
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#sp)" />
      <path
        d={path}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={i * step}
          cy={H - (p / max) * (H - 4) - 2}
          r={i === points.length - 1 ? 3 : 0}
          fill="var(--accent)"
        />
      ))}
    </svg>
  )
}
