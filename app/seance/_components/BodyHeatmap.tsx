'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Card, Segmented } from './primitives'
import { Dumbbell, Timer } from './icons'
import type { HeatmapData, HeatmapGroup, MuscleGroupKey } from '../_lib/useHeatmap'
import { formatChrono, formatChronoShort } from '../_lib/runs'
import {
  BODY_VIEWBOX,
  FACE_GROUPS,
  BACK_GROUPS,
  FACE_OUTLINE_PATHS,
  BACK_OUTLINE_PATHS,
} from './body-svg/paths'

type View = 'face' | 'back'
const VIEW_STORAGE_KEY = 'tpc.heatmap.view'

const PERIOD_LABEL: Record<string, string> = {
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
  '90d': '90 derniers jours',
  all: 'depuis le début',
}

// MuscleGroupKey → ids MuscleWiki (vue face)
const FACE_MAPPING: Partial<Record<MuscleGroupKey, readonly string[]>> = {
  chest: ['chest'],
  shoulders: ['front-shoulders'],
  traps: ['traps'],
  biceps: ['biceps'],
  forearms: ['forearms'],
  core: ['abdominals', 'obliques'],
  quads: ['quads'],
  calves: ['calves'],
}

// MuscleGroupKey → ids MuscleWiki (vue dos)
const BACK_MAPPING: Partial<Record<MuscleGroupKey, readonly string[]>> = {
  shoulders: ['rear-shoulders'],
  traps: ['traps', 'traps-middle'],
  triceps: ['triceps'],
  forearms: ['forearms'],
  back: ['lats', 'lowerback'],
  glutes: ['glutes'],
  hamstrings: ['hamstrings'],
  calves: ['calves'],
}

const MUSCLE_LABEL: Record<MuscleGroupKey, string> = {
  chest: 'Pectoraux',
  shoulders: 'Épaules',
  back: 'Dos',
  biceps: 'Biceps',
  forearms: 'Avant-bras',
  triceps: 'Triceps',
  quads: 'Quadriceps',
  glutes: 'Fessiers',
  hamstrings: 'Ischio-jambiers',
  calves: 'Mollets',
  traps: 'Trapèzes',
  core: 'Core',
}

// Muscles potentiellement sollicités par la course (sprint courte distance).
// Source : mapping en base de l'exercice global "Sprint courte distance".
// Sert à masquer le bloc "Course" du popover pour les muscles du haut du corps
// qui ne peuvent jamais être affectés — leur afficher "Pas de course" est un
// faux signal qui pollue la lecture.
const RUNNING_AFFECTED_MUSCLES: ReadonlySet<MuscleGroupKey> = new Set([
  'quads',
  'glutes',
  'hamstrings',
  'calves',
])

function isRunningEligible(key: MuscleGroupKey, data: HeatmapGroup): boolean {
  if (RUNNING_AFFECTED_MUSCLES.has(key)) return true
  // Défense : si le mapping change en base et qu'un muscle "haut du corps" a
  // été crédité de runs, on l'affiche quand même pour ne pas perdre la donnée.
  return data.running.runs > 0
}

// ─── Visuel bivarié par muscle ───────────────────────────────────────
// `total` ∈ [0,1] code l'intensité globale (saturation).
// `chargeRatio` ∈ [0,1] code la nature : 0 = course pure (ambre), 1 = charge pure (vert),
// intermédiaire = teinte mixée vert↔ambre. Implémenté via color-mix nested CSS.
type Visual = {
  chargeNorm: number
  courseNorm: number
  total: number
  chargeRatio: number
}

function visualFor(g: HeatmapGroup, maxW: number, maxR: number): Visual {
  const chargeNorm = maxW > 0 ? g.weighted.volume / maxW : 0
  const courseNorm = maxR > 0 ? g.running.distance / maxR : 0
  const total = Math.max(chargeNorm, courseNorm)
  const denom = chargeNorm + courseNorm
  const chargeRatio = denom > 0 ? chargeNorm / denom : 0.5
  return { chargeNorm, courseNorm, total, chargeRatio }
}

function bivariateBase(chargeRatio: number): string {
  const pct = Math.round(chargeRatio * 100)
  return `color-mix(in oklch, var(--accent) ${pct}%, var(--warn))`
}

function bivariateColor(total: number, chargeRatio: number): string {
  if (total <= 0) return 'var(--surface-2)'
  const base = bivariateBase(chargeRatio)
  if (total <= 0.25) return `color-mix(in oklch, ${base} 30%, var(--surface-2))`
  if (total <= 0.5) return `color-mix(in oklch, ${base} 55%, var(--surface-2))`
  if (total <= 0.75) return `color-mix(in oklch, ${base} 80%, var(--surface-2))`
  return base
}

function bivariateGlow(total: number, chargeRatio: number): string | undefined {
  if (total <= 0.75) return undefined
  const base = bivariateBase(chargeRatio)
  return `drop-shadow(0 0 6px color-mix(in oklch, ${base} 55%, transparent))`
}

function intensityLabel(total: number): string {
  if (total <= 0) return 'non travaillé'
  if (total <= 0.25) return 'léger'
  if (total <= 0.5) return 'modéré'
  if (total <= 0.75) return 'solide'
  return 'très chargé'
}

function natureLabel(v: Visual): string {
  if (v.chargeNorm > 0 && v.courseNorm > 0) return 'en charge et en course'
  if (v.chargeNorm > 0) return 'en charge'
  if (v.courseNorm > 0) return 'en course'
  return ''
}

const fmt = (n: number) => n.toLocaleString('fr-FR')

// ─── Composant principal ─────────────────────────────────────────────
export function BodyHeatmap({
  data,
  loading,
  period,
}: {
  data: HeatmapData | null
  loading: boolean
  period: string
}) {
  const reduced = useReducedMotion()
  const [view, setView] = useState<View>('face')
  const [activeGroup, setActiveGroup] = useState<MuscleGroupKey | null>(null)

  // Restaure le dernier choix face/dos. localStorage n'est accessible qu'après hydration ;
  // mêmes pattern et trade-off que app/seance/_lib/prefs.ts:49.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY)
    if (saved === 'face' || saved === 'back') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView(saved)
    }
  }, [])

  const handleViewChange = (v: View) => {
    setView(v)
    setActiveGroup(null)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEW_STORAGE_KEY, v)
    }
  }

  const { visualMap, groupMap } = useMemo(() => {
    const vm: Partial<Record<MuscleGroupKey, Visual>> = {}
    const gm: Partial<Record<MuscleGroupKey, HeatmapGroup>> = {}
    if (!data) return { visualMap: vm, groupMap: gm }
    const maxW = data.maxWeightedVolume
    const maxR = data.maxRunningDistance
    for (const g of data.groups) {
      gm[g.groupKey] = g
      vm[g.groupKey] = visualFor(g, maxW, maxR)
    }
    return { visualMap: vm, groupMap: gm }
  }, [data])

  const activeData = activeGroup ? groupMap[activeGroup] : null
  const activeVisual = activeGroup ? visualMap[activeGroup] : null

  return (
    <Card style={{ padding: 16 }}>
      <Header period={period} />

      <div style={{ marginTop: 14 }}>
        <Segmented<View>
          options={[
            { value: 'face', label: 'Face' },
            { value: 'back', label: 'Dos' },
          ]}
          value={view}
          onChange={handleViewChange}
        />
      </div>

      <div
        style={{
          position: 'relative',
          marginTop: 14,
          display: 'flex',
          justifyContent: 'center',
          minHeight: 380,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={reduced ? false : { opacity: 0, x: view === 'face' ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? undefined : { opacity: 0, x: view === 'face' ? 10 : -10 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <BodyView
              view={view}
              loading={loading}
              visualMap={visualMap}
              activeGroup={activeGroup}
              onSelect={setActiveGroup}
              reduced={reduced ?? false}
            />
          </motion.div>
        </AnimatePresence>

        {/* Popover muscle */}
        <AnimatePresence>
          {activeData && activeVisual && (
            <MusclePopover
              data={activeData}
              visual={activeVisual}
              onClose={() => setActiveGroup(null)}
            />
          )}
        </AnimatePresence>
      </div>

      <Legend />

      {/* Description accessible pour les lecteurs d'écran */}
      <p
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {summarize(data, view)}
      </p>
    </Card>
  )
}

// ─── Header (titre + période) ────────────────────────────────────────
function Header({ period }: { period: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <div
        style={{
          fontSize: 11,
          color: 'var(--muted)',
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}
      >
        Heatmap corporelle
      </div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--subtle)',
          fontFamily: 'var(--mono)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {PERIOD_LABEL[period] ?? period}
      </div>
    </div>
  )
}

// ─── SVG corps ───────────────────────────────────────────────────────
function BodyView({
  view,
  loading,
  visualMap,
  activeGroup,
  onSelect,
  reduced,
}: {
  view: View
  loading: boolean
  visualMap: Partial<Record<MuscleGroupKey, Visual>>
  activeGroup: MuscleGroupKey | null
  onSelect: (g: MuscleGroupKey | null) => void
  reduced: boolean
}) {
  const mapping = view === 'face' ? FACE_MAPPING : BACK_MAPPING
  const groups = view === 'face' ? FACE_GROUPS : BACK_GROUPS
  const outline = view === 'face' ? FACE_OUTLINE_PATHS : BACK_OUTLINE_PATHS

  return (
    <svg
      viewBox={BODY_VIEWBOX}
      width="100%"
      style={{ display: 'block', maxHeight: 440, maxWidth: 260 }}
      role="img"
      aria-label={view === 'face' ? 'Vue face du corps' : 'Vue dos du corps'}
    >
      {/* Contours anatomiques (lignes de définition musculaire) */}
      <g aria-hidden="true" pointerEvents="none">
        {outline.map((d, i) => (
          <path
            key={`outline-${view}-${i}`}
            d={d}
            fill="none"
            stroke="var(--line)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.55}
          />
        ))}
      </g>

      {/* Groupes musculaires interactifs */}
      {(Object.entries(mapping) as Array<[MuscleGroupKey, readonly string[]]>).map(
        ([ourKey, mwIds], i) => {
          const visual = loading
            ? { chargeNorm: 0, courseNorm: 0, total: 0, chargeRatio: 0.5 }
            : (visualMap[ourKey] ?? { chargeNorm: 0, courseNorm: 0, total: 0, chargeRatio: 0.5 })
          const isActive = activeGroup === ourKey
          const paths = mwIds.flatMap((id) => groups[id] ?? [])
          if (paths.length === 0) return null
          return (
            <MuscleGroupZone
              key={`${view}-${ourKey}`}
              ourKey={ourKey}
              paths={paths}
              visual={visual}
              loading={loading}
              isActive={isActive}
              index={i}
              reduced={reduced}
              onSelect={() => onSelect(isActive ? null : ourKey)}
            />
          )
        },
      )}
    </svg>
  )
}

// ─── Groupe musculaire interactif ────────────────────────────────────
function MuscleGroupZone({
  ourKey,
  paths,
  visual,
  loading,
  isActive,
  index,
  reduced,
  onSelect,
}: {
  ourKey: MuscleGroupKey
  paths: string[]
  visual: Visual
  loading: boolean
  isActive: boolean
  index: number
  reduced: boolean
  onSelect: () => void
}) {
  const fill = bivariateColor(visual.total, visual.chargeRatio)
  const filter = bivariateGlow(visual.total, visual.chargeRatio)
  const nature = natureLabel(visual)
  const ariaSuffix = nature ? `, ${nature}, intensité ${intensityLabel(visual.total)}` : ''

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${MUSCLE_LABEL[ourKey]}${ariaSuffix}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      style={{ cursor: 'pointer', outline: 'none' }}
    >
      {paths.map((d, i) => (
        <motion.path
          key={`${ourKey}-${i}`}
          d={d}
          initial={reduced || loading ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: reduced ? 0 : 0.04 + index * 0.03,
            duration: 0.32,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            fill,
            filter,
            transition: 'fill 280ms cubic-bezier(0.22, 1, 0.36, 1), filter 280ms',
          }}
          stroke={isActive ? 'var(--ink)' : 'transparent'}
          strokeWidth={isActive ? 2.5 : 0}
        />
      ))}
    </g>
  )
}

// ─── Popover muscle (au tap) — dual charge + course ──────────────────
function MusclePopover({
  data,
  visual,
  onClose,
}: {
  data: HeatmapGroup
  visual: Visual
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const t = window.setTimeout(() => {
      window.addEventListener('mousedown', handler)
      window.addEventListener('touchstart', handler)
    }, 50)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('mousedown', handler)
      window.removeEventListener('touchstart', handler)
    }
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-label={data.label}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'absolute',
        bottom: 8,
        left: 8,
        right: 8,
        background: 'var(--surface-2)',
        borderRadius: 12,
        padding: '12px 14px',
        boxShadow: '0 0 0 1px var(--line) inset, 0 10px 28px -10px rgba(0,0,0,0.6)',
        zIndex: 2,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{data.label}</div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '0 7px',
            height: 18,
            borderRadius: 999,
            background: bivariateColor(visual.total, visual.chargeRatio),
            color: visual.total > 0.5 ? 'var(--accent-ink)' : 'var(--ink)',
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'lowercase',
            letterSpacing: 0.2,
          }}
        >
          {intensityLabel(visual.total)}
        </span>
      </div>

      {/* Bloc Charge */}
      <PopoverSection
        icon={<Dumbbell size={12} color="var(--accent)" />}
        title="Charge"
        accent="var(--accent)"
        empty={data.weighted.volume === 0 && data.weighted.series === 0}
        emptyLabel="Pas de charge sur la période"
      >
        <span>
          <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
            {fmt(data.weighted.volume)}
          </span>{' '}
          kg
        </span>
        <span>
          <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{data.weighted.series}</span>{' '}
          {data.weighted.series > 1 ? 'séries' : 'série'}
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--subtle)' }}>
          {formatDaysAgo(data.weighted.lastSessionDaysAgo)}
        </span>
      </PopoverSection>

      {/* Bloc Course — masqué pour les muscles que la course ne sollicite jamais */}
      {isRunningEligible(data.groupKey, data) && (
        <>
          <PopoverSection
            icon={<Timer size={12} color="var(--warn)" />}
            title="Course"
            accent="var(--warn)"
            empty={data.running.runs === 0}
            emptyLabel="Pas de course sur la période"
          >
            <span>
              <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmt(data.running.distance)}</span>{' '}
              m
            </span>
            <span>
              <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{data.running.runs}</span>{' '}
              {data.running.runs > 1 ? 'chronos' : 'chrono'}
            </span>
            {data.running.duration > 0 && (
              <span style={{ color: 'var(--subtle)' }}>{formatChronoShort(data.running.duration)}</span>
            )}
            <span style={{ marginLeft: 'auto', color: 'var(--subtle)' }}>
              {formatDaysAgo(data.running.lastSessionDaysAgo)}
            </span>
          </PopoverSection>

          {data.running.avgPrPct !== null && data.running.runs > 0 && (
            <PrIntensityBar avgPrPct={data.running.avgPrPct} bestRun={data.running.bestRun} />
          )}
        </>
      )}
    </motion.div>
  )
}

// ─── Sous-bloc d'une section dans le popover ─────────────────────────
function PopoverSection({
  icon,
  title,
  accent,
  empty,
  emptyLabel,
  children,
}: {
  icon: React.ReactNode
  title: string
  accent: string
  empty: boolean
  emptyLabel: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: empty ? 'var(--subtle)' : accent,
        }}
      >
        {icon}
        {title}
      </div>
      {empty ? (
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            color: 'var(--subtle)',
            fontFamily: 'var(--mono)',
          }}
        >
          {emptyLabel}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 4,
            fontSize: 11,
            color: 'var(--muted)',
            fontFamily: 'var(--mono)',
            fontVariantNumeric: 'tabular-nums',
            flexWrap: 'wrap',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Barre d'intensité %PR (sous le bloc Course) ─────────────────────
function PrIntensityBar({
  avgPrPct,
  bestRun,
}: {
  avgPrPct: number
  bestRun: HeatmapGroup['running']['bestRun']
}) {
  const reduced = useReducedMotion()
  const pctRound = Math.round(avgPrPct * 100)
  const width = Math.min(100, Math.max(2, pctRound))
  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--subtle)',
          fontFamily: 'var(--mono)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>Intensité moyenne</span>
        <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{pctRound} % PR</span>
      </div>
      <div
        style={{
          marginTop: 4,
          height: 5,
          borderRadius: 3,
          background: 'var(--line)',
          overflow: 'hidden',
        }}
        aria-hidden
      >
        <motion.div
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{
            height: '100%',
            background: 'var(--warn)',
          }}
        />
      </div>
      {bestRun && (
        <div
          style={{
            marginTop: 5,
            fontSize: 10,
            color: 'var(--subtle)',
            fontFamily: 'var(--mono)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          top : {formatChrono(bestRun.duration_ms)} sur {bestRun.distance_m}m ·{' '}
          {Math.round(bestRun.prPct * 100)} % PR
        </div>
      )}
    </div>
  )
}

// ─── Légende bivariée ────────────────────────────────────────────────
function Legend() {
  return (
    <div style={{ marginTop: 14 }} aria-hidden>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}
      >
        <LegendSwatch color={bivariateColor(1, 1)} label="charge" />
        <LegendSwatch color={bivariateColor(1, 0.5)} label="les deux" />
        <LegendSwatch color={bivariateColor(1, 0)} label="course" />
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 10,
          color: 'var(--subtle)',
          fontFamily: 'var(--mono)',
          textAlign: 'center',
          letterSpacing: 0.3,
        }}
      >
        plus c&apos;est saturé, plus c&apos;est travaillé
      </div>
    </div>
  )
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          background: color,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 11,
          color: 'var(--muted)',
          fontFamily: 'var(--mono)',
        }}
      >
        {label}
      </span>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────
function formatDaysAgo(days: number | null): string {
  if (days == null) return 'jamais'
  if (days === 0) return 'aujourd’hui'
  return `il y a ${days} j`
}

// ─── Résumé textuel pour lecteurs d'écran ────────────────────────────
function summarize(data: HeatmapData | null, view: View): string {
  if (!data) return 'Heatmap : chargement.'
  const viewLabel = view === 'face' ? 'face' : 'dos'
  const trainedWeighted = data.groups.filter((g) => g.weighted.volume > 0)
  const trainedRunning = data.groups.filter((g) => g.running.runs > 0)
  if (trainedWeighted.length === 0 && trainedRunning.length === 0) {
    return `Heatmap vue ${viewLabel} : aucun groupe musculaire travaillé sur la période.`
  }
  const topW = [...trainedWeighted]
    .sort((a, b) => b.weighted.volume - a.weighted.volume)
    .slice(0, 3)
    .map((g) => g.label)
    .join(', ')
  const topR = [...trainedRunning]
    .sort((a, b) => b.running.distance - a.running.distance)
    .slice(0, 3)
    .map((g) => g.label)
    .join(', ')
  const parts: string[] = []
  if (trainedWeighted.length > 0) {
    parts.push(`Plus chargés en muscu : ${topW}.`)
  }
  if (trainedRunning.length > 0) {
    parts.push(`Plus sollicités en course : ${topR}.`)
  }
  return `Heatmap vue ${viewLabel}. ${parts.join(' ')}`
}
