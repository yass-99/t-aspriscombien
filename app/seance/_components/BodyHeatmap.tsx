'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Card, Segmented } from './primitives'
import type { HeatmapData, HeatmapGroup, MuscleGroupKey } from '../_lib/useHeatmap'

type View = 'face' | 'back'
const VIEW_STORAGE_KEY = 'tpc.heatmap.view'

const PERIOD_LABEL: Record<string, string> = {
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
  '90d': '90 derniers jours',
  all: 'depuis le début',
}

// ─── Palette d'intensité : cyan froid → lime chaud ───────────────────
function intensityColor(score: number): string {
  if (score <= 0) return 'var(--surface-2)'
  if (score <= 0.25) return '#164E63'
  if (score <= 0.5) return '#22D3EE'
  if (score <= 0.75) return 'color-mix(in oklch, var(--accent) 60%, var(--bg))'
  return 'var(--accent)'
}

function intensityGlow(score: number): string | undefined {
  if (score > 0.75) {
    return 'drop-shadow(0 0 5px color-mix(in oklch, var(--accent) 50%, transparent))'
  }
  return undefined
}

function intensityLabel(score: number): string {
  if (score <= 0) return 'non travaillé'
  if (score <= 0.25) return 'léger'
  if (score <= 0.5) return 'modéré'
  if (score <= 0.75) return 'solide'
  return 'très chargé'
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === 'face' || saved === 'back') setView(saved)
  }, [])

  const handleViewChange = (v: View) => {
    setView(v)
    setActiveGroup(null)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEW_STORAGE_KEY, v)
    }
  }

  // Index group_key → score normalisé (0–1) + groupe brut.
  const { scoreMap, groupMap } = useMemo(() => {
    const sm: Partial<Record<MuscleGroupKey, number>> = {}
    const gm: Partial<Record<MuscleGroupKey, HeatmapGroup>> = {}
    if (data && data.maxVolume > 0) {
      for (const g of data.groups) {
        sm[g.groupKey] = g.volume / data.maxVolume
        gm[g.groupKey] = g
      }
    } else if (data) {
      for (const g of data.groups) {
        sm[g.groupKey] = 0
        gm[g.groupKey] = g
      }
    }
    return { scoreMap: sm, groupMap: gm }
  }, [data])

  const activeData = activeGroup ? groupMap[activeGroup] : null

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
          minHeight: 360,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={reduced ? false : { opacity: 0, x: view === 'face' ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? undefined : { opacity: 0, x: view === 'face' ? 10 : -10 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%', maxWidth: 240 }}
          >
            <BodySVG
              view={view}
              loading={loading}
              scoreMap={scoreMap}
              activeGroup={activeGroup}
              onSelect={setActiveGroup}
            />
          </motion.div>
        </AnimatePresence>

        {/* Popover muscle */}
        <AnimatePresence>
          {activeData && (
            <MusclePopover
              data={activeData}
              score={scoreMap[activeData.groupKey] ?? 0}
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
function BodySVG({
  view,
  loading,
  scoreMap,
  activeGroup,
  onSelect,
}: {
  view: View
  loading: boolean
  scoreMap: Partial<Record<MuscleGroupKey, number>>
  activeGroup: MuscleGroupKey | null
  onSelect: (g: MuscleGroupKey | null) => void
}) {
  const zones = view === 'face' ? FACE_ZONES : BACK_ZONES

  return (
    <svg
      viewBox="0 0 200 420"
      width="100%"
      style={{ display: 'block', maxHeight: 380 }}
      role="img"
      aria-label={view === 'face' ? 'Vue face du corps' : 'Vue dos du corps'}
    >
      {/* Silhouette outline subtile */}
      <Silhouette view={view} />

      {/* Zones musculaires colorées */}
      {zones.map((zone, i) => {
        const score = loading ? 0 : (scoreMap[zone.group] ?? 0)
        const isActive = activeGroup === zone.group
        return (
          <MuscleZone
            key={zone.group + '-' + view + '-' + i}
            zone={zone}
            score={score}
            loading={loading}
            isActive={isActive}
            index={i}
            onSelect={() => onSelect(isActive ? null : zone.group)}
          />
        )
      })}
    </svg>
  )
}

// ─── Outline silhouette (statique, non interactif) ───────────────────
function Silhouette({ view }: { view: View }) {
  const stroke = 'var(--line)'
  const sw = 0.6
  return (
    <g fill="none" stroke={stroke} strokeWidth={sw} aria-hidden>
      {/* Tête */}
      <ellipse cx={100} cy={38} rx={22} ry={26} />
      {/* Cou */}
      <path d="M 88 62 L 88 72 Q 100 78 112 72 L 112 62" />
      {/* Torse + bras + jambes — contour global */}
      {view === 'face' ? (
        <path d="M 60 78 Q 50 84 48 100 L 38 175 Q 36 195 38 215 L 40 220 L 50 220 L 60 145 L 65 130 L 70 240 L 70 280 L 72 340 L 74 410 L 92 410 L 94 340 L 96 280 L 100 240 L 104 280 L 106 340 L 108 410 L 126 410 L 128 340 L 130 280 L 130 240 L 135 130 L 140 145 L 150 220 L 160 220 L 162 215 Q 164 195 162 175 L 152 100 Q 150 84 140 78" />
      ) : (
        <path d="M 60 78 Q 50 84 48 100 L 38 175 Q 36 195 38 215 L 40 220 L 50 220 L 60 145 L 65 130 L 70 240 L 70 280 L 72 340 L 74 410 L 92 410 L 94 340 L 96 280 L 100 240 L 104 280 L 106 340 L 108 410 L 126 410 L 128 340 L 130 280 L 130 240 L 135 130 L 140 145 L 150 220 L 160 220 L 162 215 Q 164 195 162 175 L 152 100 Q 150 84 140 78" />
      )}
    </g>
  )
}

// ─── Zone musculaire interactive ─────────────────────────────────────
type ZoneDef = {
  group: MuscleGroupKey
  d: string // path SVG
  hit: { cx: number; cy: number; r: number } // cercle pour le hit target (≥22 = 44px à viewBox 200)
}

function MuscleZone({
  zone,
  score,
  loading,
  isActive,
  index,
  onSelect,
}: {
  zone: ZoneDef
  score: number
  loading: boolean
  isActive: boolean
  index: number
  onSelect: () => void
}) {
  const reduced = useReducedMotion()
  const fill = intensityColor(score)
  const filter = intensityGlow(score)

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${MUSCLE_LABEL[zone.group]}, intensité ${intensityLabel(score)}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      style={{ cursor: 'pointer', outline: 'none' }}
    >
      <motion.path
        d={zone.d}
        initial={
          reduced || loading
            ? false
            : { opacity: 0, scale: 0.96 }
        }
        animate={{
          opacity: 1,
          scale: isActive ? 1.04 : 1,
        }}
        transition={{
          delay: reduced ? 0 : 0.04 + index * 0.025,
          duration: 0.32,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{
          fill,
          filter,
          transformOrigin: `${zone.hit.cx}px ${zone.hit.cy}px`,
          transition: 'fill 280ms cubic-bezier(0.22, 1, 0.36, 1), filter 280ms',
        }}
        stroke={isActive ? 'var(--ink)' : 'transparent'}
        strokeWidth={isActive ? 0.8 : 0}
      />
      {/* Hit target élargi pour répondre aux 44×44pt minimum (touch-target-size) */}
      <circle
        cx={zone.hit.cx}
        cy={zone.hit.cy}
        r={zone.hit.r}
        fill="transparent"
        style={{ pointerEvents: 'all' }}
      />
      {/* Focus ring accessible */}
      <FocusRing cx={zone.hit.cx} cy={zone.hit.cy} r={zone.hit.r} />
    </g>
  )
}

function FocusRing({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <circle
      className="hm-focus"
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      stroke="var(--accent)"
      strokeWidth={1.5}
      style={{ opacity: 0, pointerEvents: 'none' }}
    />
  )
}

// ─── Popover muscle (au tap) ─────────────────────────────────────────
function MusclePopover({
  data,
  score,
  onClose,
}: {
  data: HeatmapGroup
  score: number
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  // Fermeture au clic extérieur
  useEffect(() => {
    const handler = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Délai pour éviter de capturer le clic d'ouverture
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

  // Fermeture à Escape
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
        boxShadow:
          '0 0 0 1px var(--line) inset, 0 10px 28px -10px rgba(0,0,0,0.6)',
        zIndex: 2,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
          {data.label}
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '0 7px',
            height: 18,
            borderRadius: 999,
            background: intensityColor(score),
            color: score > 0.5 ? 'var(--accent-ink)' : 'var(--ink)',
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'lowercase',
            letterSpacing: 0.2,
          }}
        >
          {intensityLabel(score)}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 14,
          marginTop: 8,
          fontSize: 11,
          color: 'var(--muted)',
          fontFamily: 'var(--mono)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>
          <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{fmt(data.volume)}</span>
          <span style={{ marginLeft: 3 }}>kg</span>
        </span>
        <span>
          <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{data.series}</span>
          <span style={{ marginLeft: 3 }}>{data.series > 1 ? 'séries' : 'série'}</span>
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--subtle)' }}>
          {data.lastSessionDaysAgo == null
            ? 'jamais'
            : data.lastSessionDaysAgo === 0
              ? 'aujourd’hui'
              : `il y a ${data.lastSessionDaysAgo} j`}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Légende ─────────────────────────────────────────────────────────
function Legend() {
  const stops = [0, 0.2, 0.4, 0.65, 1]
  return (
    <div
      style={{
        marginTop: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
      aria-hidden
    >
      <span style={{ fontSize: 10, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>
        peu
      </span>
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {stops.map((s, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 10,
              borderRadius: 3,
              background: intensityColor(s),
              filter: intensityGlow(s),
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 10, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>
        max
      </span>
    </div>
  )
}

// ─── Résumé textuel pour lecteurs d'écran ────────────────────────────
function summarize(data: HeatmapData | null, view: View): string {
  if (!data) return 'Heatmap : chargement.'
  const trained = data.groups.filter((g) => g.volume > 0).length
  const total = data.groups.length
  const top = [...data.groups].sort((a, b) => b.volume - a.volume).slice(0, 3)
  const topText = top
    .filter((g) => g.volume > 0)
    .map((g) => g.label)
    .join(', ')
  const viewLabel = view === 'face' ? 'face' : 'dos'
  if (trained === 0) return `Heatmap vue ${viewLabel} : aucun groupe musculaire travaillé sur la période.`
  return `Heatmap vue ${viewLabel} : ${trained} groupes sur ${total} travaillés. Plus chargés : ${topText}.`
}

// ─── Labels musculaires ──────────────────────────────────────────────
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

// ─── Définition des zones — VUE FACE ─────────────────────────────────
// viewBox 0 0 200 420 — silhouette debout, bras le long du corps.
const FACE_ZONES: ZoneDef[] = [
  // Trapèzes (partie supérieure visible autour du cou)
  {
    group: 'traps',
    d: 'M 78 72 Q 88 78 100 80 Q 112 78 122 72 L 130 88 Q 115 95 100 95 Q 85 95 70 88 Z',
    hit: { cx: 100, cy: 84, r: 16 },
  },
  // Épaule gauche
  {
    group: 'shoulders',
    d: 'M 70 88 Q 50 88 47 110 Q 50 125 60 130 L 73 125 L 70 100 Z',
    hit: { cx: 60, cy: 108, r: 18 },
  },
  // Épaule droite (mirror)
  {
    group: 'shoulders',
    d: 'M 130 88 Q 150 88 153 110 Q 150 125 140 130 L 127 125 L 130 100 Z',
    hit: { cx: 140, cy: 108, r: 18 },
  },
  // Pectoral gauche
  {
    group: 'chest',
    d: 'M 73 100 Q 72 118 78 135 Q 92 138 98 132 L 98 105 Q 85 100 73 100 Z',
    hit: { cx: 86, cy: 118, r: 18 },
  },
  // Pectoral droit
  {
    group: 'chest',
    d: 'M 127 100 Q 128 118 122 135 Q 108 138 102 132 L 102 105 Q 115 100 127 100 Z',
    hit: { cx: 114, cy: 118, r: 18 },
  },
  // Biceps gauche
  {
    group: 'biceps',
    d: 'M 47 130 Q 42 145 45 168 Q 55 172 60 168 L 62 132 Z',
    hit: { cx: 52, cy: 150, r: 16 },
  },
  // Biceps droit
  {
    group: 'biceps',
    d: 'M 153 130 Q 158 145 155 168 Q 145 172 140 168 L 138 132 Z',
    hit: { cx: 148, cy: 150, r: 16 },
  },
  // Avant-bras gauche (face)
  {
    group: 'forearms',
    d: 'M 45 172 Q 40 195 42 218 L 56 218 L 60 175 Z',
    hit: { cx: 50, cy: 195, r: 16 },
  },
  // Avant-bras droit
  {
    group: 'forearms',
    d: 'M 155 172 Q 160 195 158 218 L 144 218 L 140 175 Z',
    hit: { cx: 150, cy: 195, r: 16 },
  },
  // Core (abdos) — zone centrale, façon grille discrète
  {
    group: 'core',
    d: 'M 78 138 L 122 138 Q 124 175 122 215 Q 100 222 78 215 Q 76 175 78 138 Z',
    hit: { cx: 100, cy: 178, r: 22 },
  },
  // Quadriceps gauche
  {
    group: 'quads',
    d: 'M 75 232 Q 70 260 72 320 Q 85 328 96 322 L 98 240 Q 88 232 75 232 Z',
    hit: { cx: 84, cy: 280, r: 22 },
  },
  // Quadriceps droit
  {
    group: 'quads',
    d: 'M 125 232 Q 130 260 128 320 Q 115 328 104 322 L 102 240 Q 112 232 125 232 Z',
    hit: { cx: 116, cy: 280, r: 22 },
  },
  // Mollets face gauche (tibial antérieur)
  {
    group: 'calves',
    d: 'M 78 340 Q 75 365 76 400 L 92 400 L 94 340 Z',
    hit: { cx: 84, cy: 372, r: 16 },
  },
  // Mollets face droit
  {
    group: 'calves',
    d: 'M 122 340 Q 125 365 124 400 L 108 400 L 106 340 Z',
    hit: { cx: 116, cy: 372, r: 16 },
  },
]

// ─── Définition des zones — VUE DOS ──────────────────────────────────
const BACK_ZONES: ZoneDef[] = [
  // Trapèzes — zone large autour du cou descendant en losange jusqu'au milieu du dos
  {
    group: 'traps',
    d: 'M 75 72 Q 88 78 100 80 Q 112 78 125 72 L 132 92 Q 124 110 100 140 Q 76 110 68 92 Z',
    hit: { cx: 100, cy: 100, r: 20 },
  },
  // Épaule postérieure gauche
  {
    group: 'shoulders',
    d: 'M 68 92 Q 50 92 47 112 Q 50 126 60 130 L 70 124 Q 68 108 68 92 Z',
    hit: { cx: 60, cy: 110, r: 18 },
  },
  // Épaule postérieure droite
  {
    group: 'shoulders',
    d: 'M 132 92 Q 150 92 153 112 Q 150 126 140 130 L 130 124 Q 132 108 132 92 Z',
    hit: { cx: 140, cy: 110, r: 18 },
  },
  // Dos (grand dorsal + rhomboïdes) — V-shape
  {
    group: 'back',
    d: 'M 72 132 L 128 132 Q 134 160 128 195 L 100 218 L 72 195 Q 66 160 72 132 Z',
    hit: { cx: 100, cy: 170, r: 22 },
  },
  // Triceps gauche
  {
    group: 'triceps',
    d: 'M 47 130 Q 42 148 45 168 Q 55 172 60 168 L 62 132 Z',
    hit: { cx: 52, cy: 150, r: 16 },
  },
  // Triceps droit
  {
    group: 'triceps',
    d: 'M 153 130 Q 158 148 155 168 Q 145 172 140 168 L 138 132 Z',
    hit: { cx: 148, cy: 150, r: 16 },
  },
  // Avant-bras dos gauche
  {
    group: 'forearms',
    d: 'M 45 172 Q 40 195 42 218 L 56 218 L 60 175 Z',
    hit: { cx: 50, cy: 195, r: 16 },
  },
  // Avant-bras dos droit
  {
    group: 'forearms',
    d: 'M 155 172 Q 160 195 158 218 L 144 218 L 140 175 Z',
    hit: { cx: 150, cy: 195, r: 16 },
  },
  // Fessier gauche
  {
    group: 'glutes',
    d: 'M 76 220 Q 70 240 76 258 Q 88 262 98 256 L 98 224 Q 88 220 76 220 Z',
    hit: { cx: 86, cy: 240, r: 18 },
  },
  // Fessier droit
  {
    group: 'glutes',
    d: 'M 124 220 Q 130 240 124 258 Q 112 262 102 256 L 102 224 Q 112 220 124 220 Z',
    hit: { cx: 114, cy: 240, r: 18 },
  },
  // Ischio-jambiers gauche
  {
    group: 'hamstrings',
    d: 'M 76 262 Q 72 290 74 325 Q 86 330 96 324 L 98 270 Q 88 262 76 262 Z',
    hit: { cx: 86, cy: 295, r: 20 },
  },
  // Ischio-jambiers droit
  {
    group: 'hamstrings',
    d: 'M 124 262 Q 128 290 126 325 Q 114 330 104 324 L 102 270 Q 112 262 124 262 Z',
    hit: { cx: 114, cy: 295, r: 20 },
  },
  // Mollets dos gauche (gastrocnémien — forme plus ronde)
  {
    group: 'calves',
    d: 'M 75 340 Q 70 362 76 388 Q 88 392 94 388 L 96 340 Q 88 338 75 340 Z',
    hit: { cx: 84, cy: 365, r: 16 },
  },
  // Mollets dos droit
  {
    group: 'calves',
    d: 'M 125 340 Q 130 362 124 388 Q 112 392 106 388 L 104 340 Q 112 338 125 340 Z',
    hit: { cx: 116, cy: 365, r: 16 },
  },
]
