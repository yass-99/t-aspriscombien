'use client'

import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'
import type { NavContext, SessionState, WorkoutStep } from '../_lib/types'
import { WORKOUT_TYPES, REST_PRESETS } from '../_lib/constants'
import { formatMMSS } from '../_lib/helpers'
import { Button, IconButton, Pill, Steps, TopBar } from '../_components/primitives'
import { Check, ChevronLeft, ChevronRight, Minus, Plus, Timer } from '../_components/icons'
import { LetterReveal } from '../_components/LetterReveal'
import { AnimatePresence, motion } from 'motion/react'
import type { Variants } from 'motion/react'

const subStepVariants: Variants = {
  initial: (d: number) => ({ opacity: 0, x: d >= 0 ? 24 : -24 }),
  animate: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  exit: (d: number) => ({ opacity: 0, x: d >= 0 ? -24 : 24, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }),
}

// ID dédié pour l'athlétisme — pas dans WORKOUT_TYPES pour ne pas polluer
// les types de séance persistés en DB (les seances n'ont pas de type 'athletics').
const ATHLETICS_ID = 'athletics'

// La config est désormais un wizard en deux temps : on choisit d'abord le type
// d'entraînement, puis le chrono (temps de repos). L'indicateur violet de la
// TopBar reflète l'étape courante du flux global (4 crans : type → chrono →
// exos → log).
type ConfigStep = 'type' | 'chrono'

type Props = {
  session: SessionState
  setSession: Dispatch<SetStateAction<SessionState>>
  nav: (s: WorkoutStep, ctx?: NavContext) => void
  // Sous-étape d'ouverture : « chrono » au retour depuis exercise_select.
  initialStep?: ConfigStep
}

export function ConfigScreen({ session, setSession, nav, initialStep = 'type' }: Props) {
  const [step, setStep] = useState<ConfigStep>(initialStep)
  const [type, setType] = useState(session.type || 'push')
  const [rest, setRest] = useState(session.restTargetSec || 90)
  const isAthletics = type === ATHLETICS_ID
  // Direction du slide interne (+1 = avancer type→chrono, -1 = reculer).
  const dir = useRef(1)
  const [blurKick, setBlurKick] = useState(true)

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const ua = navigator.userAgent
    const isSafari = /safari/i.test(ua) && !/chrome|crios|android/i.test(ua)
    if (!isSafari) return
    setBlurKick(false)
    const id = requestAnimationFrame(() => setBlurKick(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Démarre (ou redémarre) une séance muscu : on repart toujours d'exos vides
  // pour ne pas traîner ceux d'une session abandonnée via le X.
  const startMuscu = () => {
    setSession((s) => ({
      ...s,
      type,
      restTargetSec: rest,
      exos: [],
      currentExoIndex: 0,
      currentSerieIndex: 0,
      timer: { remainingSec: 0, status: 'idle', overtimeSec: 0, justFinished: false, targetEndAt: null },
    }))
    nav('exercise_select')
  }

  const onPrimary = () => {
    if (step === 'type') {
      if (isAthletics) {
        nav('athletics')
        return
      }
      dir.current = 1
      setStep('chrono')
      return
    }
    startMuscu()
  }

  const onBack = () => {
    if (step === 'chrono') {
      dir.current = -1
      setStep('type')
      return
    }
    nav('idle')
  }

  const canContinue = step === 'type' ? !!type : rest > 0
  const primaryLabel =
    step === 'type' ? (isAthletics ? 'Aller au chrono' : 'Continuer') : 'Commencer'
  const stepIndex = step === 'type' ? 0 : 1

  // Aperçu contextuel de l'étape « type » : groupes musculaires ciblés, dérivés
  // du hint du type choisi. Présentés en pills (≠ liste d'exos de l'étape
  // suivante), histoire de confirmer le choix sans redondance.
  const selectedType = WORKOUT_TYPES.find((t) => t.id === type)
  const muscles = isAthletics
    ? ['Vitesse', 'Explosivité', 'Sprints']
    : selectedType?.hint.split(' · ') ?? []

  // Aperçu contextuel de l'étape « chrono » : traduit le nombre de secondes en
  // intention d'entraînement. Donne du sens au réglage sans répéter le chiffre.
  const restMeaning =
    rest < 75
      ? { tag: 'Court', text: 'Idéal pour l’endurance musculaire et le volume.' }
      : rest <= 135
        ? { tag: 'Modéré', text: 'Le sweet spot pour la prise de muscle.' }
        : { tag: 'Long', text: 'Pour les charges lourdes et la force max.' }

  return (
    <div
      className="app-scroll"
      style={{
        // 100dvh (et non 100%, qui ne se résout pas faute de hauteur parente) :
        // garantit que le footer sticky se colle au bas du viewport, atteignable
        // au pouce, même quand le contenu est court.
        minHeight: 'calc(100dvh - env(safe-area-inset-top, 0px))',
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent',
      }}
    >
      <TopBar
        leading={
          <IconButton icon={<ChevronLeft size={18} />} label="retour" onClick={onBack} variant="outlined" />
        }
        title="Nouvelle séance"
        subtitle={
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
            <Steps count={4} current={stepIndex} />
          </div>
        }
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
      <AnimatePresence mode="popLayout" custom={dir.current} initial={false}>
        {step === 'type' ? (
          <motion.div
            key="type"
            custom={dir.current}
            variants={subStepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ padding: '8px 20px 24px' }}
          >
            <h2
              style={{
                fontSize: 52,
                fontWeight: 700,
                letterSpacing: -2,
                lineHeight: 1.0,
                margin: '8px 0 0',
                fontFamily: 'var(--display)',
              }}
            >
              <LetterReveal segments={[{ text: 'Quel' }]} rise="0.45em" />
            </h2>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: -0.8,
                fontFamily: 'var(--display)',
                color: 'var(--ink)',
                margin: '2px 0 26px',
                animation: 'fadeUp 560ms 360ms cubic-bezier(0.22, 1, 0.36, 1) both',
              }}
            >
              type d&apos;entraînement <span style={{ color: 'var(--brand)' }}>?</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                marginBottom: 12,
              }}
            >
              {WORKOUT_TYPES.map((t, i) => {
                const active = type === t.id
                return (
                  <button
                    key={t.id}
                    className="tap"
                    onClick={() => setType(t.id)}
                    style={{
                      appearance: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: active ? 'var(--brand-soft)' : 'var(--surface)',
                      boxShadow: active
                        ? '0 0 0 1.5px var(--brand) inset, 0 4px 14px -6px color-mix(in oklch, var(--brand) 45%, transparent)'
                        : '0 0 0 1px var(--line) inset',
                      transition:
                        'background 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 140ms cubic-bezier(0.22, 1, 0.36, 1)',
                      border: 'none',
                      position: 'relative',
                      // Cascade d'entrée : chaque carte fond l'une après l'autre.
                      animation: `fadeUp 520ms ${(0.1 + i * 0.06).toFixed(2)}s cubic-bezier(0.22, 1, 0.36, 1) both`,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: active ? 'var(--brand)' : 'var(--surface-2)',
                        color: active ? 'var(--brand-ink)' : 'var(--ink-2)',
                        fontFamily: 'var(--mono)',
                        fontWeight: 600,
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 200ms',
                      }}
                    >
                      {t.emoji}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>
                      {t.label}
                    </div>
                    {active && (
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 999,
                          background: 'var(--brand)',
                          color: 'var(--brand-ink)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          animation: 'fadeUp 220ms ease both',
                        }}
                      >
                        <Check size={11} stroke={3} />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            <button
              className="tap"
              onClick={() => setType(ATHLETICS_ID)}
              style={{
                appearance: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 12px',
                borderRadius: 12,
                border: 'none',
                background: isAthletics ? 'var(--brand-soft)' : 'var(--surface)',
                boxShadow: isAthletics
                  ? '0 0 0 1.5px var(--brand) inset, 0 4px 14px -6px color-mix(in oklch, var(--brand) 45%, transparent)'
                  : '0 0 0 1px var(--line) inset',
                transition:
                  'background 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 140ms cubic-bezier(0.22, 1, 0.36, 1)',
                position: 'relative',
                animation: 'fadeUp 520ms 0.46s cubic-bezier(0.22, 1, 0.36, 1) both',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: isAthletics ? 'var(--brand)' : 'var(--surface-2)',
                  color: isAthletics ? 'var(--brand-ink)' : 'var(--ink-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 200ms',
                }}
              >
                <Timer size={17} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Athlétisme</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  Sprints courts · chrono dédié, sans récup
                </div>
              </div>
              {isAthletics && (
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: 'var(--brand)',
                    color: 'var(--brand-ink)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    animation: 'fadeUp 220ms ease both',
                  }}
                >
                  <Check size={11} stroke={3} />
                </div>
              )}
            </button>

            {/* Aperçu contextuel : ce que le choix va faire travailler. Crossfade
                à chaque changement de type via la key. */}
            <div
              style={{
                marginTop: 26,
                animation: 'fadeUp 520ms 0.56s cubic-bezier(0.22, 1, 0.36, 1) both',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  color: 'var(--subtle)',
                  fontFamily: 'var(--mono)',
                  marginBottom: 10,
                }}
              >
                {isAthletics ? 'Au programme' : 'Tu vas travailler'}
              </div>
              <div
                key={type}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  animation: 'fadeUp 280ms cubic-bezier(0.22, 1, 0.36, 1) both',
                }}
              >
                {muscles.map((m) => (
                  <Pill key={m} tone="accent">
                    {m}
                  </Pill>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="chrono"
            custom={dir.current}
            variants={subStepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ padding: '8px 20px 24px' }}
          >
            <h2
              style={{
                fontSize: 52,
                fontWeight: 700,
                letterSpacing: -2,
                lineHeight: 1.0,
                margin: '8px 0 0',
                fontFamily: 'var(--display)',
              }}
            >
              <LetterReveal segments={[{ text: 'Combien' }]} rise="0.45em" />
            </h2>
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: -0.8,
                fontFamily: 'var(--display)',
                color: 'var(--ink)',
                margin: '2px 0 26px',
                animation: 'fadeUp 560ms 360ms cubic-bezier(0.22, 1, 0.36, 1) both',
              }}
            >
              de repos entre les séries <span style={{ color: 'var(--brand)' }}>?</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                marginBottom: 12,
              }}
            >
              {REST_PRESETS.map((s, i) => {
                const active = rest === s
                return (
                  <button
                    key={s}
                    className="tap"
                    onClick={() => setRest(s)}
                    style={{
                      height: 56,
                      borderRadius: 12,
                      cursor: 'pointer',
                      border: 'none',
                      background: active ? 'var(--brand-soft)' : 'var(--surface)',
                      // Carte violette quand active, mais le texte reste blanc (lisibilité + sobriété).
                      color: 'var(--ink)',
                      boxShadow: active
                        ? '0 0 0 1px var(--brand-line) inset'
                        : '0 0 0 1px var(--line) inset',
                      fontFamily: 'var(--mono)',
                      fontWeight: 600,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition:
                        'background 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 140ms cubic-bezier(0.22, 1, 0.36, 1)',
                      animation: `fadeUp 520ms ${(0.1 + i * 0.06).toFixed(2)}s cubic-bezier(0.22, 1, 0.36, 1) both`,
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{formatMMSS(s)}</span>
                    <span style={{ fontSize: 10, opacity: 0.55, marginTop: 1 }}>{s}s</span>
                  </button>
                )
              })}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                background: 'var(--surface)',
                borderRadius: 12,
                boxShadow: '0 0 0 1px var(--line) inset',
                animation: 'fadeUp 520ms 0.40s cubic-bezier(0.22, 1, 0.36, 1) both',
              }}
            >
              <Timer size={16} color="var(--muted)" />
              <span style={{ fontSize: 13, color: 'var(--muted)', flex: 1 }}>Personnaliser</span>
              <button
                onClick={() => setRest(Math.max(15, rest - 15))}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                }}
              >
                <Minus size={12} />
              </button>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 15,
                  fontWeight: 600,
                  minWidth: 56,
                  textAlign: 'center',
                }}
              >
                {formatMMSS(rest)}
              </span>
              <button
                onClick={() => setRest(Math.min(600, rest + 15))}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                }}
              >
                <Plus size={12} />
              </button>
            </div>

            {/* Aperçu contextuel : ce que le repos choisi vise. Crossfade quand
                la « tranche » d'objectif change (court / modéré / long). */}
            <div
              key={restMeaning.tag}
              style={{
                marginTop: 16,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 14,
                background: 'var(--brand-soft)',
                boxShadow: '0 0 0 1px var(--brand-line) inset',
                animation: 'fadeUp 300ms cubic-bezier(0.22, 1, 0.36, 1) both',
              }}
            >
              <Timer size={18} color="var(--brand-bright)" />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--brand-bright)',
                    marginBottom: 2,
                  }}
                >
                  Repos {restMeaning.tag.toLowerCase()}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4 }}>
                  {restMeaning.text}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 2,
          // Marge haute = zone de fondu : le flou démarre au-dessus du bouton et
          // se dissout vers le haut (pas de bord net). Repris de l'IdleScreen.
          paddingTop: 56,
        }}
      >
        {/* Couche verre à flou progressif : le masque dégradé efface le flou ET
            la teinte en remontant → frontière floutée, pas un trait. Le bouton
            vit dans une couche sœur non masquée. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            willChange: 'transform',
            transform: blurKick ? 'translateZ(0)' : 'translateZ(0.01px)',
            // Verre depoli progressif : blur + masque pour un fondu doux.
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            background: 'linear-gradient(to top, var(--glass-strong) 40%, transparent)',
            maskImage: 'linear-gradient(to top, #000 38%, transparent)',
            WebkitMaskImage: 'linear-gradient(to top, #000 38%, transparent)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            isolation: 'isolate',
            // Couche GPU PERSISTANTE pour le bouton : translateZ(0) seul ne suffit
            // pas (Chrome peut ne pas promouvoir), will-change force la couche en
            // permanence. Sans ça, le bouton est peint en CPU au repos et rendu
            // GPU pendant les animations framer-motion → la même couleur sRGB
            // s'affiche légèrement différemment selon le chemin (wide-gamut).
            willChange: 'transform',
            transform: 'translateZ(0)',
            padding: '0 20px calc(var(--cta-pad-bottom, 12px) + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <Button onClick={onPrimary} disabled={!canContinue} gpu trailingIcon={<ChevronRight size={16} />} style={{ boxShadow: 'none' }}>
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
