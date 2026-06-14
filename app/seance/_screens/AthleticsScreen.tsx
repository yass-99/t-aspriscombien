'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { NavFn } from '../_lib/types'
import { useRuns } from '../_lib/useRuns'
import {
  DISTANCE_MAX_M,
  DISTANCE_MIN_M,
  DISTANCE_PRESETS_M,
  formatChrono,
  summarizeByDistance,
} from '../_lib/runs'
import { Button, Card, IconButton, StopSquare, TopBar } from '../_components/primitives'
import { Check, ChevronRight, Timer, Trash, X } from '../_components/icons'
import { LetterReveal } from '../_components/LetterReveal'
import { useToast } from '../../_components/Toast'
import { useWakeLock } from '../_lib/useWakeLock'

type Props = {
  nav: NavFn
  // Distance pré-sélectionnée (depuis Stats Athlé → drill-down). Si null, on
  // utilise la dernière distance utilisée dans l'historique.
  initialDistance?: number | null
}

const DEFAULT_DISTANCE = 100

// Hauteur réellement disponible : le conteneur racine (SessionClient) applique
// déjà un paddingTop = safe-area-inset-top. Un écran en `100dvh` déborderait donc
// le viewport de cette marge et pousserait le footer sous la ligne de flottaison
// (il faut scroller pour l'atteindre). On retranche l'inset haut pour que chaque
// écran tienne pile dans la zone visible, footer compris.
const SCREEN_H = 'calc(100dvh - env(safe-area-inset-top, 0px))'

export function AthleticsScreen({ nav, initialDistance = null }: Props) {
  const { runs, loading, error, saveSession } = useRuns()
  const toast = useToast()
  const initializedRef = useRef(false)
  // Default immédiat à initialDistance ou 100m pour éviter un fallback pendant
  // le chargement des runs. Sera écrasé par la distance du dernier run dès que
  // `runs` arrive si aucune distance n'a été imposée explicitement.
  const [selectedDistance, setSelectedDistance] = useState<number>(
    initialDistance ?? DEFAULT_DISTANCE,
  )
  // Chronos accumulés en mémoire pendant la séance. Aucun n'est persisté en DB
  // tant que l'utilisateur ne clique pas « Finir la séance » — on save tout en
  // batch à ce moment-là (préférence utilisateur : pas de save intermédiaire).
  const [pendingRuns, setPendingRuns] = useState<
    Array<{ distance_m: number; duration_ms: number }>
  >([])
  const [batchSaving, setBatchSaving] = useState(false)
  // Écran intermédiaire « choix de distance » vs chrono pur. On garde ces deux
  // vues dans le même composant pour que pendingRuns/selectedDistance survivent
  // au va-et-vient (changer de distance entre deux courses ne perd rien).
  // Si une distance est imposée (drill-down depuis Stats), on saute le setup.
  const [phase, setPhase] = useState<'distance' | 'chrono' | 'review'>(
    initialDistance != null ? 'chrono' : 'distance',
  )

  useEffect(() => {
    if (error) toast.warn(error)
  }, [error, toast])

  // À la première arrivée, basculer sur la dernière distance utilisée si on
  // n'a pas reçu de distance explicite. Ne se déclenche qu'une fois pour ne
  // pas écraser un changement utilisateur ultérieur via le DistancePicker.
  useEffect(() => {
    if (initializedRef.current) return
    if (loading) return
    initializedRef.current = true
    if (initialDistance != null) return
    const lastRun = runs[0]
    if (lastRun) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedDistance(lastRun.distance_m)
    }
  }, [loading, initialDistance, runs])

  const summaries = useMemo(() => summarizeByDistance(runs), [runs])
  const userDistances = useMemo(() => summaries.map((s) => s.distance_m), [summaries])

  // Persiste toute la séance en un seul appel : le serveur crée la session athlé
  // parente et rattache tous les chronos via session_id (atomique — soit tout
  // passe, soit rien). Puis on navigue vers le récap avec les IDs renvoyés.
  const persistAndFinish = async (
    runsToSave: Array<{ distance_m: number; duration_ms: number }>,
  ) => {
    if (runsToSave.length === 0) return
    setBatchSaving(true)
    try {
      const { runIds } = await saveSession(runsToSave)
      nav('athletics_summary', { athleticsRunIds: runIds })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur enregistrement')
      setBatchSaving(false)
    }
  }

  if (phase === 'distance') {
    return (
      <DistanceSetupView
        distance={selectedDistance}
        userDistances={userDistances}
        sessionRunCount={pendingRuns.length}
        disabled={batchSaving}
        onChangeDistance={(d) => setSelectedDistance(d)}
        onCancel={() => nav('idle')}
        onContinue={() => setPhase('chrono')}
      />
    )
  }

  if (phase === 'review') {
    return (
      <SessionReviewView
        runs={pendingRuns}
        saving={batchSaving}
        onDeleteRun={(i) => setPendingRuns((rs) => rs.filter((_, idx) => idx !== i))}
        onBack={() => setPhase('chrono')}
        onValidate={() => persistAndFinish(pendingRuns)}
      />
    )
  }

  return (
    <ChronoView
      distance={selectedDistance}
      sessionRunCount={pendingRuns.length}
      batchSaving={batchSaving}
      onCancel={() => nav('idle')}
      onEditDistance={() => setPhase('distance')}
      onNextRun={(ms) => {
        setPendingRuns((rs) => [
          ...rs,
          { distance_m: selectedDistance, duration_ms: ms },
        ])
      }}
      // « Finir » ne sauvegarde plus : on ajoute le chrono courant à la file et
      // on bascule sur l'écran de validation. La persistance batch n'a lieu
      // qu'au clic « Valider » dans SessionReviewView.
      onFinishWithRun={async (ms) => {
        setPendingRuns((rs) => [...rs, { distance_m: selectedDistance, duration_ms: ms }])
        setPhase('review')
      }}
      onFinishExisting={
        pendingRuns.length > 0 ? () => setPhase('review') : undefined
      }
    />
  )
}

// ══════════════════════════════════════════════════════════════════
// CHRONO
// ══════════════════════════════════════════════════════════════════
type ChronoStatus = 'idle' | 'running' | 'stopped'
type PendingAction = 'next' | 'finish' | null

function ChronoView({
  distance,
  sessionRunCount,
  batchSaving,
  onCancel,
  onNextRun,
  onFinishWithRun,
  onFinishExisting,
  onEditDistance,
}: {
  distance: number
  // Nombre de chronos déjà mémorisés pour cette séance (afficher le pill
  // « Terminer » dans la TopBar entre deux courses).
  sessionRunCount: number
  // True pendant la persistance batch finale (désactive tous les boutons).
  batchSaving: boolean
  onCancel: () => void
  // Ajoute le chrono courant à la file en mémoire (pas de save DB).
  onNextRun: (ms: number) => void
  // Ajoute le chrono courant puis persiste toute la séance + nav summary.
  onFinishWithRun: (ms: number) => Promise<void>
  // Persiste les chronos déjà mémorisés puis nav (utilisé entre deux courses).
  onFinishExisting?: () => void
  // Repasse à l'écran de choix de distance (depuis l'état idle uniquement).
  onEditDistance: () => void
}) {
  const [status, setStatus] = useState<ChronoStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const startAtRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const [pending, setPending] = useState<PendingAction>(null)
  const [error, setError] = useState<string | null>(null)

  useWakeLock(true)

  useEffect(() => {
    if (status !== 'running') return
    const tick = () => {
      if (startAtRef.current != null) {
        setElapsedMs(performance.now() - startAtRef.current)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [status])

  const start = () => {
    startAtRef.current = performance.now() - elapsedMs
    setStatus('running')
    setError(null)
  }
  const stop = () => {
    if (startAtRef.current != null) {
      setElapsedMs(performance.now() - startAtRef.current)
    }
    setStatus('stopped')
  }
  const resetChrono = () => {
    setStatus('idle')
    setElapsedMs(0)
    startAtRef.current = null
    setError(null)
  }

  const handleNext = () => {
    if (elapsedMs <= 0 || pending || batchSaving) return
    onNextRun(Math.round(elapsedMs))
    resetChrono()
  }

  const handleFinish = async () => {
    if (elapsedMs <= 0 || pending || batchSaving) return
    setPending('finish')
    setError(null)
    try {
      await onFinishWithRun(Math.round(elapsedMs))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur enregistrement')
    } finally {
      setPending(null)
    }
  }

  const busy = pending !== null || batchSaving

  const isRunning = status === 'running'

  return (
    <div
      style={{
        height: SCREEN_H,
        overflow: 'hidden',
        background: isRunning
          ? 'radial-gradient(120% 70% at 50% 0%, color-mix(in oklch, var(--warn) 14%, var(--bg)) 0%, var(--bg) 60%)'
          : 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background 400ms ease',
      }}
    >
      <TopBar
        leading={
          <IconButton icon={<X size={16} />} label="quitter" onClick={onCancel} />
        }
        title="Chrono"
        subtitle={
          sessionRunCount > 0
            ? `${distance}m · ${sessionRunCount} chrono${sessionRunCount > 1 ? 's' : ''} dans la séance`
            : `${distance}m`
        }
      />

      {status === 'idle' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 20px 0' }}>
          <button
            className="tap"
            onClick={onEditDistance}
            disabled={batchSaving}
            style={{
              appearance: 'none',
              border: 'none',
              cursor: batchSaving ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px 8px 14px',
              borderRadius: 999,
              background: 'var(--surface)',
              boxShadow: '0 0 0 1px var(--line) inset',
              // Distance = data athlé → valeur en orange (cf. DESIGN §1).
              color: 'var(--warn)',
              fontFamily: 'var(--mono)',
              fontWeight: 600,
              fontSize: 13,
              opacity: batchSaving ? 0.5 : 1,
              transition: 'background 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1), transform 140ms cubic-bezier(0.22, 1, 0.36, 1)',
              animation: 'fadeUp 500ms 80ms cubic-bezier(0.22, 1, 0.36, 1) both',
            }}
          >
            <span>{distance}m</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                color: 'var(--muted)',
                fontFamily: 'var(--font)',
                fontWeight: 500,
                fontSize: 12,
              }}
            >
              changer
              <ChevronRight size={13} />
            </span>
          </button>
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 20px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 72,
            fontWeight: 600,
            letterSpacing: -3,
            lineHeight: 1,
            color:
              status === 'idle'
                ? 'var(--muted)'
                : status === 'running'
                  ? 'var(--warn)'
                  : 'var(--ink)',
            fontVariantNumeric: 'tabular-nums',
            transition: 'color 200ms',
          }}
        >
          {formatChrono(elapsedMs)}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--subtle)',
            fontFamily: 'var(--mono)',
            marginTop: 8,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          {status === 'idle' && 'prêt'}
          {status === 'running' && 'en cours'}
          {status === 'stopped' && 'arrêté'}
        </div>

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'color-mix(in oklch, var(--warn) 18%, var(--surface))',
              color: 'var(--warn)',
              fontSize: 12,
              fontWeight: 500,
              textAlign: 'center',
              maxWidth: 320,
            }}
          >
            {error}
          </div>
        )}
      </div>

      <div
        style={{
          padding: '14px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)',
          background: 'linear-gradient(180deg, transparent, var(--bg) 30%)',
        }}
      >
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {status === 'idle' && (
            // « Démarrer » et « Terminer » côte à côte : clôturer la séance vit
            // en bas près du pouce (plus en haut dans la TopBar). Terminer
            // n'apparaît que s'il y a déjà des chronos à enregistrer.
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                onClick={start}
                icon={<Timer size={16} />}
                disabled={batchSaving}
                style={{ flex: 1 }}
              >
                Démarrer
              </Button>
              {sessionRunCount > 0 && onFinishExisting && !batchSaving && (
                <TerminerButton onClick={onFinishExisting} />
              )}
            </div>
          )}
          {status === 'running' && (
            // Stop épuré : un carré dans un contour rouge, sans fond.
            <button
              onClick={stop}
              aria-label="Arrêter le chrono"
              className="tap"
              style={{
                height: 52,
                width: '100%',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                boxShadow: '0 0 0 1.5px var(--danger) inset',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 140ms',
              }}
            >
              <StopSquare size={18} color="var(--danger)" />
            </button>
          )}
          {status === 'stopped' && (
            // Hiérarchie par proximité du pouce (bas = plus logique) :
            //   Refaire/Quitter (mineurs) en haut → Finir (orange, la fin) →
            //   Course suivante (action répétée, primaire) tout en bas.
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={resetChrono}
                  disabled={busy}
                  style={{ flex: 1 }}
                >
                  Refaire
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={onCancel}
                  disabled={busy}
                  style={{ flex: 1 }}
                >
                  Quitter
                </Button>
              </div>
              {/* Finir = orange (identité athlé) : signale la fin de la séance. */}
              <button
                onClick={handleFinish}
                disabled={busy || elapsedMs <= 0}
                className="tap"
                aria-label="Finir la séance"
                style={{
                  height: 52,
                  width: '100%',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  cursor: busy || elapsedMs <= 0 ? 'not-allowed' : 'pointer',
                  background: 'transparent',
                  color: 'var(--warn)',
                  boxShadow: '0 0 0 1.5px var(--warn) inset',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: 'var(--font)',
                  opacity: busy || elapsedMs <= 0 ? 0.5 : 1,
                  transition: 'background 140ms',
                }}
              >
                {pending === 'finish' || batchSaving ? (
                  'Enregistrement…'
                ) : (
                  <>
                    <Check size={16} stroke={2.4} />
                    Finir la séance
                  </>
                )}
              </button>
              {/* Course suivante = action la plus fréquente → sous le pouce. */}
              <Button
                onClick={handleNext}
                icon={<Timer size={16} />}
                disabled={busy || elapsedMs <= 0}
              >
                Course suivante
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Bouton « Terminer » : clôture la séance d'athlé (batch save). Ton orange
// (identité athlé, cf. DESIGN §1) + carré explicite, posé en bas à côté de
// « Démarrer ». Même grammaire que le StopButton du LoggingScreen.
function TerminerButton({ onClick }: { onClick: () => void }) {
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
          ? 'color-mix(in oklch, var(--warn) 18%, var(--surface))'
          : 'var(--surface)',
        color: 'var(--warn)',
        boxShadow: '0 0 0 1px color-mix(in oklch, var(--warn) 28%, var(--hairline)) inset',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 15,
        fontWeight: 600,
        transition: 'background 140ms',
      }}
    >
      <StopSquare size={15} color="var(--warn)" />
      Terminer
    </button>
  )
}

// ══════════════════════════════════════════════════════════════════
// ÉCRAN DE CHOIX DE DISTANCE (intermédiaire, mono-tâche)
// ══════════════════════════════════════════════════════════════════
// Sépare le choix de distance du chrono : la page chrono reste pure et son
// bouton « Démarrer » est toujours visible sans scroll.
function DistanceSetupView({
  distance,
  userDistances,
  sessionRunCount,
  disabled,
  onChangeDistance,
  onCancel,
  onContinue,
}: {
  distance: number
  userDistances: number[]
  sessionRunCount: number
  disabled: boolean
  onChangeDistance: (d: number) => void
  onCancel: () => void
  onContinue: () => void
}) {
  return (
    <div
      style={{
        height: SCREEN_H,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent',
      }}
    >
      <TopBar
        leading={
          <IconButton icon={<X size={16} />} label="quitter" onClick={onCancel} />
        }
        title="Athlétisme"
        subtitle={
          sessionRunCount > 0
            ? `${sessionRunCount} chrono${sessionRunCount > 1 ? 's' : ''} en cours`
            : 'Chrono dédié'
        }
      />

      <div className="app-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 20px 24px' }}>
        <h2
          style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: -1.2,
            margin: '8px 0 4px',
            fontFamily: 'var(--display)',
          }}
        >
          <LetterReveal
            segments={[
              { text: 'Quelle distance' },
              { text: ' ?', color: 'var(--brand)' },
            ]}
          />
        </h2>
        <p
          style={{
            margin: '0 0 22px',
            color: 'var(--muted)',
            fontSize: 14,
            animation: 'fadeUp 580ms 600ms cubic-bezier(0.22, 1, 0.36, 1) both',
          }}
        >
          Le chrono démarre sur cette distance. Tu pourras la changer entre deux
          courses.
        </p>

        <div style={{ animation: 'fadeUp 580ms 720ms cubic-bezier(0.22, 1, 0.36, 1) both' }}>
          <DistancePicker
            value={distance}
            userDistances={userDistances}
            onChange={onChangeDistance}
            disabled={disabled}
          />
        </div>
      </div>

      <div
        style={{
          padding: '14px 20px 22px',
          background: 'linear-gradient(180deg, transparent, var(--bg) 30%)',
        }}
      >
        <Button
          onClick={onContinue}
          disabled={disabled}
          trailingIcon={<ChevronRight size={16} />}
        >
          Aller au chrono
        </Button>
      </div>
    </div>
  )
}

function DistancePicker({
  value,
  userDistances,
  onChange,
  disabled,
}: {
  value: number
  userDistances: number[]
  onChange: (d: number) => void
  disabled: boolean
}) {
  // Union presets + distances déjà courues (custom incluses), triées.
  // Garantit qu'une distance custom enregistrée reste cliquable au prochain ouverture.
  const distances = useMemo(() => {
    const set = new Set<number>(DISTANCE_PRESETS_M)
    for (const d of userDistances) set.add(d)
    return Array.from(set).sort((a, b) => a - b)
  }, [userDistances])

  const isInList = distances.includes(value)
  const [customMode, setCustomMode] = useState(!isInList)
  const [customText, setCustomText] = useState(!isInList ? String(value) : '')
  const [customError, setCustomError] = useState<string | null>(null)

  const commitCustom = () => {
    const n = parseInt(customText, 10)
    if (!Number.isFinite(n) || n < DISTANCE_MIN_M || n > DISTANCE_MAX_M) {
      setCustomError(`Entre ${DISTANCE_MIN_M} et ${DISTANCE_MAX_M} m`)
      return
    }
    setCustomError(null)
    onChange(n)
  }

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--muted)',
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          marginBottom: 8,
          paddingLeft: 2,
        }}
      >
        Distance
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {distances.map((d, i) => {
          const active = !customMode && value === d
          const isCustom = !DISTANCE_PRESETS_M.includes(d as never)
          return (
            <button
              key={d}
              className="tap"
              onClick={() => {
                setCustomMode(false)
                onChange(d)
              }}
              disabled={disabled}
              style={{
                appearance: 'none',
                border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                padding: '10px 8px',
                borderRadius: 10,
                // Distance = data athlé → sélection en orange (cf. DESIGN §1), jamais en vert (muscu).
                background: active ? 'color-mix(in oklch, var(--warn) 14%, var(--bg))' : 'var(--surface)',
                color: active ? 'var(--warn)' : 'var(--ink-2)',
                boxShadow: active
                  ? '0 0 0 1.5px var(--warn) inset'
                  : isCustom
                    ? '0 0 0 1px var(--brand-line) inset'
                    : '0 0 0 1px var(--line) inset',
                fontFamily: 'var(--mono)',
                fontWeight: 600,
                fontSize: 13,
                opacity: disabled ? 0.5 : 1,
                transition: 'background 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1), color 180ms, transform 140ms cubic-bezier(0.22, 1, 0.36, 1)',
                animation: `fadeUp 480ms ${(0.76 + i * 0.04).toFixed(2)}s cubic-bezier(0.22, 1, 0.36, 1) both`,
              }}
            >
              {d}m
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <button
          className="tap"
          onClick={() => setCustomMode((v) => !v)}
          disabled={disabled}
          style={{
            appearance: 'none',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: '8px 12px',
            borderRadius: 8,
            background: customMode ? 'color-mix(in oklch, var(--warn) 14%, var(--bg))' : 'var(--surface-2)',
            color: customMode ? 'var(--warn)' : 'var(--muted)',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font)',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          Autre…
        </button>
        {customMode && (
          <>
            <input
              value={customText}
              onChange={(e) => {
                setCustomText(e.target.value.replace(/\D/g, ''))
                setCustomError(null)
              }}
              onBlur={() => customText && commitCustom()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitCustom()
              }}
              disabled={disabled}
              inputMode="numeric"
              placeholder="150"
              style={{
                width: 80,
                height: 34,
                padding: '0 10px',
                border: 'none',
                outline: 'none',
                background: 'var(--surface)',
                borderRadius: 8,
                boxShadow: '0 0 0 1px var(--line) inset',
                fontFamily: 'var(--mono)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ink)',
                textAlign: 'center',
              }}
            />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--subtle)' }}>m</span>
          </>
        )}
      </div>
      {customError && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--warn)',
            fontFamily: 'var(--mono)',
          }}
        >
          {customError}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// VALIDATION DE LA SÉANCE (avant enregistrement)
// ══════════════════════════════════════════════════════════════════
// Calque du SummaryScreen muscu : on récapitule les chronos accumulés en
// mémoire et on ne persiste (batch) qu'au clic « Valider ». Ton ambre = athlé.
const WARN_SOFT = 'color-mix(in oklch, var(--warn) 16%, var(--surface))'
const WARN_LINE = 'color-mix(in oklch, var(--warn) 38%, var(--surface))'

function SessionReviewView({
  runs,
  saving,
  onDeleteRun,
  onBack,
  onValidate,
}: {
  runs: Array<{ distance_m: number; duration_ms: number }>
  saving: boolean
  onDeleteRun: (index: number) => void
  onBack: () => void
  onValidate: () => void
}) {
  const count = runs.length
  const distances = new Set(runs.map((r) => r.distance_m)).size
  const fastest = runs.reduce<number | null>(
    (m, r) => (m == null || r.duration_ms < m ? r.duration_ms : m),
    null,
  )

  return (
    <div
      style={{
        height: SCREEN_H,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent',
      }}
    >
      <TopBar
        leading={<IconButton icon={<X size={16} />} label="retour au chrono" onClick={onBack} />}
        title="Séance terminée"
        subtitle="Vérifie et confirme"
      />

      <div className="app-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 16px 16px' }}>
        {/* Hero */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            animation: 'fadeUp 360ms ease both',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: WARN_SOFT,
              color: 'var(--warn)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Timer size={22} />
          </div>
          <div>
            <h2
              style={{
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: -0.9,
                margin: '0 0 2px',
                fontFamily: 'var(--display)',
              }}
            >
              Séance terminée<span style={{ color: 'var(--warn)' }}>.</span>
            </h2>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
              {count} chrono{count > 1 ? 's' : ''} · prête à enregistrer
            </p>
          </div>
        </div>

        {/* Stats */}
        <Card style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <ReviewStat label="Chronos" value={String(count)} />
            <ReviewStat label="Distances" value={String(distances)} />
            <ReviewStat label="Plus rapide" value={fastest != null ? formatChrono(fastest) : '—'} />
          </div>
        </Card>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2px 8px',
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              fontWeight: 600,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            À vérifier
          </span>
          <span style={{ fontSize: 11, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>
            supprime un chrono raté
          </span>
        </div>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {count === 0 ? (
            <div
              style={{
                padding: '20px 16px',
                fontSize: 13,
                color: 'var(--subtle)',
                textAlign: 'center',
                fontStyle: 'italic',
              }}
            >
              Aucun chrono — reviens en arrière pour en ajouter.
            </div>
          ) : (
            runs.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 12px 12px 14px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: 'var(--surface-2)',
                    color: 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    letterSpacing: -0.3,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatChrono(r.duration_ms)}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--warn)',
                    background: WARN_SOFT,
                    boxShadow: `0 0 0 1px ${WARN_LINE} inset`,
                    padding: '2px 8px',
                    borderRadius: 999,
                    flexShrink: 0,
                  }}
                >
                  {r.distance_m}m
                </span>
                <span style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={() => onDeleteRun(i)}
                  disabled={saving}
                  aria-label="Supprimer ce chrono"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--subtle)',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  <Trash size={15} />
                </button>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Boutons collés en bas du viewport */}
      <div
        style={{
          padding: '14px 16px calc(env(safe-area-inset-bottom, 0px) + 22px)',
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
          <Button
            onClick={onValidate}
            disabled={saving || count === 0}
            icon={saving ? undefined : <Check size={16} />}
          >
            {saving ? 'Enregistrement…' : 'Valider la séance'}
          </Button>
          <Button variant="secondary" onClick={onBack} disabled={saving}>
            Annuler
          </Button>
        </div>
      </div>
    </div>
  )
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 10,
          color: 'var(--muted)',
          fontWeight: 600,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: -0.5,
          marginTop: 4,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  )
}
