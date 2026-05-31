'use client'

import { useEffect, useState } from 'react'
import { track } from '@vercel/analytics'
import type { NavContext, SessionState, WorkoutStep } from './_lib/types'
import { StepSwitcher } from './_components/StepSwitcher'
import { AmbientBackground } from './_components/AmbientBackground'
import { OnboardingProfileModal } from './_components/OnboardingProfileModal'
import { useProfile } from './_lib/useProfile'
import { useOnboardingDismiss, dismissOnboarding } from './_lib/useOnboardingDismiss'
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
import { AthleticsSummaryScreen } from './_screens/AthleticsSummaryScreen'
import { AthleticsDetailScreen } from './_screens/athletisme_detail'

const DEFAULT_REST = 90

// Catégorie de chaque écran, pour filtrer les vues par domaine dans Vercel Analytics.
const SCREEN_CATEGORY: Record<WorkoutStep, 'muscu' | 'athletisme' | 'global'> = {
  idle: 'global',
  stats: 'global',
  history: 'global',
  config: 'muscu',
  exercise_select: 'muscu',
  logging: 'muscu',
  summary: 'muscu',
  session_detail: 'muscu',
  manual_entry: 'muscu',
  athletics: 'athletisme',
  athletics_summary: 'athletisme',
  athletics_detail: 'athletisme',
}

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
  const [athleticsInitialDistance, setAthleticsInitialDistance] = useState<number | null>(null)
  const [athleticsRunIds, setAthleticsRunIds] = useState<string[]>([])
  const [athleticsSummaryOrigin, setAthleticsSummaryOrigin] = useState<'live' | 'history'>('live')
  // Sous-étape d'ouverture du ConfigScreen (type par défaut, chrono au retour
  // depuis exercise_select).
  const [configInitialStep, setConfigInitialStep] = useState<'type' | 'chrono'>('type')

  // Deep-link : /seance?screen=stats ouvre directement les stats (lien depuis Réglages).
  // Lu après le montage pour éviter un mismatch d'hydratation (window indisponible en SSR).
  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get('screen')
    if (target === 'stats') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep('stats')
      // Nettoie l'URL pour que le retour navigateur ne ré-ouvre pas les stats.
      window.history.replaceState(null, '', '/seance')
    }
  }, [])

  // Vues d'écran pour Vercel Analytics : la navigation se fait par changement
  // d'étape (et non de route), donc on émet un événement custom à chaque écran
  // pour pouvoir analyser le trafic page par page dans le dashboard.
  useEffect(() => {
    track('screen_view', { screen: step, category: SCREEN_CATEGORY[step] })
  }, [step])

  const { profile, loading: profileLoading } = useProfile()
  const onboardingDismissed = useOnboardingDismiss()
  // useProfile() hydrate son state depuis localStorage côté client uniquement :
  // sans ce flag mounted, le modal apparaîtrait dès le premier render client
  // (cache déjà chaud) alors que le SSR aurait rendu loading=true → mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])
  const needsOnboarding =
    mounted &&
    !profileLoading &&
    (profile === null ||
      profile.sexe === null ||
      profile.tailleCm === null ||
      profile.birthDate === null)

  const resetSession = () => setSession(initialSession())
  const nav = (s: WorkoutStep, ctx?: NavContext) => {
    if (ctx && 'seanceId' in ctx) setSelectedSeanceId(ctx.seanceId ?? null)
    // Distance pré-sélectionnée : null par défaut → ChronoView utilise la dernière utilisée.
    setAthleticsInitialDistance(ctx?.athleticsDistance ?? null)
    setConfigInitialStep(ctx?.configStep ?? 'type')
    if (ctx?.athleticsRunIds) {
      setAthleticsRunIds(ctx.athleticsRunIds)
      // Provenance déduite de l'écran qui déclenche : history → 'history', sinon 'live'.
      setAthleticsSummaryOrigin(s === 'athletics_summary' && step === 'history' ? 'history' : 'live')
    }
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
      <AmbientBackground />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <StepSwitcher step={step}>
        {step === 'idle' && <IdleScreen session={session} nav={nav} />}
        {step === 'config' && (
          <ConfigScreen
            session={session}
            setSession={setSession}
            nav={nav}
            initialStep={configInitialStep}
          />
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
          <AthleticsScreen nav={nav} initialDistance={athleticsInitialDistance} />
        )}
        {step === 'athletics_summary' && (
          <AthleticsSummaryScreen
            runIds={athleticsRunIds}
            origin={athleticsSummaryOrigin}
            nav={nav}
          />
        )}
        {step === 'athletics_detail' && (
          <AthleticsDetailScreen runIds={athleticsRunIds} nav={nav} />
        )}
        </StepSwitcher>
      </div>
      {needsOnboarding && !onboardingDismissed && (
        <OnboardingProfileModal
          profile={profile}
          onDismiss={() => dismissOnboarding()}
        />
      )}
    </div>
  )
}
