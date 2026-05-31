'use client'

import { motion, useReducedMotion } from 'motion/react'
import { smoothLineFromValues } from '../_lib/smoothPath'

export type WeightPoint = { date: string; value: number }

/**
 * Courbe d'évolution du poids de corps. Contrairement à une sparkline de volume
 * (normalisée à 0), l'axe Y est resserré autour de min/max pour rendre lisible
 * une variation de quelques kg. Couleur muscu (var(--accent)).
 */
export function WeightChart({
  points,
  height = 64,
}: {
  points: WeightPoint[]
  height?: number
}) {
  const reduced = useReducedMotion()

  if (points.length < 2) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: 'var(--subtle)',
          fontFamily: 'var(--mono)',
        }}
      >
        {points.length === 0 ? 'Pas encore de pesée.' : 'Au moins 2 pesées pour la courbe.'}
      </div>
    )
  }

  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  // Padding vertical : si poids constant, on évite une division par zéro.
  const span = max - min || 1
  const pad = span * 0.15

  const W = 320
  const H = height
  const top = 4
  const bottom = H - 4
  const usable = bottom - top
  const lo = min - pad
  const hi = max + pad
  const range = hi - lo || 1
  const step = W / (points.length - 1)

  const y = (v: number) => bottom - ((v - lo) / range) * usable
  const d = smoothLineFromValues(values, step, y)
  const fillD = `${d} L ${W} ${H} L 0 ${H} Z`
  const lastX = (points.length - 1) * step
  const lastY = y(points[points.length - 1].value)

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.20" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={fillD}
        fill="url(#weight-fill)"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
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
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r={3} fill="var(--accent)" />
    </svg>
  )
}
