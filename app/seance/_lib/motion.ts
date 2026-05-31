// Tokens de mouvement — source de vérité des transitions (cf. DESIGN.md §7).
// La fluidité EST le produit : chaque animation exprime une cause → effet,
// jamais décoratif, toujours interruptible. Transform/opacity uniquement (60fps).

import type { Transition, Variants } from 'motion/react'

// --- Durées (secondes) ------------------------------------------------------
export const DUR = {
  micro: 0.18, // press, hover, toggles
  base: 0.28, // entrée d'élément, fade
  screen: 0.36, // transition d'écran (StepSwitcher)
  exit: 0.2, // sortie ~65% de l'entrée → plus vif
} as const

// --- Easing -----------------------------------------------------------------
export const EASE = {
  out: [0.22, 1, 0.36, 1], // entrée (décélération)
  in: [0.4, 0, 1, 1], // sortie (accélération)
} as const

// Spring physique — « feel » premium pour press / sheets.
export const SPRING: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 32,
  mass: 0.9,
}

// --- Transitions prêtes à l'emploi -----------------------------------------
export const tEnter: Transition = { duration: DUR.base, ease: EASE.out }
export const tExit: Transition = { duration: DUR.exit, ease: EASE.in }
export const tScreen: Transition = { duration: DUR.screen, ease: EASE.out }

// Press feedback : scale léger sur cartes/boutons tappables.
export const pressable = {
  whileTap: { scale: 0.97 },
  transition: SPRING,
} as const

// Entrée fade + léger lift, sortie plus vive.
export const fadeUp: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: tEnter },
  exit: { opacity: 0, y: -6, transition: tExit },
}

// Transition d'écran directionnelle (StepSwitcher).
// dir = +1 → avancer (entre par la droite), -1 → reculer (entre par la gauche).
export const screenVariants: Variants = {
  initial: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 24 : -24 }),
  animate: { opacity: 1, x: 0, transition: tEnter },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir >= 0 ? -24 : 24,
    transition: { duration: 0.18, ease: EASE.in },
  }),
}

// Transition d'écran en fondu PUR (aucun glissement horizontal). Réservée aux
// écrans qui orchestrent eux-mêmes l'entrée de leur contenu élément par élément
// (cascade fadeUp) tout en gardant leur CTA bas parfaitement immobile : sans
// translation, le bouton ne « voyage » pas avec le reste, il dépend de rien.
export const screenFadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: tEnter },
  exit: { opacity: 0, transition: { duration: 0.18, ease: EASE.in } },
}

// Stagger pour les listes : 30–50ms par item, jamais tout d'un coup.
export const staggerList: Variants = {
  animate: { transition: { staggerChildren: 0.04 } },
}

// Sheets / modals : animent depuis le bas (slide + fade), scrim géré à part.
export const sheetVariants: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { ...SPRING, mass: 1 } },
  exit: { opacity: 0, y: 24, transition: tExit },
}

// Ordre des écrans pour calculer la direction du slide (avancer vs reculer).
// Index croissant = on avance dans le flux.
export const STEP_ORDER = [
  'idle',
  'config',
  'exercise_select',
  'logging',
  'summary',
  'stats',
  'history',
  'session_detail',
  'manual_entry',
  'athletics',
  'athletics_summary',
] as const

export function stepDirection(from: string, to: string): number {
  const a = STEP_ORDER.indexOf(from as (typeof STEP_ORDER)[number])
  const b = STEP_ORDER.indexOf(to as (typeof STEP_ORDER)[number])
  if (a === -1 || b === -1) return 1
  return b >= a ? 1 : -1
}
