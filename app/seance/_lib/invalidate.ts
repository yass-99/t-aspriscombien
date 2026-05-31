'use client'

import { invalidateExosCache } from './useExos'
import { invalidateHomeDashboard } from './useHomeDashboard'
import { invalidateSeancesSummary } from './useSeancesSummary'
import { invalidateDashboard } from './useDashboard'
import { invalidateHeatmap } from './useHeatmap'

// ═══════════════════════════════════════════════════════════════════════════
// Matrice d'invalidation — un seul point d'entrée après une mutation de séance,
// pour éviter d'oublier un cache (sinon : stats périmées après sauvegarde).
//
//   création / édition / suppression d'une séance muscu
//     → exos (suggestions/flags) + historique (résumé) + accueil + stats
//
// Les runs (athlé) ont leur propre invalidation dans useRuns (invalidateRuns +
// invalidateHomeDashboard), car ils n'affectent ni les exos ni les stats muscu.
// ═══════════════════════════════════════════════════════════════════════════

/** À appeler après tout POST/PUT/DELETE d'une séance de muscu. */
export function invalidateAfterSeanceMutation() {
  invalidateExosCache()
  invalidateSeancesSummary()
  invalidateHomeDashboard()
  invalidateDashboard()
  invalidateHeatmap()
}
