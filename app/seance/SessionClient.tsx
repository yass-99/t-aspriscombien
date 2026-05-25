'use client'

import { useState } from 'react'
import type { SessionState, WorkoutStep } from './_lib/types'
import { StepSwitcher } from './_components/StepSwitcher'
import { IdleScreen } from './_screens/IdleScreen'
import { ConfigScreen } from './_screens/ConfigScreen'
import { ExerciseSelectScreen } from './_screens/ExerciseSelectScreen'
import { LoggingScreen } from './_screens/LoggingScreen'
import { SummaryScreen } from './_screens/SummaryScreen'
import { StatsScreen } from './_screens/StatsScreen'

const DEFAULT_REST = 90

function initialSession(): SessionState {
  return {
    type: '',
    restTargetSec: DEFAULT_REST,
    exos: [],
    currentExoIndex: 0,
    currentSerieIndex: 0,
    timer: {
      remainingSec: 0,
      status: 'idle',
      overtimeSec: 0,
      justFinished: false,
    },
  }
}

export default function SessionClient() {
  const [step, setStep] = useState<WorkoutStep>('idle')
  const [session, setSession] = useState<SessionState>(initialSession)

  const resetSession = () => setSession(initialSession())
  const nav = (s: WorkoutStep) => setStep(s)

  return (
    <div
      style={{
        maxWidth: 480,
        margin: '0 auto',
        minHeight: 'calc(100dvh - 60px)',
        background: 'var(--bg)',
        position: 'relative',
      }}
    >
      <StepSwitcher step={step}>
        {step === 'idle' && <IdleScreen session={session} nav={nav} />}
        {step === 'config' && (
          <ConfigScreen session={session} setSession={setSession} nav={nav} />
        )}
        {step === 'exercise_select' && (
          <ExerciseSelectScreen session={session} setSession={setSession} nav={nav} />
        )}
        {step === 'logging' && (
          <LoggingScreen session={session} setSession={setSession} nav={nav} />
        )}
        {step === 'summary' && (
          <SummaryScreen
            session={session}
            setSession={setSession}
            nav={nav}
            resetSession={resetSession}
          />
        )}
        {step === 'stats' && <StatsScreen session={session} nav={nav} />}
      </StepSwitcher>
    </div>
  )
}
