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
}

export type NavFn = (step: WorkoutStep, ctx?: NavContext) => void

export type Serie = {
  tempId: string
  // null = série « non comptée » — ignorée dans les calculs et exclue à l'enregistrement.
  reps: number | null
  poids: number
  rir: number | null
  degressive: boolean
}

export type Exo = {
  tempId: string
  nom: string
  // Poids du corps : la charge saisie par série représente le lest (0 = sans lest).
  isBodyweight?: boolean
  // Exercice unilatéral — indication seule, aucun impact sur les calculs.
  isUnilateral?: boolean
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
