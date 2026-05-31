'use client'

import { CSSProperties, Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react'
import type { Exo, Serie, SessionState, TimerState, WorkoutStep } from '../_lib/types'
import { WORKOUT_TYPES } from '../_lib/constants'
import { formatMMSS, fmtChargeLabel, newId } from '../_lib/helpers'
import { useRestTimer } from '../_lib/useRestTimer'
import { useWakeLock } from '../_lib/useWakeLock'
import { useExos } from '../_lib/useExos'
import { unlockAudio } from '../_lib/restAlert'
import { Button, Card, IconButton, NumericInput, Pill, StopSquare } from '../_components/primitives'
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Dumbbell,
  Plus,
  X,
} from '../_components/icons'

type Props = {
  session: SessionState
  setSession: Dispatch<SetStateAction<SessionState>>
  nav: (s: WorkoutStep) => void
}

// Cascade d'entrée : chaque bloc de l'écran monte en fondu l'un après l'autre
// (même grammaire de mouvement que ConfigScreen / ExerciseSelectScreen).
const ENTER_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const rise = (delayMs: number, durMs = 460): CSSProperties => ({
  animation: `fadeUp ${durMs}ms ${delayMs}ms ${ENTER_EASE} both`,
})

export function LoggingScreen({ session, setSession, nav }: Props) {
  const curExIdx = session.currentExoIndex ?? 0
  const curExo = session.exos?.[curExIdx] || { tempId: '', nom: '—', series: [] as Serie[] }
  const type = WORKOUT_TYPES.find((t) => t.id === session.type)
  const totalExercises = Math.max(4, session.exos?.length || 1)

  const lastSerie = curExo.series[curExo.series.length - 1]
  const { exos: dbExos, loading: exosLoading } = useExos()

  // Récupère la dernière charge/reps connue pour cet exo depuis l'historique.
  const dbMatch = useMemo(() => {
    const nomKey = curExo.nom.trim().toLowerCase()
    if (!nomKey) return null
    return dbExos.find((e) => e.nom.trim().toLowerCase() === nomKey) ?? null
  }, [dbExos, curExo.nom])

  const isPdc = !!curExo.isBodyweight
  const isUni = !!curExo.isUnilateral
  // Sans lest, un exo PDC démarre à 0 (poids du corps seul) ; sinon défaut classique.
  const defaultWeight = isPdc ? 0 : 80

  const [weight, setWeight] = useState<number>(lastSerie?.poids ?? dbMatch?.lastPoids ?? defaultWeight)
  const [reps, setReps] = useState<number | null>(lastSerie?.reps ?? dbMatch?.lastReps ?? 8)
  const [rir, setRir] = useState<number | null>(lastSerie?.rir ?? 2)
  const [degressive, setDegressive] = useState<boolean>(false)

  const exKey = curExo.tempId || curExo.nom

  // Patch des champs de l'exo courant (flags PDC / unilatéral, au niveau exo).
  const patchExo = (patch: Partial<Exo>) =>
    setSession((s) => {
      const exos = [...s.exos]
      exos[curExIdx] = { ...exos[curExIdx], ...patch }
      return { ...s, exos }
    })

  // Pré-remplissage des flags depuis le dernier usage du même exo (une seule fois,
  // tant qu'ils ne sont pas définis — l'utilisateur garde la main ensuite).
  useEffect(() => {
    if (!dbMatch) return
    if (curExo.isBodyweight === undefined || curExo.isUnilateral === undefined) {
      patchExo({
        isBodyweight: curExo.isBodyweight ?? dbMatch.lastIsBodyweight,
        isUnilateral: curExo.isUnilateral ?? dbMatch.lastIsUnilateral,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exKey, dbMatch])

  useEffect(() => {
    const ls = curExo.series[curExo.series.length - 1]
    // Si pas de série précédente dans la session, on retombe sur l'historique DB.
    setWeight(ls?.poids ?? dbMatch?.lastPoids ?? (curExo.isBodyweight ? 0 : 80))
    setReps(ls?.reps ?? dbMatch?.lastReps ?? 8)
    setRir(ls?.rir ?? 2)
    setDegressive(false)
  }, [exKey, curExo.series.length, curExo.isBodyweight, dbMatch])

  const { adjust: adjustTimer } = useRestTimer(session, setSession)
  const status = session.timer.status

  useWakeLock(true)

  const enregistrer = () => {
    unlockAudio()
    const newSerie: Serie = {
      tempId: newId('s'),
      reps,
      poids: weight,
      rir,
      degressive,
    }
    setSession((s) => {
      const exos = [...s.exos]
      exos[curExIdx] = {
        ...exos[curExIdx],
        series: [...exos[curExIdx].series, newSerie],
      }
      return {
        ...s,
        exos,
        currentSerieIndex: exos[curExIdx].series.length,
        timer: {
          remainingSec: s.restTargetSec,
          status: 'running',
          overtimeSec: 0,
          justFinished: false,
          targetEndAt: Date.now() + s.restTargetSec * 1000,
        },
      }
    })
  }

  const nouvelleSerie = () =>
    setSession((s) => ({
      ...s,
      timer: {
        remainingSec: 0,
        status: 'idle',
        overtimeSec: 0,
        justFinished: false,
        targetEndAt: null,
      },
    }))

  const exerciceSuivant = () => {
    setSession((s) => ({
      ...s,
      timer: {
        remainingSec: 0,
        status: 'idle',
        overtimeSec: 0,
        justFinished: false,
        targetEndAt: null,
      },
    }))
    nav('exercise_select')
  }

  const finish = () => {
    setSession((s) => ({
      ...s,
      timer: {
        remainingSec: 0,
        status: 'idle',
        overtimeSec: 0,
        justFinished: false,
        targetEndAt: null,
      },
    }))
    nav('summary')
  }

  const timerActive = status === 'running' || status === 'finished'
  const isMinimised = !!session.timer.minimised

  const setMinimised = (m: boolean) =>
    setSession((s) => ({ ...s, timer: { ...s.timer, minimised: m } }))

  if (timerActive && !isMinimised) {
    return (
      <RestScreen
        timer={session.timer}
        target={session.restTargetSec}
        typeLabel={type?.label}
        curExo={curExo}
        curExIdx={curExIdx}
        totalExercises={totalExercises}
        onAdd={adjustTimer}
        onNouvelleSerie={nouvelleSerie}
        onExerciceSuivant={exerciceSuivant}
        onMinimise={() => setMinimised(true)}
        onClose={() => nav('idle')}
        onFinish={finish}
      />
    )
  }

  const setNumber = curExo.series.length + 1

  return (
    <div
      style={{
        // Hauteur bornée à la zone visible (le conteneur racine ajoute déjà le
        // safe-area haut). Le footer vit DANS le flux en bas de ce conteneur et
        // reste donc collé au viewport ; seul le contenu défile.
        height: 'calc(100dvh - env(safe-area-inset-top, 0px))',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent',
      }}
    >
      {timerActive && isMinimised && (
        <MinimisedTimerBar
          timer={session.timer}
          target={session.restTargetSec}
          onExpand={() => setMinimised(false)}
          onAdd={adjustTimer}
        />
      )}
      <div
        style={{
          padding: '14px 16px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          ...rise(40),
        }}
      >
        <IconButton icon={<X size={16} />} label="quitter" onClick={() => nav('idle')} />
        <div style={{ flex: 1, minWidth: 0, paddingRight: 44 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Séance {type?.label}</span>
            <span style={{ color: 'var(--subtle)' }}>·</span>
            <span
              style={{
                fontSize: 11,
                color: 'var(--brand-bright)',
                fontFamily: 'var(--mono)',
                fontWeight: 600,
              }}
            >
              Série {setNumber}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: -0.4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {curExo.nom}
            </span>
            {isPdc && <Pill tone="accent">PDC</Pill>}
            {isUni && <Pill tone="neutral">uni</Pill>}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 12px', display: 'flex', gap: 5, ...rise(90) }}>
        {Array.from({ length: Math.max(4, curExo.series.length + 1) }).map((_, i) => {
          const done = i < curExo.series.length
          const current = i === curExo.series.length
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: done
                  ? 'var(--brand)'
                  : current
                    ? 'var(--brand-line)'
                    : 'var(--line)',
                transition: 'background 220ms',
              }}
            />
          )
        })}
      </div>

      <div
        className="app-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '4px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Toggles PDC / unilatéral réservés à la CRÉATION d'un exo absent de la DB :
            pour un exo déjà connu, les flags sont fixés (cf. catalogue exercises) et
            servent d'indicatif — l'utilisateur ne les modifie plus ici. L'indication
            reste visible via les Pills PDC/uni dans l'en-tête. */}
        {!exosLoading && !dbMatch && (
          <div style={{ display: 'flex', gap: 8 }}>
            <FlagChip
              label="Poids du corps"
              active={isPdc}
              onClick={() => patchExo({ isBodyweight: !isPdc })}
            />
            <FlagChip
              label="Unilatéral"
              active={isUni}
              onClick={() => patchExo({ isUnilateral: !isUni })}
            />
          </div>
        )}

        <Card style={{ padding: 16, ...rise(140) }}>
          <NumericInput
            size="hero"
            value={weight}
            onChange={(v) => setWeight(v ?? 0)}
            label={isPdc ? 'Lest' : 'Charge'}
            suffix="kg"
            hint={
              isPdc
                ? lastSerie
                  ? `lest préc. ${lastSerie.poids} kg`
                  : 'poids du corps'
                : lastSerie
                  ? `préc. ${lastSerie.poids} kg`
                  : dbMatch?.lastPoids != null
                    ? `histo. ${dbMatch.lastPoids} kg`
                    : null
            }
            step={2.5}
            decimals={1}
            max={500}
            icon={<Dumbbell size={12} color="var(--muted)" />}
          />
        </Card>

        <Card style={{ padding: 14, ...rise(190) }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <NumericInput
              value={reps}
              onChange={setReps}
              label="Reps"
              step={1}
              max={50}
              allowNull
              hint={
                lastSerie
                  ? `×${lastSerie.reps ?? 'JSP'}`
                  : dbMatch?.lastReps != null
                    ? `histo. ×${dbMatch.lastReps}`
                    : null
              }
            />
            <NumericInput
              value={rir}
              onChange={setRir}
              label="RIR"
              step={1}
              max={10}
              allowNull
              hint={lastSerie ? `${lastSerie.rir ?? 'JSP'}` : null}
            />
            <button
              onClick={() => setDegressive(!degressive)}
              aria-pressed={degressive}
              style={{
                flex: 1,
                minWidth: 0,
                appearance: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                background: 'transparent',
                padding: 0,
                gap: 6,
                textAlign: 'left',
                alignItems: 'stretch',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--muted)',
                  fontWeight: 500,
                  letterSpacing: -0.1,
                }}
              >
                Dégressive
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  height: 56,
                  padding: '0 8px',
                  borderRadius: 14,
                  background: degressive ? 'var(--brand)' : 'var(--surface)',
                  color: degressive ? 'var(--brand-ink)' : 'var(--ink-2)',
                  boxShadow: degressive
                    ? '0 8px 22px -8px color-mix(in oklch, var(--brand) 55%, transparent)'
                    : '0 0 0 1px var(--line) inset',
                  transition: 'all 200ms',
                }}
              >
                <DropIcon active={degressive} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{degressive ? 'oui' : 'non'}</span>
              </div>
            </button>
          </div>
        </Card>

        {curExo.series.length > 0 && (
          <div style={{ ...rise(240) }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 4px 8px',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--muted)',
                  fontWeight: 600,
                  letterSpacing: 0.3,
                  textTransform: 'uppercase',
                }}
              >
                Séries
              </span>
              <span style={{ fontSize: 11, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>
                {curExo.series.length} × · vol.{' '}
                {curExo.series
                  .reduce((a, s) => (s.reps == null ? a : a + s.poids * s.reps), 0)
                  .toLocaleString('fr-FR')}{' '}
                kg
              </span>
            </div>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr 56px 36px 24px',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 14px',
                  background: 'var(--line-2)',
                  fontSize: 10,
                  color: 'var(--muted)',
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                <span>#</span>
                <span>Charge × reps</span>
                <span style={{ textAlign: 'right' }}>Volume</span>
                <span style={{ textAlign: 'center' }}>RIR</span>
                <span />
              </div>
              {curExo.series.map((s, i) => (
                <div
                  key={s.tempId || i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr 56px 36px 24px',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
                    fontFamily: 'var(--mono)',
                    // Chaque nouvelle série glisse en fondu à son montage.
                    animation: `fadeUp 300ms ${ENTER_EASE} both`,
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: 'var(--line-2)',
                      color: 'var(--ink-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {i + 1}
                  </div>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--ink)',
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 4,
                    }}
                  >
                    {isPdc ? (
                      <span>{fmtChargeLabel(s.poids, true)}</span>
                    ) : (
                      <>
                        {s.poids}
                        <span style={{ color: 'var(--subtle)', fontWeight: 400, fontSize: 11 }}>
                          kg
                        </span>
                      </>
                    )}
                    <span style={{ color: 'var(--subtle)', fontWeight: 400 }}>×</span>
                    <span style={{ color: s.reps == null ? 'var(--subtle)' : 'var(--ink)' }}>
                      {s.reps == null ? 'JSP' : s.reps}
                    </span>
                    {s.degressive && <DropIcon active size={12} style={{ marginLeft: 4 }} />}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: s.reps == null ? 'var(--subtle)' : 'var(--muted)',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {s.reps == null ? '—' : (s.poids * s.reps).toLocaleString('fr-FR')}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: s.rir == null ? 'var(--subtle)' : 'var(--ink-2)',
                      textAlign: 'center',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {s.rir == null ? 'JSP' : s.rir}
                  </span>
                  <Check size={13} color="var(--brand-bright)" />
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: '14px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)',
          background: 'linear-gradient(180deg, transparent, var(--bg) 30%)',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            ...rise(300),
          }}
        >
          {/* Trois actions groupées en bas : « Exo suivant » et « Stop » côte à
              côte, « Enregistrer » (la plus fréquente) pleine largeur au plus
              près du pouce. « Stop » clôture directement la séance (= Terminer),
              sans confirmation. */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="secondary"
              onClick={exerciceSuivant}
              trailingIcon={<ChevronRight size={16} />}
              style={{ flex: 1 }}
            >
              Exo suivant
            </Button>
            <StopButton onClick={finish} />
          </div>
          <Button onClick={enregistrer} icon={<Check size={16} />}>
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  )
}

// Bouton « Stop » : clôture la séance directement (= « Terminer »), sans modal.
// Ton danger, libellé explicite, posé en bas à côté de « Exo suivant ».
function StopButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      aria-label="Terminer la séance"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="tap"
      style={{
        height: 52,
        flexShrink: 0,
        padding: '0 20px',
        borderRadius: 16,
        border: 'none',
        cursor: 'pointer',
        background: hover
          ? 'color-mix(in oklch, var(--danger) 18%, var(--surface))'
          : 'var(--surface)',
        color: 'var(--danger)',
        boxShadow: '0 0 0 1px color-mix(in oklch, var(--danger) 28%, var(--hairline)) inset',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 15,
        fontWeight: 600,
        transition: 'background 140ms',
      }}
    >
      <StopSquare size={15} color="var(--danger)" />
      Stop
    </button>
  )
}

// ══════════════════════════════════════════════════════════════════
// REST SCREEN
// ══════════════════════════════════════════════════════════════════
function RestScreen({
  timer,
  target,
  typeLabel,
  curExo,
  curExIdx,
  totalExercises,
  onAdd,
  onNouvelleSerie,
  onExerciceSuivant,
  onMinimise,
  onClose,
  onFinish,
}: {
  timer: TimerState
  target: number
  typeLabel?: string
  curExo: Exo | { tempId: string; nom: string; series: Serie[]; isBodyweight?: boolean; isUnilateral?: boolean }
  curExIdx: number
  totalExercises: number
  onAdd: (delta: number) => void
  onNouvelleSerie: () => void
  onExerciceSuivant: () => void
  onMinimise: () => void
  onClose: () => void
  onFinish: () => void
}) {
  const done = timer.status === 'finished'
  const remaining = timer.remainingSec
  const overtime = timer.overtimeSec || 0
  const pct = done ? 0 : 1 - remaining / target

  const RING_W = 220
  const STROKE = 9
  const R = (RING_W - STROKE) / 2
  const C = 2 * Math.PI * R
  const dashOffset = C * pct

  const justLogged = curExo.series[curExo.series.length - 1]
  const setNumberJustDone = curExo.series.length
  const exerciseNumber = curExIdx + 1

  return (
    <div
      style={{
        position: 'relative',
        height: 'calc(100dvh - env(safe-area-inset-top, 0px))',
        overflow: 'hidden',
        width: '100%',
        // Halo ambiant violet en taches radiales (même grammaire que
        // AmbientBackground, cf. DESIGN §4) : c'est cette matière que le panneau
        // en verre dépoli diffuse en arrière-plan. Renforcé à la fin du repos.
        // La tache centrée (50% 52%) est volontaire : elle passe DERRIÈRE le panneau
        // en verre pour lui donner de la matière violette à diffuser (sinon le blur
        // ne capte qu'un fond sombre au centre). Les autres taches habillent les bords.
        background: done
          ? 'radial-gradient(70% 50% at 50% 0%, color-mix(in oklch, var(--brand) 30%, transparent) 0%, transparent 72%), radial-gradient(54% 46% at 50% 52%, color-mix(in oklch, var(--brand) 22%, transparent) 0%, transparent 72%), radial-gradient(45% 32% at 85% 8%, color-mix(in oklch, var(--brand-2, var(--brand)) 20%, transparent) 0%, transparent 70%), radial-gradient(52% 36% at 14% 14%, color-mix(in oklch, var(--brand) 16%, transparent) 0%, transparent 72%), var(--bg)'
          : 'radial-gradient(62% 42% at 50% 0%, color-mix(in oklch, var(--brand) 20%, transparent) 0%, transparent 70%), radial-gradient(50% 42% at 50% 52%, color-mix(in oklch, var(--brand) 14%, transparent) 0%, transparent 72%), radial-gradient(42% 30% at 85% 8%, color-mix(in oklch, var(--brand-2, var(--brand)) 14%, transparent) 0%, transparent 70%), radial-gradient(50% 34% at 14% 14%, color-mix(in oklch, var(--brand) 11%, transparent) 0%, transparent 72%), var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeUp 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
        transition: 'background 600ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 4px' }}>
        <IconButton
          icon={<ChevronDown size={18} />}
          label="réduire le minuteur"
          onClick={onMinimise}
        />
        <div style={{ flex: 1, textAlign: 'center', paddingRight: 44 }}>
          <div
            style={{
              fontSize: 10,
              color: 'var(--muted)',
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            {done ? 'Repos terminé' : 'Repos'}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--subtle)',
              marginTop: 1,
              fontFamily: 'var(--mono)',
            }}
          >
            {typeLabel} · Exo {exerciseNumber}/{totalExercises} · Série {setNumberJustDone}
          </div>
        </div>
      </div>

      {justLogged && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '14px 16px 0',
            animation: 'fadeUp 400ms 160ms both',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px 6px 8px',
              borderRadius: 999,
              background: 'var(--surface)',
              boxShadow: '0 0 0 1px var(--line) inset',
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: 'var(--brand)',
                color: 'var(--brand-ink)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={11} stroke={3} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
              {curExo.nom} ·{' '}
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink)', fontWeight: 600 }}>
                {fmtChargeLabel(justLogged.poids, curExo.isBodyweight)} × {justLogged.reps ?? 'JSP'}
              </span>
              <span style={{ color: 'var(--subtle)' }}> · RIR {justLogged.rir ?? 'JSP'}</span>
            </span>
          </div>
        </div>
      )}

      <div
        className="app-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '24px 20px',
        }}
      >
        {/* Panneau en verre dépoli posé sur le halo violet ambiant (cf. DESIGN §2 :
            cartes en glass, jamais sur du noir plat). Élévation par hairline + highlight,
            sans drop-shadow (§3). */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 22,
            padding: '34px 30px 28px',
            borderRadius: 32,
            background: 'var(--glass-strong)',
            backdropFilter: 'blur(22px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(22px) saturate(1.5)',
            boxShadow:
              '0 0 0 1px var(--glass-border) inset, 0 1px 0 0 var(--glass-highlight) inset',
            animation: 'fadeUp 420ms 80ms cubic-bezier(0.22, 1, 0.36, 1) both',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: RING_W,
              height: RING_W,
              animation: timer.justFinished ? 'ringPulse 700ms ease-out' : 'none',
            }}
          >
          <svg
            width={RING_W}
            height={RING_W}
            style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
          >
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--brand-bright)" />
                <stop offset="100%" stopColor="var(--brand)" />
              </linearGradient>
            </defs>
            <circle
              cx={RING_W / 2}
              cy={RING_W / 2}
              r={R}
              stroke="var(--line)"
              strokeWidth={STROKE}
              fill="none"
            />
            <circle
              cx={RING_W / 2}
              cy={RING_W / 2}
              r={R}
              stroke={done ? 'var(--brand-bright)' : 'url(#ringGrad)'}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={C}
              strokeDashoffset={done ? 0 : C - dashOffset}
              style={{
                transition: 'stroke-dashoffset 1000ms linear, stroke 400ms',
                animation: done ? 'ringIdle 2.4s ease-in-out infinite' : 'none',
              }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 60,
                fontWeight: 600,
                letterSpacing: -2.5,
                lineHeight: 1,
                color: done ? 'var(--brand-bright)' : 'var(--ink)',
                transition: 'color 300ms',
                fontVariantNumeric: 'tabular-nums',
                animation: timer.justFinished ? 'pulse 600ms ease' : 'none',
              }}
            >
              {done ? `+${formatMMSS(overtime)}` : formatMMSS(remaining)}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--subtle)',
                marginTop: 6,
                fontFamily: 'var(--mono)',
              }}
            >
              {done ? 'temps écoulé' : `cible ${formatMMSS(target)}`}
            </div>
          </div>
        </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onAdd(-15)} style={{ ...timerChipStyle, color: 'var(--muted)' }}>
              −15s
            </button>
            <button onClick={() => onAdd(10)} style={timerChipStyle}>
              +10s
            </button>
            <button onClick={() => onAdd(30)} style={timerChipStyle}>
              +30s
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '14px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)',
          background: 'linear-gradient(180deg, transparent, var(--bg) 30%)',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              onClick={onExerciceSuivant}
              variant="secondary"
              trailingIcon={<ChevronRight size={16} />}
              style={{ flex: 1 }}
            >
              Exo suivant
            </Button>
            <StopButton onClick={onFinish} />
          </div>
          <Button onClick={onNouvelleSerie} icon={<Plus size={16} />}>
            Nouvelle série
          </Button>
        </div>
      </div>
    </div>
  )
}

const timerChipStyle: CSSProperties = {
  height: 38,
  padding: '0 16px',
  borderRadius: 999,
  border: 'none',
  background: 'var(--surface)',
  boxShadow: '0 0 0 1px var(--line) inset',
  fontFamily: 'var(--mono)',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--ink-2)',
  cursor: 'pointer',
  transition: 'all 140ms',
}

// Chip toggle au niveau exo (PDC / unilatéral), aligné sur le style « Dégressive ».
function FlagChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: 1,
        minWidth: 0,
        appearance: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 44,
        padding: '0 12px',
        borderRadius: 12,
        background: active ? 'var(--brand)' : 'var(--surface)',
        color: active ? 'var(--brand-ink)' : 'var(--ink-2)',
        boxShadow: active
          ? '0 8px 22px -8px color-mix(in oklch, var(--brand) 55%, transparent)'
          : '0 0 0 1px var(--line) inset',
        fontSize: 13,
        fontWeight: 600,
        transition: 'all 200ms',
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 5,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: active ? 'var(--brand-ink)' : 'transparent',
          color: active ? 'var(--brand)' : 'var(--muted)',
          boxShadow: active ? 'none' : '0 0 0 1.5px var(--line) inset',
          flexShrink: 0,
        }}
      >
        {active && <Check size={11} stroke={3} />}
      </span>
      {label}
    </button>
  )
}

function DropIcon({
  active = false,
  size = 14,
  style = {},
}: {
  active?: boolean
  size?: number
  style?: CSSProperties
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden>
      <path
        d="M5 5l14 14M12 19h7v-7"
        stroke={active ? 'var(--brand-ink)' : 'currentColor'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════════
// MINIMISED TIMER BAR
// ══════════════════════════════════════════════════════════════════
function MinimisedTimerBar({
  timer,
  target,
  onExpand,
  onAdd,
}: {
  timer: TimerState
  target: number
  onExpand: () => void
  onAdd: (delta: number) => void
}) {
  const done = timer.status === 'finished'
  const remaining = timer.remainingSec
  const overtime = timer.overtimeSec || 0
  const pct = done ? 1 : Math.max(0, Math.min(1, 1 - remaining / target))

  return (
    <div
      role="region"
      aria-label="Minuteur de repos réduit"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: done
          ? 'color-mix(in oklch, var(--brand) 22%, var(--surface))'
          : 'var(--surface)',
        boxShadow: '0 0 0 1px var(--line) inset, 0 8px 24px -10px rgba(0,0,0,0.50)',
        animation: 'fadeUp 220ms ease both',
      }}
    >
      <button
        onClick={onExpand}
        aria-label="Agrandir le minuteur"
        style={{
          width: '100%',
          appearance: 'none',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: '10px 14px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: 'var(--ink)',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 34,
            height: 34,
            borderRadius: 999,
            background: 'var(--surface-2)',
            color: done ? 'var(--brand-bright)' : 'var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
            animation: timer.justFinished ? 'pulse 600ms ease' : 'none',
          }}
        >
          {done ? `+${overtime}` : remaining}
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div
            style={{
              fontSize: 10,
              color: 'var(--muted)',
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            {done ? 'Repos terminé' : 'Repos en cours'}
          </div>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: -0.2,
              color: done ? 'var(--brand-bright)' : 'var(--ink)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {done ? `+${formatMMSS(overtime)}` : formatMMSS(remaining)}
            <span style={{ color: 'var(--subtle)', fontWeight: 400, marginLeft: 6 }}>
              {done ? '— prêt' : `/ ${formatMMSS(target)}`}
            </span>
          </div>
        </div>
        <div
          onClick={(e) => {
            e.stopPropagation()
            onAdd(15)
          }}
          role="button"
          tabIndex={0}
          aria-label="ajouter 15 secondes"
          style={{
            height: 30,
            padding: '0 10px',
            borderRadius: 999,
            background: 'var(--surface-2)',
            color: 'var(--ink-2)',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          +15s
        </div>
        <ChevronUp size={16} color="var(--muted)" />
      </button>
      <div
        style={{
          height: 2,
          width: '100%',
          background: 'var(--line-2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct * 100}%`,
            background: done ? 'var(--brand-bright)' : 'var(--brand)',
            transition: 'width 600ms linear',
          }}
        />
      </div>
    </div>
  )
}
