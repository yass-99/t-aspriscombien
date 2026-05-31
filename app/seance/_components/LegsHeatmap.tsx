'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { HeatmapGroup, MuscleGroupKey } from '../_lib/useHeatmap'
import {
  FACE_GROUPS,
  BACK_GROUPS,
  FACE_OUTLINE_PATHS,
  BACK_OUTLINE_PATHS,
} from './body-svg/paths'

// Restreint la viewBox à la moitié inférieure du corps (jambes uniquement).
// Le viewBox d'origine est '0 0 660.46 1206.46' — on commence à Y=485 (juste au-dessus des fessiers).
const LEGS_VIEWBOX = '0 485 660.46 720'

const FACE_LEG_MUSCLES: ReadonlyArray<{ key: MuscleGroupKey; mwId: string }> = [
  { key: 'quads', mwId: 'quads' },
  { key: 'calves', mwId: 'calves' },
]

const BACK_LEG_MUSCLES: ReadonlyArray<{ key: MuscleGroupKey; mwId: string }> = [
  { key: 'glutes', mwId: 'glutes' },
  { key: 'hamstrings', mwId: 'hamstrings' },
  { key: 'calves', mwId: 'calves' },
]

// ─── Palette monochrome ambre ───────────────────────────────────────
function ambreColor(score: number): string {
  if (score <= 0) return 'var(--surface-2)'
  if (score <= 0.25) return 'color-mix(in oklch, var(--warn) 30%, var(--surface-2))'
  if (score <= 0.5) return 'color-mix(in oklch, var(--warn) 55%, var(--surface-2))'
  if (score <= 0.75) return 'color-mix(in oklch, var(--warn) 80%, var(--surface-2))'
  return 'var(--warn)'
}

const fmt = (n: number) => n.toLocaleString('fr-FR')

// ─── Composant principal ─────────────────────────────────────────────
export function LegsHeatmap({
  groups,
  maxDistance,
}: {
  groups: HeatmapGroup[]
  maxDistance: number
}) {
  const reduced = useReducedMotion()

  // Score normalisé par groupe.
  const scoreOf = (key: MuscleGroupKey): number => {
    const g = groups.find((g) => g.groupKey === key)
    if (!g || maxDistance <= 0) return 0
    return Math.min(1, g.running.distance / maxDistance)
  }

  // Liste des muscles sollicités, triée par distance desc.
  const sollicited = groups
    .filter((g) => g.running.runs > 0)
    .sort((a, b) => b.running.distance - a.running.distance)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 16,
        alignItems: 'start',
      }}
    >
      {/* Mini-silhouettes face + dos côte à côte */}
      <div style={{ display: 'flex', gap: 6 }}>
        <MiniLegSvg
          view="face"
          scoreOf={scoreOf}
          reduced={reduced ?? false}
          label="face"
        />
        <MiniLegSvg
          view="back"
          scoreOf={scoreOf}
          reduced={reduced ?? false}
          label="dos"
        />
      </div>

      {/* Liste des muscles avec distance */}
      <div
        role="list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 0,
        }}
      >
        {sollicited.map((g, i) => (
          <motion.div
            key={g.groupKey}
            role="listitem"
            initial={reduced ? false : { opacity: 0, x: 4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: reduced ? 0 : 0.1 + i * 0.05, duration: 0.3 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: ambreColor(scoreOf(g.groupKey)),
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: 'var(--ink)',
                fontWeight: 500,
                flex: 1,
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {g.label}
            </span>
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--muted)',
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}
            >
              {fmt(g.running.distance)} m
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Mini SVG d'une vue (face ou dos) ────────────────────────────────
function MiniLegSvg({
  view,
  scoreOf,
  reduced,
  label,
}: {
  view: 'face' | 'back'
  scoreOf: (k: MuscleGroupKey) => number
  reduced: boolean
  label: string
}) {
  const groups = view === 'face' ? FACE_GROUPS : BACK_GROUPS
  const outlinePaths = view === 'face' ? FACE_OUTLINE_PATHS : BACK_OUTLINE_PATHS
  const muscles = view === 'face' ? FACE_LEG_MUSCLES : BACK_LEG_MUSCLES

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg
        viewBox={LEGS_VIEWBOX}
        width={84}
        height={92}
        style={{ display: 'block' }}
        role="img"
        aria-label={`Vue ${label} des jambes`}
      >
        {/* Contours anatomiques de la moitié inférieure */}
        <g aria-hidden="true" pointerEvents="none">
          {outlinePaths.map((d, i) => (
            <path
              key={`legs-outline-${view}-${i}`}
              d={d}
              fill="none"
              stroke="var(--line)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.4}
            />
          ))}
        </g>

        {/* Zones musculaires des jambes */}
        {muscles.map(({ key, mwId }, idx) => {
          const paths = groups[mwId] ?? []
          if (paths.length === 0) return null
          const score = scoreOf(key)
          const fill = ambreColor(score)
          return (
            <g key={`${view}-${key}`} aria-label={`${key} ${Math.round(score * 100)}%`}>
              {paths.map((d, i) => (
                <motion.path
                  key={`${view}-${key}-${i}`}
                  d={d}
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    delay: reduced ? 0 : 0.05 + idx * 0.04,
                    duration: 0.3,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{
                    fill,
                    transition: 'fill 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              ))}
            </g>
          )
        })}
      </svg>
      <span
        style={{
          fontSize: 9,
          color: 'var(--subtle)',
          fontFamily: 'var(--mono)',
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </div>
  )
}
