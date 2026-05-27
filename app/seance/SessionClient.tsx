'use client'

import { useState } from 'react'
import type { NavContext, SessionState, WorkoutStep } from './_lib/types'
import { StepSwitcher } from './_components/StepSwitcher'
import { IdleScreen } from './_screens/IdleScreen'
import { ConfigScreen } from './_screens/ConfigScreen'
import { ExerciseSelectScreen } from './_screens/ExerciseSelectScreen'
import { LoggingScreen } from './_screens/LoggingScreen'
import { SummaryScreen } from './_screens/SummaryScreen'
import { StatsScreen } from './_screens/StatsScreen'
import { HistoryScreen } from './_screens/HistoryScreen'
import { SessionDetailScreen } from './_screens/SessionDetailScreen'
import { ManualEntryScreen } from './_screens/ManualEntryScreen'
import { AthleticsScreen } from './_screens/AthleticsScreen'

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
  const [selectedSeanceId, setSelectedSeanceId] = useState<string | null>(null)
  const [athleticsInitialView, setAthleticsInitialView] = useState<'hub' | 'chrono'>(
    'chrono',
  )

  const resetSession = () => setSession(initialSession())
  const nav = (s: WorkoutStep, ctx?: NavContext) => {
    if (ctx && 'seanceId' in ctx) setSelectedSeanceId(ctx.seanceId ?? null)
    if (ctx?.athleticsView) setAthleticsInitialView(ctx.athleticsView)
    setStep(s)
  }

  return (
    <div
      style={{
        maxWidth: 480,
        margin: '0 auto',
        minHeight: '100dvh',
        background: 'var(--bg)',
        position: 'relative',
        paddingTop: 'env(safe-area-inset-top, 0px)',
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
        {step === 'history' && <HistoryScreen nav={nav} />}
        {step === 'session_detail' && (
          <SessionDetailScreen seanceId={selectedSeanceId} nav={nav} />
        )}
        {step === 'manual_entry' && (
          <ManualEntryScreen seanceId={selectedSeanceId} nav={nav} />
        )}
        {step === 'athletics' && (
          <AthleticsScreen nav={nav} initialView={athleticsInitialView} />
        )}
      </StepSwitcher>
    </div>
  )
}
