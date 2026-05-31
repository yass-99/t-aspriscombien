'use client'

import { ReactNode, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { WorkoutStep } from '../_lib/types'
import { screenVariants, screenFadeVariants, stepDirection } from '../_lib/motion'

export function StepSwitcher({ step, children }: { step: WorkoutStep; children: ReactNode }) {
  // Direction du slide déduite de l'ordre des écrans (avancer vs reculer),
  // calculée ici pour couvrir TOUS les changements de step (nav + effets).
  // Pattern React officiel : ajuster le state pendant le render quand step change.
  const [prevStep, setPrevStep] = useState<WorkoutStep>(step)
  const [dir, setDir] = useState(1)
  // Vrai pendant qu'un écran glisse. Sert à geler les backdrop-filter (le flou
  // du glass, ré-échantillonné à chaque frame par-dessus les halos flous de
  // AmbientBackground, est le poste de jank #1 sur mobile). cf. globals.css.
  const [animating, setAnimating] = useState(false)

  const reduce = useReducedMotion()

  if (prevStep !== step) {
    setDir(stepDirection(prevStep, step))
    setPrevStep(step)
    if (!reduce) setAnimating(true)
  }

  // exercise_select anime son contenu élément par élément (cascade interne) et
  // garde son CTA bas figé : on l'entre donc en fondu pur, sans le slide qui
  // ferait voyager tout l'écran (bouton compris) d'un bloc.
  const variants = step === 'exercise_select' ? screenFadeVariants : screenVariants

  return (
    <div data-seance-anim={animating ? '' : undefined} style={{ width: '100%' }}>
      <AnimatePresence mode="popLayout" custom={dir} initial={!reduce}>
        <motion.div
          key={step}
          custom={dir}
          variants={variants}
          initial={reduce ? 'animate' : 'initial'}
          animate="animate"
          exit={reduce ? 'animate' : 'exit'}
          onAnimationComplete={() => setAnimating(false)}
          style={{
            width: '100%',
            // Promotion en couche compositeur + isolation des repaints : le slide
            // reste sur le GPU et ne « salit » pas le reste de l'arbre.
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden',
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
