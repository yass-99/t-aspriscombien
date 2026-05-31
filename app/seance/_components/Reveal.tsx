'use client'

import { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { EASE } from '../_lib/motion'

// Reveal — fade + lift à l'apparition. À empiler avec un `delay` croissant pour
// staggerer une liste de cartes (30–50ms/item). cf. DESIGN.md §7.
export function Reveal({
  children,
  delay = 0,
  y = 12,
  duration = 0.56,
  style,
}: {
  children: ReactNode
  delay?: number
  y?: number
  duration?: number
  style?: React.CSSProperties
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div style={style}>{children}</div>
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, ease: EASE.out, delay }}
      style={style}
    >
      {children}
    </motion.div>
  )
}
