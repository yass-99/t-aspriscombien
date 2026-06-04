'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, animate, useReducedMotion } from 'motion/react'
import type { NavFn, Run, SessionState } from '../_lib/types'
import {
  useDashboard,
  type DashboardData,
  type DistributionItem,
  type TopExo,
  type Period,
} from '../_lib/useDashboard'
import { Card, IconButton, TopBar } from '../_components/primitives'
import { Check, ChevronLeft, ChevronRight, Copy, Dumbbell, Flame, Timer, TrendUp } from '../_components/icons'
import { useProfileHeader } from '../_lib/useProfileHeader'
import { useToast } from '../../_components/Toast'
import { formatPeriodForLLM, periodHasContent } from '../_lib/helpers'
import { smoothLineFromValues } from '../_lib/smoothPath'
import { Skeleton, SkeletonChart } from '../_components/Skeleton'
import { WeightDetailModal } from '../_components/WeightDetailModal'
import { BodyHeatmap } from '../_components/BodyHeatmap'
import { LegsHeatmap } from '../_components/LegsHeatmap'
import { useHeatmap, type HeatmapData } from '../_lib/useHeatmap'
import { useRuns } from '../_lib/useRuns'
import { useBodyweight } from '../_lib/useBodyweight'
import { WeightChart, type WeightPoint } from '../_components/WeightChart'
import {
  formatChrono,
  formatRunDate,
  groupRunsIntoSessions,
  computePrSpeedByDistance,
  computeAvgPrPct,
  computeAvgSpeed,
  bucketActivityWindow,
  bucketWeeklyAvgSpeed,
  summarizeByDistance,
} from '../_lib/runs'

type Props = {
  session: SessionState
  nav: NavFn
}

type Scope = 'global' | 'muscu' | 'athle'

const PERIODS: { id: Period; label: string }[] = [
  { id: '7d', label: '7j' },
  { id: '30d', label: '30j' },
  { id: '90d', label: '90j' },
]

const SCOPES: { id: Scope; label: string; accent: string }[] = [
  { id: 'global', label: 'Global', accent: 'var(--ink)' },
  { id: 'muscu', label: 'Muscu', accent: 'var(--accent)' },
  { id: 'athle', label: 'Athlé', accent: 'var(--warn)' },
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

// Filtre les runs côté client par période — l'API runs ne supporte pas le filtre
// de période, donc on l'applique ici pour rester cohérent avec le dashboard muscu.
function filterRunsByPeriod(runs: Run[], period: Period): Run[] {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - days + 1)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return runs.filter((r) => r.date >= cutoffStr)
}

export function StatsScreen({ nav }: Props) {
  const [scope, setScope] = useState<Scope>('global')
  const [period, setPeriod] = useState<Period>('7d')
  const { data, loading } = useDashboard(period)
  const { data: heatmap, loading: heatmapLoading } = useHeatmap(period)
  const { runs, loading: runsLoading } = useRuns()
  const reduced = useReducedMotion()

  const periodRuns = useMemo(() => filterRunsByPeriod(runs, period), [runs, period])

  const subtitle = useMemo(() => {
    if (loading || runsLoading) return '…'
    const periodLabel = PERIODS.find((p) => p.id === period)?.label
    if (scope === 'muscu') {
      const n = data?.hero.seances ?? 0
      return `${n} séance${n > 1 ? 's' : ''} · ${periodLabel}`
    }
    if (scope === 'athle') {
      const n = periodRuns.length
      return `${n} chrono${n > 1 ? 's' : ''} · ${periodLabel}`
    }
    const muscu = data?.hero.seances ?? 0
    const athle = groupRunsIntoSessions(periodRuns).length
    return `${muscu + athle} séance${muscu + athle > 1 ? 's' : ''} · ${periodLabel}`
  }, [scope, period, data, periodRuns, loading, runsLoading])

  // Teinte de la page = couleur du scope : orange en athlé, vert en muscu,
  // violet en global (chrome). Le halo ambiant ci-dessous la diffuse.
  const scopeTint =
    scope === 'muscu' ? 'var(--accent)' : scope === 'athle' ? 'var(--warn)' : 'var(--brand)'

  return (
    <div
      className="app-scroll"
      style={{ minHeight: '100%', background: 'transparent', position: 'relative' }}
    >
      {/* Halo ambiant teinté par scope : donne à la page la couleur de sa
          catégorie et de la matière au verre. Défile avec le contenu ; la
          couleur se fond en douceur au changement d'onglet. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          transition: 'background 420ms ease',
          // Volontairement léger : juste une teinte en haut + un voile latéral
          // très diffus, pas un lavis de couleur.
          background: `radial-gradient(66% 18% at 50% 0%, color-mix(in oklch, ${scopeTint} 11%, transparent) 0%, transparent 72%), radial-gradient(48% 16% at 88% 36%, color-mix(in oklch, ${scopeTint} 6%, transparent) 0%, transparent 76%)`,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
      <TopBar
        leading={
          <IconButton
            icon={<ChevronLeft size={18} />}
            label="retour"
            onClick={() => nav('idle')}
          />
        }
        title="Statistiques"
        subtitle={subtitle}
      />

      <div style={{ padding: '4px 20px 30px' }}>
        <ScopeTabs value={scope} onChange={setScope} />
        <PeriodSwitch value={period} onChange={setPeriod} />

        <AnimatePresence mode="wait">
          <motion.div
            key={scope + period}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {scope === 'global' && (
              <GlobalView
                data={data}
                runs={periodRuns}
                loading={loading || runsLoading}
                onSwitch={setScope}
                period={period}
              />
            )}
            {scope === 'muscu' && (
              <MuscuView
                data={data}
                loading={loading}
                heatmap={heatmap}
                heatmapLoading={heatmapLoading}
                period={period}
              />
            )}
            {scope === 'athle' && (
              <AthleView
                periodRuns={periodRuns}
                allRuns={runs}
                heatmap={heatmap}
                loading={runsLoading}
                period={period}
                onStart={() => nav('athletics')}
                onOpenSession={(runIds) =>
                  nav('athletics_detail', { athleticsRunIds: runIds })
                }
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      </div>
    </div>
  )
}

// ───────────────────────── Scope tabs ─────────────────────────
function ScopeTabs({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Catégorie de statistiques"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 4,
        padding: 4,
        background: 'var(--surface)',
        borderRadius: 12,
        boxShadow: '0 0 0 1px var(--line) inset',
        marginTop: 6,
      }}
    >
      {SCOPES.map((s) => {
        const active = value === s.id
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s.id)}
            style={{
              position: 'relative',
              height: 38,
              border: 'none',
              borderRadius: 8,
              background: 'transparent',
              color: active ? s.accent : 'var(--muted)',
              fontWeight: 600,
              fontSize: 13,
              fontFamily: 'var(--font)',
              letterSpacing: -0.1,
              cursor: 'pointer',
            }}
          >
            {active && (
              <motion.span
                layoutId="scope-pill"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 8,
                  background: 'var(--surface-2)',
                  boxShadow: `0 0 0 1px color-mix(in oklch, ${s.accent} 40%, var(--line)) inset`,
                  zIndex: 0,
                }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>{s.label}</span>
          </button>
        )
      })}
    </div>
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
        gridTemplateColumns: `repeat(${PERIODS.length}, 1fr)`,
        gap: 4,
        padding: 4,
        background: 'var(--surface)',
        borderRadius: 12,
        boxShadow: '0 0 0 1px var(--line) inset',
        marginTop: 8,
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 34,
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

// ═══════════════════════════════════════════════════════════════════
// GLOBAL VIEW
// ═══════════════════════════════════════════════════════════════════
function GlobalView({
  data,
  runs,
  loading,
  onSwitch,
  period,
}: {
  data: DashboardData | null
  runs: Run[]
  loading: boolean
  onSwitch: (s: Scope) => void
  period: Period
}) {
  const muscuSeances = data?.hero.seances ?? 0
  const muscuVolume = data?.hero.volume ?? 0
  const muscuSeries = data?.hero.series ?? 0
  const athleSessions = useMemo(() => groupRunsIntoSessions(runs), [runs])
  const athleCount = athleSessions.length
  const chronoCount = runs.length
  const totalSeances = muscuSeances + athleCount

  // Meilleure perf athlé sur la période (vitesse m/s la plus haute parmi les bests par distance).
  const bestAthle = useMemo(() => {
    const byDist = new Map<number, Run>()
    for (const r of runs) {
      const cur = byDist.get(r.distance_m)
      if (!cur || r.duration_ms < cur.duration_ms) byDist.set(r.distance_m, r)
    }
    let best: Run | null = null
    let bestSpeed = 0
    for (const r of byDist.values()) {
      const speed = r.distance_m / (r.duration_ms / 1000)
      if (speed > bestSpeed) {
        bestSpeed = speed
        best = r
      }
    }
    return best
  }, [runs])

  return (
    <div style={{ marginTop: 16 }}>
      {/* Hero combiné */}
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
          Activité {`· ${PERIODS.find((p) => p.id === period)?.label}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
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
            {loading ? '…' : <CountUp value={totalSeances} />}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--subtle)' }}>
            séance{totalSeances > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Carte par catégorie */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
        <ScopeCard
          tone="muscu"
          icon={<Dumbbell size={16} />}
          label="Muscu"
          primary={loading ? '…' : `${fmt(muscuVolume)} kg`}
          secondary={`${muscuSeances} séance${muscuSeances > 1 ? 's' : ''} · ${muscuSeries} série${muscuSeries > 1 ? 's' : ''}`}
          onClick={() => onSwitch('muscu')}
        />
        <ScopeCard
          tone="athle"
          icon={<Timer size={16} />}
          label="Athlé"
          primary={loading ? '…' : bestAthle ? formatChrono(bestAthle.duration_ms) : '—'}
          secondary={
            bestAthle
              ? `${chronoCount} chrono${chronoCount > 1 ? 's' : ''} · top ${bestAthle.distance_m}m`
              : `${chronoCount} chrono${chronoCount > 1 ? 's' : ''}`
          }
          onClick={() => onSwitch('athle')}
        />
      </div>

      {/* Export coach — période-conscient : copie le bilan de la période sélectionnée. */}
      <CopyPeriodButton data={data} runs={runs} period={period} loading={loading} />

      {/* Comparatif rapide */}
      <Section index={1}>
        <SectionTitle>Répartition de la période</SectionTitle>
        <Card style={{ padding: 16 }}>
          <RatioBar muscuCount={muscuSeances} athleCount={athleCount} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 12,
              fontSize: 11,
              color: 'var(--muted)',
              fontFamily: 'var(--mono)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Dot color="var(--accent)" />
              Muscu · {muscuSeances}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Dot color="var(--warn)" />
              Athlé · {athleCount}
            </span>
          </div>
        </Card>
      </Section>

      {/* Suivi du poids — clique pour le détail */}
      <Section index={2}>
        <SectionTitle>Poids de corps</SectionTitle>
        <GlobalWeightCard period={period} />
      </Section>
    </div>
  )
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: color,
        display: 'inline-block',
      }}
    />
  )
}

function RatioBar({ muscuCount, athleCount }: { muscuCount: number; athleCount: number }) {
  const total = muscuCount + athleCount
  if (total === 0) {
    return (
      <div
        style={{
          height: 12,
          borderRadius: 6,
          background: 'var(--line)',
          fontSize: 11,
          color: 'var(--subtle)',
          fontFamily: 'var(--mono)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Pas d&apos;activité sur cette période.
      </div>
    )
  }
  const muscuPct = Math.round((muscuCount / total) * 100)
  const athlePct = 100 - muscuPct
  return (
    <div
      style={{
        height: 12,
        borderRadius: 6,
        background: 'var(--line)',
        overflow: 'hidden',
        display: 'flex',
      }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${muscuPct}%` }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: 'var(--accent)', height: '100%' }}
      />
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${athlePct}%` }}
        transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: 'var(--warn)', height: '100%' }}
      />
    </div>
  )
}

function ScopeCard({
  tone,
  icon,
  label,
  primary,
  secondary,
  onClick,
}: {
  tone: 'muscu' | 'athle'
  icon: React.ReactNode
  label: string
  primary: string
  secondary: string
  onClick: () => void
}) {
  const color = tone === 'muscu' ? 'var(--accent)' : 'var(--warn)'
  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      style={{
        appearance: 'none',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        padding: 14,
        borderRadius: 14,
        background: 'var(--surface)',
        boxShadow: `0 0 0 1px var(--line) inset, inset 3px 0 0 0 ${color}`,
        fontFamily: 'var(--font)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 96,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color,
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            // Plus de tuile teintée : l'icône seule, en couleur (le contour
            // latéral porte déjà l'identité muscu/athlé).
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <ChevronRight size={14} color="var(--subtle)" />
      </div>
      <div>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: -0.6,
            color: 'var(--ink)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {primary}
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
          {secondary}
        </div>
      </div>
    </motion.button>
  )
}

// Bouton « Copier pour mon coach » période-conscient (scope Global). Construit le
// bilan à partir des données déjà chargées (DashboardData + runs filtrés période).
function CopyPeriodButton({
  data,
  runs,
  period,
  loading,
}: {
  data: DashboardData | null
  runs: Run[]
  period: Period
  loading: boolean
}) {
  const profile = useProfileHeader()
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const periodLabel = PERIODS.find((p) => p.id === period)?.label

  const handleCopy = async () => {
    if (!data || !periodHasContent(data, runs)) {
      toast.warn('Rien à copier sur cette période.')
      return
    }
    const text = formatPeriodForLLM(data, runs, profile, period)
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
      setCopied(true)
      toast.ok(`Bilan ${periodLabel} copié — prêt pour ton coach.`)
      window.setTimeout(() => setCopied(false), 2400)
    } catch {
      toast.warn('Copie impossible — réessaie.')
    }
  }

  return (
    <motion.button
      whileTap={{ scale: 0.99 }}
      onClick={handleCopy}
      disabled={loading}
      style={{
        marginTop: 16,
        width: '100%',
        appearance: 'none',
        border: 'none',
        cursor: loading ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 44,
        borderRadius: 12,
        background: copied ? 'var(--ok)' : 'var(--brand-soft)',
        color: copied ? 'var(--bg)' : 'var(--brand-bright)',
        boxShadow: copied ? 'none' : '0 0 0 1px var(--brand-line) inset',
        fontFamily: 'var(--font)',
        fontSize: 13,
        fontWeight: 700,
        opacity: loading ? 0.6 : 1,
        transition: 'background 160ms, color 160ms',
      }}
    >
      {copied ? <Check size={16} stroke={2.6} /> : <Copy size={15} />}
      {copied ? 'Copié' : `Copier pour mon coach · ${periodLabel}`}
    </motion.button>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MUSCU VIEW (ancien contenu, sans SprintsBlock)
// ═══════════════════════════════════════════════════════════════════
function MuscuView({
  data,
  loading,
  heatmap,
  heatmapLoading,
  period,
}: {
  data: DashboardData | null
  loading: boolean
  heatmap: ReturnType<typeof useHeatmap>['data']
  heatmapLoading: boolean
  period: Period
}) {
  return (
    <>
      <Section index={0}>
        <Hero data={data} loading={loading} period={period} />
      </Section>

      {/* Heatmap corporelle = élément principal, juste sous la charge totale. */}
      <Section index={1}>
        <SectionTitle>Muscles sollicités</SectionTitle>
        <BodyHeatmap data={heatmap} loading={heatmapLoading} period={period} />
      </Section>

      <Section index={2}>
        <TopExosBlock items={data?.topExos ?? []} loading={loading} />
      </Section>

      <Section index={3}>
        <SectionTitle>Répartition</SectionTitle>
        <DistributionCard items={data?.distribution ?? []} loading={loading} />
      </Section>
    </>
  )
}

// ───────────────────────── Bodyweight (suivi du poids, scope global) ─────────────────────────
// Carte résumée cliquable : ouvre le modal détaillé (courbe, stats, historique, saisie).
function GlobalWeightCard({ period }: { period: Period }) {
  const { bodyweights, loading } = useBodyweight()
  const [detailOpen, setDetailOpen] = useState(false)

  const points: WeightPoint[] = useMemo(() => {
    const mapped = bodyweights.map((b) => ({ date: b.date, value: b.poidsKg }))
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() - days)
    return mapped.filter((p) => new Date(p.date + 'T00:00:00').getTime() >= cutoff.getTime())
  }, [bodyweights, period])

  // Dernière pesée connue, même hors période — pour ne jamais afficher « — ».
  const latest = bodyweights.length ? bodyweights[bodyweights.length - 1].poidsKg : null
  const current = points.length ? points[points.length - 1].value : latest
  const first = points.length ? points[0].value : null
  const delta = points.length >= 2 && first != null && current != null ? current - first : null

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.99 }}
        onClick={() => setDetailOpen(true)}
        style={{
          appearance: 'none',
          border: 'none',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          padding: 16,
          borderRadius: 14,
          background: 'var(--surface)',
          boxShadow: '0 0 0 1px var(--line) inset',
          fontFamily: 'var(--font)',
        }}
      >
        {loading ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Skeleton width={26} height={26} radius={8} />
              <Skeleton width={92} height={24} />
              <span style={{ flex: 1 }} />
              <Skeleton width={16} height={16} radius="var(--radius-sm)" />
            </div>
            <SkeletonChart height={64} />
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span
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
                <TrendUp size={15} />
              </span>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 26,
                  fontWeight: 600,
                  letterSpacing: -0.8,
                  color: 'var(--ink)',
                }}
              >
                {current != null ? fmtPoidsStat(current) : '—'}
                {current != null && (
                  <span style={{ fontSize: 13, color: 'var(--subtle)', marginLeft: 3 }}>kg</span>
                )}
              </span>
              {delta != null && delta !== 0 && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'var(--mono)',
                    color: 'var(--muted)',
                  }}
                >
                  {delta > 0 ? '▲' : '▼'} {delta > 0 ? '+' : '−'}
                  {fmtPoidsStat(Math.abs(delta))} kg
                </span>
              )}
              <span style={{ flex: 1 }} />
              <ChevronRight size={16} color="var(--subtle)" />
            </div>
            {points.length >= 2 ? (
              <WeightChart points={points} />
            ) : (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--muted)',
                  fontFamily: 'var(--mono)',
                }}
              >
                {bodyweights.length === 0
                  ? 'Note ta première pesée pour lancer le suivi.'
                  : 'Touche pour voir le détail et ajouter une pesée.'}
              </div>
            )}
          </>
        )}
      </motion.button>
      <WeightDetailModal open={detailOpen} onClose={() => setDetailOpen(false)} />
    </>
  )
}

function fmtPoidsStat(n: number): string {
  return (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace('.', ',')
}

// ═══════════════════════════════════════════════════════════════════
// ATHLÉ VIEW
// ═══════════════════════════════════════════════════════════════════
function AthleView({
  periodRuns,
  allRuns,
  heatmap,
  loading,
  period,
  onStart,
  onOpenSession,
}: {
  periodRuns: Run[]
  // allRuns sert au calcul des PR « tous temps » même si la période est restreinte.
  allRuns: Run[]
  heatmap: HeatmapData | null
  loading: boolean
  period: Period
  onStart: () => void
  onOpenSession: (runIds: string[]) => void
}) {
  const sessions = useMemo(() => groupRunsIntoSessions(periodRuns), [periodRuns])

  // PR-speed par distance sur l'historique complet → utilisé pour les %PR de la période.
  const prSpeedByDistance = useMemo(
    () => computePrSpeedByDistance(allRuns),
    [allRuns],
  )

  // Allure moyenne et intensité (%PR) de la période sélectionnée.
  const periodAvgSpeed = useMemo(() => computeAvgSpeed(periodRuns), [periodRuns])
  const periodAvgPrPct = useMemo(
    () => computeAvgPrPct(periodRuns, prSpeedByDistance),
    [periodRuns, prSpeedByDistance],
  )

  // Sparkline 12 semaines : allure moyenne hebdomadaire (m/s) sur tous les runs.
  const weeklySpeed12w = useMemo(() => bucketWeeklyAvgSpeed(allRuns, 12), [allRuns])

  // Tendance allure : moyenne 7 derniers jours vs moyenne 12 sem (hors les 7 derniers).
  const trendPct = useMemo(() => {
    if (weeklySpeed12w.length < 2) return null
    const last = weeklySpeed12w[weeklySpeed12w.length - 1]
    const previous = weeklySpeed12w.slice(0, -1).filter((v) => v > 0)
    if (last === 0 || previous.length === 0) return null
    const avgPrev = previous.reduce((a, b) => a + b, 0) / previous.length
    if (avgPrev === 0) return null
    return Math.round(((last - avgPrev) / avgPrev) * 100)
  }, [weeklySpeed12w])

  // Distribution des distances pour l'histogramme.
  const distancesPeriod = useMemo(() => summarizeByDistance(periodRuns), [periodRuns])

  // Fenêtre de régularité = la période sélectionnée.
  const regularityDays = period === '7d' ? 7 : period === '30d' ? 30 : 90

  // PRs par distance — toujours basés sur l'historique complet, pas la période,
  // car un PR est un record absolu, indépendant de la fenêtre temporelle.
  const prByDistance = useMemo(() => {
    const map = new Map<number, Run>()
    for (const r of allRuns) {
      const cur = map.get(r.distance_m)
      if (!cur || r.duration_ms < cur.duration_ms) map.set(r.distance_m, r)
    }
    return Array.from(map.values()).sort((a, b) => a.distance_m - b.distance_m)
  }, [allRuns])

  const bestOverall = useMemo(() => {
    let best: Run | null = null
    let bestSpeed = 0
    for (const r of prByDistance) {
      const speed = r.distance_m / (r.duration_ms / 1000)
      if (speed > bestSpeed) {
        bestSpeed = speed
        best = r
      }
    }
    return best
  }, [prByDistance])

  // PRs battus pendant la période ? On les marque pour mettre un Flame.
  const prsBeatenInPeriod = useMemo(() => {
    const set = new Set<string>()
    // Pour chaque distance, regarde si le PR (le plus rapide de l'historique)
    // tombe dans la fenêtre période → c'est un PR battu récemment.
    for (const pr of prByDistance) {
      if (periodRuns.some((r) => r.id === pr.id)) set.add(pr.id)
    }
    return set
  }, [prByDistance, periodRuns, period])

  const periodLabel = PERIODS.find((p) => p.id === period)?.label
  const chronoCount = periodRuns.length

  if (loading) {
    return (
      <div style={{ marginTop: 24 }}>
        <EmptyLine label="Chargement…" />
      </div>
    )
  }

  if (allRuns.length === 0) {
    return (
      <div style={{ marginTop: 22 }}>
        <Card style={{ padding: 22 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                // Icône seule, en orange, sans tuile teintée.
                background: 'transparent',
                color: 'var(--warn)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Timer size={20} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                Aucun chrono pour l&apos;instant
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--muted)',
                  marginTop: 4,
                  lineHeight: 1.5,
                  maxWidth: 280,
                }}
              >
                Lance une séance athlétisme depuis l&apos;accueil pour enregistrer ton premier
                chrono.
              </div>
            </div>
            <button
              type="button"
              onClick={onStart}
              style={{
                marginTop: 4,
                appearance: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '10px 16px',
                borderRadius: 999,
                background: 'var(--warn)',
                color: 'var(--bg)',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'var(--font)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Timer size={14} />
              Démarrer une séance athlé
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16 }}>
      {/* Hero athlé : meilleure performance + volume */}
      <Section index={0}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            fontWeight: 500,
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}
        >
          Meilleure perf · {periodLabel}
        </div>
        {bestOverall ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 44,
                fontWeight: 600,
                letterSpacing: -1.6,
                lineHeight: 1,
                color: 'var(--warn)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatChrono(bestOverall.duration_ms)}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--warn)' }}>
              {bestOverall.distance_m}m
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            Pas de chrono sur cette période.
          </div>
        )}
        {periodAvgSpeed > 0 && (
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: 10,
              fontSize: 12,
              color: 'var(--muted)',
              fontFamily: 'var(--mono)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span>
              <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>
                {periodAvgSpeed.toFixed(2).replace('.', ',')}
              </span>{' '}
              m/s allure moy.
            </span>
            {trendPct !== null && (
              <span
                style={{
                  color: trendPct >= 0 ? 'var(--warn)' : 'var(--danger, #F87171)',
                  fontWeight: 600,
                }}
              >
                {trendPct >= 0 ? '↑' : '↓'} {trendPct >= 0 ? '+' : ''}
                {trendPct} %
              </span>
            )}
            {periodAvgPrPct !== null && (
              <span style={{ color: 'var(--subtle)' }}>
                · {Math.round(periodAvgPrPct * 100)} % PR moyen
              </span>
            )}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
          <MicroStat label="Chronos" value={String(chronoCount)} />
          <MicroStat label="Séances" value={String(sessions.length)} />
          <MicroStat label="Distances" value={String(new Set(periodRuns.map((r) => r.distance_m)).size)} />
        </div>
      </Section>

      {/* PRs par distance */}
      <Section index={1}>
        <SectionTitle>Records par distance</SectionTitle>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {prByDistance.length === 0 ? (
            <EmptyLine label="Pas encore de chrono." />
          ) : (
            prByDistance.map((pr, i) => {
              const beatenInPeriod = prsBeatenInPeriod.has(pr.id)
              return (
                <motion.div
                  key={pr.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.04, duration: 0.3 }}
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
                      width: 38,
                      height: 30,
                      borderRadius: 8,
                      // Chip neutre pour tous : plus de fond orange muddy. Le
                      // NEW se lit via le texte orange + la pastille à côté.
                      background: 'var(--surface-2)',
                      color: beatenInPeriod ? 'var(--warn)' : 'var(--ink-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--mono)',
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {pr.distance_m}m
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 16,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        letterSpacing: -0.4,
                        fontVariantNumeric: 'tabular-nums',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      {formatChrono(pr.duration_ms)}
                      {beatenInPeriod && (
                        // Contour orange, sans fond : l'orange reste, le fond part.
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            height: 22,
                            padding: '0 8px',
                            borderRadius: 999,
                            background: 'transparent',
                            color: 'var(--warn)',
                            boxShadow:
                              '0 0 0 1px color-mix(in oklch, var(--warn) 45%, transparent) inset',
                            fontSize: 11,
                            fontWeight: 600,
                            fontFamily: 'var(--font)',
                          }}
                        >
                          <Flame size={9} />
                          NEW
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--subtle)',
                        fontFamily: 'var(--mono)',
                        marginTop: 2,
                      }}
                    >
                      {(pr.distance_m / (pr.duration_ms / 1000)).toFixed(2)} m/s ·{' '}
                      {formatRunDate(pr.date)}
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </Card>
      </Section>

      {/* Régularité — fenêtre = période sélectionnée, paginée par tranches de
          30 j au-delà de 30 j pour éviter un bloc géant. */}
      <Section index={2}>
        <RegularitySection allRuns={allRuns} totalDays={regularityDays} />
      </Section>

      {/* Distribution des distances */}
      {distancesPeriod.length > 0 && (
        <Section index={3}>
          <SectionTitle>Distribution des distances</SectionTitle>
          <Card style={{ padding: '14px 14px 10px' }}>
            <DistanceDistribution distances={distancesPeriod} />
          </Card>
        </Section>
      )}

      {/* Muscles sollicités */}
      {heatmap && heatmap.groups.some((g) => g.running.runs > 0) && (
        <Section index={4}>
          <SectionTitle>Muscles sollicités</SectionTitle>
          <Card style={{ padding: 16 }}>
            <LegsHeatmap
              groups={heatmap.groups}
              maxDistance={heatmap.maxRunningDistance}
            />
          </Card>
        </Section>
      )}

      {/* Récentes séances athlé */}
      <Section index={5}>
        <SectionTitle>Séances récentes</SectionTitle>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {sessions.length === 0 ? (
            <EmptyLine label="Aucune séance athlé sur cette période." />
          ) : (
            sessions.slice(0, 6).map((s, i) => {
              const best = s.runs.reduce<Run | null>(
                (b, r) => (!b || r.duration_ms < b.duration_ms ? r : b),
                null,
              )
              const distances = Array.from(new Set(s.runs.map((r) => r.distance_m))).sort(
                (a, b) => a - b,
              )
              return (
                <motion.button
                  key={s.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.04, duration: 0.3 }}
                  onClick={() => onOpenSession(s.runs.map((r) => r.id))}
                  style={{
                    appearance: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
                    fontFamily: 'var(--font)',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      // Icône seule, en orange, sans tuile teintée.
                      background: 'transparent',
                      color: 'var(--warn)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Timer size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      {formatRunDate(s.date)}
                      <span style={{ color: 'var(--subtle)', fontWeight: 500, marginLeft: 6 }}>
                        · {s.runs.length} chrono{s.runs.length > 1 ? 's' : ''}
                      </span>
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
                      {distances.map((d) => `${d}m`).join(' · ')}
                      {best && ` · top ${formatChrono(best.duration_ms)} (${best.distance_m}m)`}
                    </div>
                  </div>
                  <ChevronRight size={14} color="var(--subtle)" />
                </motion.button>
              )
            })
          )}
        </Card>
      </Section>
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
      style={{ marginTop: index === 0 ? 16 : 22 }}
    >
      {children}
    </motion.section>
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
        Volume {`· ${PERIODS.find((p) => p.id === period)?.label}`}
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
          <span style={{ color: 'var(--subtle)', fontWeight: 500 }}>
            vs {PERIODS.find((p) => p.id === period)?.label} précédents
          </span>
        </motion.div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 16 }}>
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
      // Reduced-motion path : pas d'animation, on saute direct à la valeur cible.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
  // Précalcul des offsets cumulés via reduce immuable —
  // ESLint react-hooks/immutability interdit la mutation d'une variable locale pendant le render.
  const segments = items.map((d) => ({ d, segLen: (d.volume / total) * C }))
  // acc[i] = longueur cumulée des segments AVANT i (somme positive).
  // On stocke la somme cumulée, pas l'offset négatif, sinon le cumul se
  // corrompt dès le 3ᵉ segment (chevauchements + trous dans l'anneau).
  const offsets = segments.reduce<number[]>((acc, _s, i) => {
    const prevSum = i === 0 ? 0 : acc[i - 1] + segments[i - 1].segLen
    acc.push(prevSum)
    return acc
  }, [])
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
        {segments.map(({ d, segLen }, i) => {
          // strokeDashoffset négatif = on décale le départ du tiret vers l'avant.
          const offset = -offsets[i]
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
              // Chaque arc se trace : le tiret croît de 0 à sa longueur,
              // les segments s'enchaînant dans le sens horaire.
              initial={reduced ? false : { strokeDasharray: `0 ${C}`, opacity: 0 }}
              animate={{ strokeDasharray: `${segLen} ${C}`, opacity: 1 }}
              transition={{
                delay: 0.2 + i * 0.1,
                duration: 0.55,
                ease: [0.22, 1, 0.36, 1],
              }}
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
  const d = smoothLineFromValues(points, step, (p) => H - (p / max) * (H - 4) - 2)
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

// ───────────────────────── Athlé : régularité paginée ─────────────────────────
// Affiche la fenêtre `totalDays`. Au-delà de 30 j, on découpe en tranches de
// 30 j navigables (flèches) pour éviter un bloc de cases géant.
const REG_PAGE = 30

function RegularitySection({ allRuns, totalDays }: { allRuns: Run[]; totalDays: number }) {
  const paged = totalDays > REG_PAGE
  const pageCount = paged ? Math.ceil(totalDays / REG_PAGE) : 1
  // page 0 = tranche la plus récente (finissant aujourd'hui).
  const [page, setPage] = useState(0)
  // Borne la page si la période change (ex : passage de '90d' à '7d').
  const safePage = Math.min(page, pageCount - 1)

  // Fenêtre courante : décalage et largeur (la dernière tranche peut être < 30 j).
  const endDaysAgo = safePage * REG_PAGE
  const windowDays = paged ? Math.min(REG_PAGE, totalDays - endDaysAgo) : totalDays

  const days = useMemo(
    () => bucketActivityWindow(allRuns, endDaysAgo, windowDays),
    [allRuns, endDaysAgo, windowDays],
  )

  const rangeLabel =
    days.length > 0
      ? `${formatRunDate(days[0].date)} – ${formatRunDate(days[days.length - 1].date)}`
      : ''

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
          paddingLeft: 2,
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
          Régularité · {paged ? rangeLabel : `${totalDays} jours`}
        </span>
        {paged && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <PagerButton
              dir="prev"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            />
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--subtle)',
                minWidth: 34,
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {safePage + 1}/{pageCount}
            </span>
            <PagerButton
              dir="next"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            />
          </div>
        )}
      </div>
      <Card style={{ padding: 16 }}>
        <RegularityCalendar days={days} />
      </Card>
    </>
  )
}

function PagerButton({
  dir,
  disabled,
  onClick,
}: {
  dir: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-label={dir === 'prev' ? 'Tranche précédente' : 'Tranche suivante'}
      disabled={disabled}
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        background: 'var(--surface-2)',
        color: disabled ? 'var(--line)' : 'var(--ink-2)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {dir === 'prev' ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
    </button>
  )
}

// ───────────────────────── Athlé : calendrier régularité ─────────────────────────
// Calcule le jour de la semaine (lundi=0 ... dimanche=6) pour aligner la grille.
function weekdayIndex(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // dimanche=0 ... samedi=6
  return (day + 6) % 7 // → lundi=0 ... dimanche=6
}

function RegularityCalendar({
  days,
}: {
  days: { date: string; isToday: boolean; runs: number }[]
}) {
  const reduced = useReducedMotion()
  if (days.length === 0) return null
  const firstWeekday = weekdayIndex(days[0].date)
  const cells: Array<{ kind: 'pad' } | { kind: 'day'; d: (typeof days)[number]; idx: number }> = []
  for (let i = 0; i < firstWeekday; i++) cells.push({ kind: 'pad' })
  days.forEach((d, idx) => cells.push({ kind: 'day', d, idx }))
  // Pad final pour compléter la dernière ligne de 7.
  while (cells.length % 7 !== 0) cells.push({ kind: 'pad' })

  const activeCount = days.filter((d) => d.runs > 0).length
  const pct = Math.round((activeCount / days.length) * 100)

  const cellBg = (runs: number): string => {
    if (runs <= 0) return 'var(--surface-2)'
    const intensity = Math.min(100, 30 + runs * 25)
    return `color-mix(in oklch, var(--warn) ${intensity}%, var(--surface-2))`
  }

  return (
    <div>
      {/* Labels jours */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
          marginBottom: 6,
          fontSize: 9,
          color: 'var(--subtle)',
          fontFamily: 'var(--mono)',
          textAlign: 'center',
        }}
        aria-hidden
      >
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>

      {/* Grille des cellules */}
      <div
        role="grid"
        aria-label={`Activité ${days.length} jours`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
        }}
      >
        {cells.map((c, i) => {
          if (c.kind === 'pad') {
            return <div key={`pad-${i}`} aria-hidden style={{ aspectRatio: '1', opacity: 0 }} />
          }
          const d = c.d
          return (
            <motion.div
              key={d.date}
              role="gridcell"
              aria-label={`${formatRunDate(d.date)}, ${d.runs} chrono${d.runs > 1 ? 's' : ''}`}
              initial={reduced ? false : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                delay: reduced ? 0 : 0.02 * c.idx,
                duration: 0.25,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                aspectRatio: '1',
                borderRadius: 6,
                background: cellBg(d.runs),
                boxShadow: d.isToday ? '0 0 0 1.5px var(--ink) inset' : 'none',
              }}
            />
          )
        })}
      </div>

      {/* Compteur résumé */}
      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: 'var(--subtle)',
          fontFamily: 'var(--mono)',
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{activeCount}</span> jour
        {activeCount > 1 ? 's' : ''} actif{activeCount > 1 ? 's' : ''} sur {days.length} ·{' '}
        <span style={{ color: 'var(--warn)', fontWeight: 600 }}>{pct} %</span> de régularité
      </div>
    </div>
  )
}

// ───────────────────────── Athlé : histogramme distribution distances ─────────────────────────
function DistanceDistribution({
  distances,
}: {
  distances: Array<{
    distance_m: number
    count: number
    best?: Run
  }>
}) {
  const reduced = useReducedMotion()
  // Tri par count desc pour mettre en avant la distance la plus pratiquée.
  const sorted = [...distances].sort((a, b) => b.count - a.count)
  const maxCount = sorted.reduce((m, d) => (d.count > m ? d.count : m), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map((d, i) => {
        const width = Math.max(4, (d.count / maxCount) * 100)
        return (
          <motion.div
            key={d.distance_m}
            initial={reduced ? false : { opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: reduced ? 0 : 0.05 + i * 0.04, duration: 0.3 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
          >
            {/* Label distance */}
            <div
              style={{
                width: 50,
                fontFamily: 'var(--mono)',
                fontSize: 12,
                color: 'var(--ink-2)',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}
            >
              {d.distance_m}m
            </div>
            {/* Barre */}
            <div
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                background: 'var(--line)',
                overflow: 'hidden',
              }}
              aria-hidden
            >
              <motion.div
                initial={reduced ? false : { width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{
                  delay: reduced ? 0 : 0.15 + i * 0.04,
                  duration: 0.6,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{
                  height: '100%',
                  background: 'var(--warn)',
                }}
              />
            </div>
            {/* Count + top chrono */}
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--muted)',
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
                minWidth: 70,
                textAlign: 'right',
              }}
            >
              ×{d.count}
              {d.best && (
                <span style={{ color: 'var(--subtle)', marginLeft: 6 }}>
                  {formatChrono(d.best.duration_ms)}
                </span>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
