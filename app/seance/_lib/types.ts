export type WorkoutStep =
  | 'idle'
  | 'config'
  | 'exercise_select'
  | 'logging'
  | 'stats'
  | 'summary'
  | 'history'
  | 'session_detail'
  | 'manual_entry'
  | 'athletics'
  | 'athletics_summary'
  | 'athletics_detail'

export type Run = {
  id: string
  date: string
  distance_m: number
  duration_ms: number
  created_at: string
  // FK vers athletics_sessions. NULL pour les runs créés avant l'introduction
  // des sessions persistées (regroupés alors par heuristique côté lecture).
  session_id: string | null
}

export type NavContext = {
  seanceId?: string | null
  // Distance pré-sélectionnée pour ChronoView (depuis Stats Athlé → drill-down).
  // Si absent, ChronoView ouvre sur la dernière distance utilisée.
  athleticsDistance?: number
  // IDs des runs qui composent la « séance » à récapituler.
  // Renseigné par AthleticsScreen quand l'utilisateur termine sa session,
  // ou par HistoryScreen quand on consulte une séance athlé passée.
  athleticsRunIds?: string[]
  // Sous-étape sur laquelle (ré)ouvrir le ConfigScreen. Permet au retour depuis
  // exercise_select de retomber sur l'étape « chrono » plutôt que « type ».
  configStep?: 'type' | 'chrono'
  // Type pré-rempli depuis une séance planifiée : ConfigScreen s'ouvre au chrono
  // avec ce type déjà choisi (cas muscu uniquement ; l'athlé route vers 'athletics').
  plannedType?: string
}

export type NavFn = (step: WorkoutStep, ctx?: NavContext) => void

// Amplitude de mouvement (ROM) d'une série. L'absence de valeur (undefined/null)
// dénote une amplitude « complète » — jamais stockée explicitement.
export type Amplitude = '90' | 'partielle'

export type Serie = {
  tempId: string
  // null = série « non comptée » — ignorée dans les calculs et exclue à l'enregistrement.
  reps: number | null
  poids: number
  rir: number | null
  degressive: boolean
  // null/undefined = amplitude complète (cas par défaut, masqué dans l'export).
  amplitude?: Amplitude | null
}

export type Exo = {
  tempId: string
  nom: string
  // Poids du corps : la charge saisie par série représente le lest (0 = sans lest).
  isBodyweight?: boolean
  // Exercice unilatéral — indication seule, aucun impact sur les calculs.
  isUnilateral?: boolean
  // Superset : token partagé par les exos d'un même groupe alterné (null = solo).
  supersetId?: string | null
  series: Serie[]
}

export type TimerStatus = 'idle' | 'running' | 'finished'

export type TimerState = {
  remainingSec: number
  status: TimerStatus
  overtimeSec: number
  justFinished: boolean
  minimised?: boolean
  // Wall-clock timestamp (ms since epoch) when the rest period ends.
  // The tick recomputes remainingSec from this — resilient to backgrounded tabs.
  targetEndAt?: number | null
}

export type SessionState = {
  type: string
  restTargetSec: number
  exos: Exo[]
  currentExoIndex: number
  currentSerieIndex: number
  timer: TimerState
}
