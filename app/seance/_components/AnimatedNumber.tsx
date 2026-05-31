'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { EASE } from '../_lib/motion'

// Compteur animé (count-up) — les chiffres « montent » à l'apparition / au changement.
// Transform-free (re-render du texte), durée courte, easing decel. cf. DESIGN.md §7.
export function AnimatedNumber({
  value,
  format,
  duration = 0.9,
  className,
  style,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
  className?: string
  style?: React.CSSProperties
}) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(0)

  useEffect(() => {
    // En reduced-motion on rend `value` directement (cf. `shown`), pas d'animation.
    if (reduce) return
    const controls = animate(fromRef.current, value, {
      duration,
      ease: EASE.out,
      onUpdate: (v) => setDisplay(v),
    })
    fromRef.current = value
    return () => controls.stop()
  }, [value, duration, reduce])

  const shown = reduce ? value : display
  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString('fr-FR'))
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {fmt(shown)}
    </span>
  )
}
