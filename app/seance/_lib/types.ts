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

export type Run = {
  id: string
  date: string
  distance_m: number
  duration_ms: number
  created_at: string
}

export type NavContext = {
  seanceId?: string | null
  // Vue d'entrée pour AthleticsScreen :
  //   - 'chrono' (depuis Idle Sprint) → ouvre directement le timer
  //   - 'hub' (depuis Stats « Voir tout ») → ouvre l'historique
  athleticsView?: 'hub' | 'chrono'
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
