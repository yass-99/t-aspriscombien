'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import type { NavFn, Run, SessionState } from '../_lib/types'
import { daysAgo, formatSeanceDate } from '../_lib/helpers'
import { formatChrono } from '../_lib/runs'
import { weekStartMonday, weekKey, isoLocalDate } from '../_lib/profile'
import { usePlan } from '../_lib/usePlan'
import { TYPE_LABELS } from '../_lib/plan'
import { WORKOUT_TYPES } from '../_lib/constants'
import { smoothLineFromValues, sampleSmoothByValues } from '../_lib/smoothPath'
import { useHomeDashboard } from '../_lib/useHomeDashboard'
import { useRuns } from '../_lib/useRuns'
import { useMounted } from '../_lib/useMounted'
import { Button, Card, Pill } from '../_components/primitives'
import { ArrowUpRight, ChevronRight, Copy, Dumbbell } from '../_components/icons'
import { WeeklyCheckIn } from '../_components/WeeklyCheckIn'
import { WeekReportSheet } from '../_components/WeekReportSheet'
import { StatusSpot } from '../_components/StatusSpot'
import { Reveal } from '../_components/Reveal'
import { LetterReveal } from '../_components/LetterReveal'
import { AnimatedNumber } from '../_components/AnimatedNumber'
import { Skeleton, SkeletonChart, SkeletonSession, Spinner } from '../_components/Skeleton'
import { EASE } from '../_lib/motion'

type Props = {
  session: SessionState
  nav: NavFn
}

export function IdleScreen({ nav }: Props) {
  const { data, loading } = useHomeDashboard()
  const { runs } = useRuns()
  const { entries: planEntries } = usePlan(weekKey())
  const reduce = useReducedMotion()
  const mounted = useMounted()
  // `useHomeDashboard` bootstrappe `loading=false` SYNCHRONEMENT depuis le cache
  // (localStorage) côté client — alors que le serveur rend toujours `loading=true`.
  // Rendre les données dès le 1er rendu client provoquait un mismatch d'hydratation
  // ET un graphe affiché complet (le <svg> SSR sans mesure de pathLength). On ne
  // révèle donc les DONNÉES qu'après le montage : 1er rendu client === serveur
  // (skeleton), puis cascade cinématique côté client uniquement.
  const pending = loading || !mounted
  // Séance planifiée aujourd'hui (gate `mounted` → pas de mismatch d'hydratation).
  const plannedToday = mounted
    ? planEntries.find((e) => e.date === isoLocalDate()) ?? null
    : null
  const plannedLabel = plannedToday ? TYPE_LABELS[plannedToday.type] ?? 'séance' : null
  const [weekSheetOpen, setWeekSheetOpen] = useState(false)
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

  const weekVolume = data?.week.volume ?? 0
  const weekSeances = data?.week.seances ?? 0
  const weekSeries = data?.week.series ?? 0

  // Athlé de la semaine courante (data orange) — pour l'aperçu bi-discipline.
  const weekRuns = useMemo(() => {
    const start = weekStartMonday().getTime()
    return runs.filter((r) => new Date(r.date + 'T00:00:00').getTime() >= start)
  }, [runs])
  const athleChronos = weekRuns.length
  const bestRun = useMemo(
    () => weekRuns.reduce<Run | null>((b, r) => (!b || r.duration_ms < b.duration_ms ? r : b), null),
    [weekRuns],
  )

  const last = data?.lastSeance ?? null
  const lastType = last ? WORKOUT_TYPES.find((t) => t.id === last.type) : null

  return (
    <div
      style={{
        // Hauteur d'écran bornée → le contenu scrolle dessous, la barre dépolie
        // reste TOUJOURS visible en bas et floute le contenu qui passe sous elle.
        height: 'calc(100dvh - env(safe-area-inset-top, 0px))',
        overflow: 'hidden',
        background: 'transparent',
        position: 'relative',
      }}
    >
      <div
        className="app-scroll"
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          // dégage la barre dépolie (overlay) pour atteindre le dernier contenu
          paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
          zIndex: 1,
        }}
      >
        {/* HERO — sans description, intensifié, « ? » cobalt */}
        <div style={{ padding: '24px 20px 18px' }}>
          <Reveal>
            <StatusSpot />
          </Reveal>
          <h1
            style={{
              fontSize: 52,
              lineHeight: 1.02,
              letterSpacing: -2.6,
              fontWeight: 700,
              margin: '6px 0 0',
              color: 'var(--ink)',
              fontFamily: 'var(--display)',
            }}
          >
            <LetterReveal
              segments={[
                { text: "T'as pris" },
                { br: true },
                { text: 'combien' },
                { text: '?', color: 'var(--brand-bright)' },
              ]}
              baseDelay={0.15}
              step={0.044}
              duration={0.72}
              rise="0.34em"
            />
          </h1>
        </div>

        {/* Check-in hebdo : pesée de la semaine (ludique, n'apparaît que si non saisie) */}
        <WeeklyCheckIn />

        {/* Ta semaine — aperçu muscu + athlé (ouvre Stats). Vert = muscu, orange = athlé.
            La carte est TOUJOURS montée : le chrome (libellés, axe des jours) vient du
            premier rendu et ne se ré-anime jamais. Seules les DONNÉES se remplissent
            (skeleton → chiffre qui monte, graphe qui se trace). */}
        <div style={{ padding: '0 20px 12px' }}>
          <Card glass interactive onClick={() => nav('stats')} style={{ padding: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
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
                Ta semaine
              </span>
              <motion.div
                initial={reduce ? false : { opacity: 0, x: -10, y: 10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.5, delay: 0.28, ease: EASE.out }}
                style={{ display: 'inline-flex' }}
              >
                <ArrowUpRight size={16} color="var(--subtle)" />
              </motion.div>
            </div>

            <div style={{ display: 'flex', alignItems: 'stretch', gap: 14 }}>
              {/* Muscu (vert) */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <DisciplineLabel color="var(--accent)" label="Muscu" reduce={reduce} delay={0.08} />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 7, minHeight: 30 }}>
                  {pending ? (
                    <Skeleton width={96} height={25} />
                  ) : (
                    <>
                      <AnimatedNumber
                        value={weekVolume}
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 25,
                          fontWeight: 600,
                          letterSpacing: -1,
                          color: 'var(--ink)',
                        }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>
                        kg
                      </span>
                    </>
                  )}
                </div>
                <DataLine loading={pending} reduce={reduce}>
                  {weekSeances} séance{weekSeances > 1 ? 's' : ''} · {weekSeries} série
                  {weekSeries > 1 ? 's' : ''}
                </DataLine>
              </div>

              <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--hairline)' }} />

              {/* Athlé (orange) */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <DisciplineLabel color="var(--warn)" label="Athlé" reduce={reduce} delay={0.18} />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 7, minHeight: 30 }}>
                  {pending ? (
                    <Skeleton width={84} height={25} />
                  ) : (
                    <motion.span
                      initial={reduce ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.12, ease: EASE.out }}
                      style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 25,
                          fontWeight: 600,
                          letterSpacing: -1,
                          color: 'var(--ink)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {bestRun ? formatChrono(bestRun.duration_ms) : '—'}
                      </span>
                      {bestRun && (
                        <span style={{ fontSize: 12, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>
                          {bestRun.distance_m}m
                        </span>
                      )}
                    </motion.span>
                  )}
                </div>
                <DataLine loading={pending} reduce={reduce}>
                  {athleChronos > 0
                    ? `${athleChronos} chrono${athleChronos > 1 ? 's' : ''}`
                    : 'aucun chrono'}
                </DataLine>
              </div>
            </div>

            {/* Rythme de la semaine — le graphe (data) puis l'axe des jours (chrome figé,
                ne change jamais entre skeleton et carte). */}
            <div style={{ marginTop: 14 }}>
              {pending ? (
                <SkeletonChart height={40} />
              ) : (
                <WeekRhythm daily={data?.week.daily ?? []} />
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9 }}>
                {DAY_LABELS.map((d, i) => (
                  <motion.span
                    key={i}
                    initial={reduce ? false : { opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.34, delay: 0.34 + i * 0.04, ease: EASE.out }}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: 9,
                      fontFamily: 'var(--mono)',
                      color: 'var(--subtle)',
                    }}
                  >
                    {d}
                  </motion.span>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Copier ma semaine — le bouton (texte) est présent dès le chargement : un
            spinner occupe l'emplacement de l'icône, puis le texte s'anime à l'arrivée. */}
        <div style={{ padding: '0 20px 14px' }}>
          <button
            onClick={() => {
              if (!pending) setWeekSheetOpen(true)
            }}
            disabled={pending}
            style={{
              width: '100%',
              appearance: 'none',
              border: 'none',
              cursor: pending ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--glass)',
              boxShadow: '0 0 0 1px var(--hairline) inset',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              fontFamily: 'var(--font)',
              color: 'var(--ink-2)',
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                background: 'var(--brand-soft)',
                color: 'var(--brand-bright)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {pending ? (
                <Spinner
                  size={13}
                  stroke={2}
                  color="var(--brand-bright)"
                  track="color-mix(in oklch, var(--brand-bright) 28%, transparent)"
                />
              ) : (
                <Copy size={12} />
              )}
            </span>
            <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 600 }}>
              {/* Texte présent dès le montage, mais il s'anime APRÈS la première
                  vague (carte « Ta semaine ») — séquence, pas simultané. */}
              <motion.span
                initial={reduce ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.58, ease: EASE.out }}
                style={{ display: 'inline-block' }}
              >
                Copier ma semaine
              </motion.span>
            </span>
            <ChevronRight size={14} color="var(--subtle)" />
          </button>
        </div>

        {/* Skeleton « dernière séance » pendant le chargement (épouse la carte réelle) */}
        {pending && (
          <div style={{ padding: '6px 20px 14px' }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                fontWeight: 600,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                padding: '4px 4px 10px',
              }}
            >
              Dernière séance
            </div>
            <SkeletonSession />
          </div>
        )}

        {/* Last workout (data muscu → vert) */}
        {!pending && last && lastType && (
          <div style={{ padding: '6px 20px 14px' }}>
            <Reveal delay={0.46}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 4px 10px',
                }}
              >
                <motion.span
                  initial={reduce ? false : { opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.42, delay: 0.62, ease: EASE.out }}
                  style={{
                    fontSize: 11,
                    color: 'var(--muted)',
                    fontWeight: 600,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    display: 'inline-block',
                  }}
                >
                  Dernière séance
                </motion.span>
                <motion.button
                  onClick={() => nav('history')}
                  initial={reduce ? false : { opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.42, delay: 0.74, ease: EASE.out }}
                  style={{
                    appearance: 'none',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--ink-2)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                    padding: '4px 6px',
                    margin: '-4px -6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  Tout l&apos;historique
                  <ChevronRight size={11} stroke={2.4} />
                </motion.button>
              </div>
              <Card
                glass
                interactive
                onClick={() => nav('session_detail', { seanceId: last.id })}
                style={{ padding: 16 }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    animation: 'fadeUp 560ms 0.34s cubic-bezier(0.22, 1, 0.36, 1) both',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface-2)',
                        color: 'var(--ink-2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--mono)',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {lastType.emoji}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Séance {lastType.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                        {formatSeanceDate(last.date)}
                      </div>
                    </div>
                  </div>
                  <Pill tone="outline">
                    {last.exos.length} exo{last.exos.length > 1 ? 's' : ''}
                  </Pill>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {last.exos.map((e, i) => (
                    <div
                      key={e.nom}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--line-2)',
                        animation: `fadeUp 520ms ${(0.46 + i * 0.07).toFixed(2)}s cubic-bezier(0.22, 1, 0.36, 1) both`,
                      }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{e.nom}</span>
                      {e.topSet && (
                        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                          {e.topSet.poids} kg × {e.topSet.reps}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--hairline)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    animation: 'fadeUp 560ms 0.92s cubic-bezier(0.22, 1, 0.36, 1) both',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {last.seriesCount} série{last.seriesCount > 1 ? 's' : ''} · {daysAgo(last.date)}
                  </span>
                  <ChevronRight size={14} color="var(--subtle)" />
                </div>
              </Card>
            </Reveal>
          </div>
        )}

        {!pending && !last && (
          <div style={{ padding: '6px 20px 14px' }}>
            <Reveal delay={0.18}>
              <Card glass style={{ padding: 18 }}>
                <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}>
                  Pas encore de séance enregistrée.
                  <br />
                  <span style={{ color: 'var(--brand-bright)', fontWeight: 600 }}>
                    Lance ta première séance.
                  </span>
                </div>
                <button
                  onClick={() => nav('history')}
                  style={{
                    marginTop: 14,
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--ink-2)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  ou ajouter une séance manuellement
                </button>
              </Card>
            </Reveal>
          </div>
        )}

        <div style={{ height: 8 }} />
      </div>

      {/* Barre dépolie — overlay en verre : le contenu défile dessous et se floute.
          CTA principal violet, toujours visible dans la zone du pouce. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          // Marge haute = zone de fondu : le flou démarre bien au-dessus du
          // bouton et se dissout progressivement vers le haut (pas de bord net).
          paddingTop: 56,
        }}
      >
        {/* Couche verre à flou progressif : le masque dégradé efface le flou ET
            la teinte en remontant → la frontière avec l'écran est floutée, pas
            délimitée par un trait. Le bouton vit dans une couche sœur non masquée. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            willChange: 'transform',
            transform: blurKick ? 'translateZ(0)' : 'translateZ(0.01px)',
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
            // Couche GPU persistante (cf. ConfigScreen) : évite l'écart de
            // rendu couleur CPU↔GPU du bouton entre repos et animation.
            willChange: 'transform',
            transform: 'translateZ(0)',
            padding: '0 20px calc(var(--cta-pad-bottom, 12px) + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {plannedToday ? (
            <SplitStartButton
              label={plannedLabel ?? 'séance'}
              reduce={reduce}
              onStart={() =>
                plannedToday.type === 'athletics'
                  ? nav('athletics')
                  : nav('config', { plannedType: plannedToday.type })
              }
              onFree={() => nav('config')}
            />
          ) : (
            <Button size="lg" onClick={() => nav('config')} icon={<Dumbbell size={16} />} gpu style={{ boxShadow: 'none' }}>
              Commencer une séance
            </Button>
          )}
        </div>
      </div>

      <WeekReportSheet open={weekSheetOpen} onClose={() => setWeekSheetOpen(false)} />
    </div>
  )
}

// CTA du jour J : « Commencer {type} » (→ chrono/athlé) + flèche révélant le
// seul autre choix, « Séance libre » (→ config, rien de présélectionné).
function SplitStartButton({
  label,
  reduce,
  onStart,
  onFree,
}: {
  label: string
  reduce: boolean | null
  onStart: () => void
  onFree: () => void
}) {
  const [openMenu, setOpenMenu] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <AnimatePresenceMenu open={openMenu} reduce={reduce} onClose={() => setOpenMenu(false)} onFree={onFree} />
      <div style={{ display: 'flex', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
        <Button size="lg" onClick={onStart} gpu style={{ flex: 1, borderRadius: 0, boxShadow: 'none' }}>
          Commencer {label}
        </Button>
        <button
          aria-haspopup="menu"
          aria-expanded={openMenu}
          aria-label="Autre séance"
          onClick={() => setOpenMenu((v) => !v)}
          style={{
            width: 54,
            border: 'none',
            cursor: 'pointer',
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            borderLeft: '1px solid color-mix(in oklch, black 18%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <motion.span
            animate={{ rotate: openMenu ? 90 : -90 }}
            transition={{ duration: 0.18, ease: EASE.out }}
            style={{ display: 'inline-flex' }}
          >
            <ChevronRight size={18} stroke={2.4} />
          </motion.span>
        </button>
      </div>
    </div>
  )
}

// Menu « Séance libre » qui glisse au-dessus du bouton (depuis sa source).
function AnimatePresenceMenu({
  open,
  reduce,
  onClose,
  onFree,
}: {
  open: boolean
  reduce: boolean | null
  onClose: () => void
  onFree: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* scrim invisible : tap-dehors ferme le menu */}
          <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
          <motion.div
            role="menu"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: EASE.out }}
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 10px)',
              left: 0,
              right: 0,
              zIndex: 2,
              background: 'var(--glass-strong)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              boxShadow: '0 0 0 1px var(--hairline) inset, 0 -10px 40px -12px rgba(0,0,0,0.7)',
              borderRadius: 16,
              padding: 7,
            }}
          >
            <button
              role="menuitem"
              onClick={() => {
                onClose()
                onFree()
              }}
              style={{
                width: '100%',
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--ink)',
                fontFamily: 'var(--font)',
                fontWeight: 600,
                fontSize: 14,
                textAlign: 'left',
                padding: '13px 12px',
                borderRadius: 11,
                cursor: 'pointer',
              }}
            >
              Séance libre
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Petit libellé de discipline (point coloré + nom) — réutilisé muscu/athlé.
// Entrée en spring DÈS le montage (même pendant le chargement) : le mouvement
// occupe l'attente. Le point coloré « pope » avec le texte.
function DisciplineLabel({
  color,
  label,
  reduce,
  delay = 0,
}: {
  color: string
  label: string
  reduce: boolean | null
  delay?: number
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: -8, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 440, damping: 24, delay }}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <span
        aria-hidden
        style={{ width: 7, height: 7, borderRadius: 999, background: color, flexShrink: 0 }}
      />
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color,
        }}
      >
        {label}
      </span>
    </motion.div>
  )
}

// Sous-titre de discipline : skeleton tant que la donnée n'est pas là, puis
// apparition cinématique (fondu + léger glissé). Chrome stable autour, data animée.
function DataLine({
  loading,
  reduce,
  children,
}: {
  loading: boolean
  reduce: boolean | null
  children: ReactNode
}) {
  if (loading) return <Skeleton width="78%" height={11} style={{ marginTop: 5 }} />
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25, ease: EASE.out }}
      style={{
        fontSize: 11,
        color: 'var(--subtle)',
        fontFamily: 'var(--mono)',
        marginTop: 4,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {children}
    </motion.div>
  )
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// Interpole un tableau (échantillonné uniforme en longueur d'arc) à la fraction
// p ∈ [0,1]. Permet de placer la tête à la MÊME fraction d'arc que le pathLength.
function interpAt(arr: number[], p: number): number {
  const n = arr.length
  if (n === 0) return 0
  if (n === 1) return arr[0]
  const t = Math.min(1, Math.max(0, p)) * (n - 1)
  const i = Math.floor(t)
  const f = t - i
  return arr[i] + (arr[Math.min(n - 1, i + 1)] - arr[i]) * f
}

const DRAW = 1.9 // durée du tracé (lent, cinématique)
const DELAY = 0.3
// Ease-in-out marqué (quart) : VRAI ralentissement au DÉPART — le stylo s'élance
// doucement, prend de la vitesse, puis se pose. Rien de mécanique/linéaire.
const DRAW_EASE: [number, number, number, number] = [0.76, 0, 0.24, 1]

// Rythme de la semaine : charge (volume) par jour Lun→Dim. Bien plus parlant
// qu'une sparkline de 4 semaines — on voit quels jours l'élève a bossé et fort.
//
// Animation : un POINT lumineux part de lundi et, en avançant jusqu'à aujourd'hui,
// FAIT APPARAÎTRE le trait derrière lui (comme un stylo qui dessine). Le glow est
// présent dès le départ.
//
// SYNCHRO PARFAITE : le trait (pathLength) ET la tête (cx/cy) sont dérivés d'UNE
// SEULE valeur de progression `progress`. Un tableau de keyframes aurait reçu un
// easing PAR SEGMENT (≈ linéaire global) pendant que le pathLength reçoit l'easing
// sur toute la durée → ils divergeaient. Ici, même `progress` → même profil
// vitesse/temps, à la fraction d'arc près (échantillonnage uniforme en arc).
function WeekRhythm({ daily }: { daily: number[] }) {
  const reduce = useReducedMotion()
  const week = daily.length === 7 ? daily : new Array(7).fill(0)
  // Index du jour courant (Lun=0 … Dim=6). On ne trace que le VÉCU : lundi →
  // aujourd'hui. Le futur n'existe pas encore.
  const todayIdx = Math.max(
    0,
    Math.min(6, Math.floor((Date.now() - weekStartMonday().getTime()) / 86_400_000)),
  )
  const vals = week.slice(0, todayIdx + 1)
  const hasData = vals.some((v) => v > 0)
  const max = Math.max(...week, 1)
  const W = 320
  const H = 40
  const step = W / 6
  const y = (v: number) => H - (v / max) * (H - 6) - 3
  const path = smoothLineFromValues(vals, step, y)
  const endX = todayIdx * step
  const fill = `${path} L ${endX} ${H} L 0 ${H} Z`

  // Trajectoire du point, uniforme en longueur d'arc → suit la tête du trait.
  const { xs, ys } = sampleSmoothByValues(vals, step, y, 64)

  // Progression unique 0→1 qui pilote TOUT (trait + tête). Pulse du glow à part.
  const progress = useMotionValue(reduce ? 1 : 0)
  const glowOpacity = useMotionValue(0.5)

  useEffect(() => {
    if (reduce) {
      progress.set(1)
      glowOpacity.set(0.5)
      return
    }
    progress.set(0)
    const draw = animate(progress, 1, { duration: DRAW, delay: DELAY, ease: DRAW_EASE })
    const pulse = animate(glowOpacity, [0.5, 0.66, 0.5, 0.66], {
      duration: 3,
      delay: DELAY,
      repeat: Infinity,
      repeatType: 'mirror',
      ease: 'easeInOut',
    })
    return () => {
      draw.stop()
      pulse.stop()
    }
    // progress/glowOpacity sont stables (useMotionValue) ; on (re)joue au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce])

  // Tête = point à la fraction d'arc `progress` (les deux cercles partagent cx/cy).
  const cx = useTransform(progress, (p) => interpAt(xs, p))
  const cy = useTransform(progress, (p) => interpAt(ys, p))
  // La pointe nette apparaît dès l'amorce ; l'aire se révèle derrière le trait.
  const penOpacity = useTransform(progress, [0, 0.04], [0, 1])
  const fillOpacity = useTransform(progress, [0.2, 0.85], [0, 1])

  return (
    // overflow visible → la lueur du point déborde la boîte du graphe au lieu
    // d'être tranchée net par le bord (et par la rangée des jours en dessous).
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="rhythm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.20" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        {/* Lueur en objectBoundingBox (relative au cercle) → elle SE DÉPLACE avec
            le point quand cx/cy s'animent. Falloff doux = vraie lumière. */}
        <radialGradient id="todayGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
          <stop offset="38%" stopColor="var(--accent)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {hasData ? (
        <>
          {/* Aire sous la courbe — révélée juste derrière le trait (suit `progress`). */}
          <motion.path d={fill} fill="url(#rhythm)" style={{ opacity: fillOpacity }} />
          {/* Le trait : son pathLength EST `progress` → sa tête = exactement le point. */}
          <motion.path
            d={path}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pathLength: progress }}
          />
          {/* Lueur : le point qui MÈNE, à la même fraction d'arc que la tête du trait. */}
          <motion.circle r={14} fill="url(#todayGlow)" cx={cx} cy={cy} style={{ opacity: glowOpacity }} />
          {/* La pointe nette du « stylo » qui trace. */}
          <motion.circle
            r={3}
            fill="var(--accent)"
            stroke="var(--bg)"
            strokeWidth={1}
            cx={cx}
            cy={cy}
            style={{ opacity: penOpacity }}
          />
        </>
      ) : (
        <line
          x1={0}
          y1={H - 3}
          x2={W}
          y2={H - 3}
          stroke="var(--hairline)"
          strokeWidth={1.5}
          strokeDasharray="3 5"
        />
      )}
    </svg>
  )
}
