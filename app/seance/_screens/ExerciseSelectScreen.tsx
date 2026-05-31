'use client'

import { CSSProperties, Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import type { NavContext, SessionState, WorkoutStep } from '../_lib/types'
import { SUGGESTIONS, WORKOUT_TYPES } from '../_lib/constants'
import { formatMMSS, newId } from '../_lib/helpers'
import { useExos, filterExos, MAX_EXO_PILLS, type ExoSuggestion } from '../_lib/useExos'
import { Button, IconButton, Pill, Steps, StopSquare, TopBar } from '../_components/primitives'
import { Check, ChevronLeft, ChevronRight, Dumbbell, Search, Timer } from '../_components/icons'

type Props = {
  session: SessionState
  setSession: Dispatch<SetStateAction<SessionState>>
  nav: (s: WorkoutStep, ctx?: NavContext) => void
}

// Cascade d'entrée : chaque élément de l'écran monte en fondu l'un après
// l'autre (même grammaire de mouvement que ConfigScreen). Le CTA bas est
// volontairement EXCLU de cette cascade — il reste figé, indépendant du reste.
const ENTER_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const rise = (delayMs: number, durMs = 520): CSSProperties => ({
  animation: `fadeUp ${durMs}ms ${delayMs}ms ${ENTER_EASE} both`,
})

export function ExerciseSelectScreen({ session, setSession, nav }: Props) {
  const isFirst = !session.exos?.length
  const nextIndex = session.exos?.length || 0
  const prevExos = session.exos || []

  const [name, setName] = useState(isFirst ? session.exos?.[0]?.nom || '' : '')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const type = WORKOUT_TYPES.find((t) => t.id === session.type)
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

  const { exos: dbExos, loading: exosLoading } = useExos()

  // Pas d'autofocus : sur mobile il ouvrirait le clavier d'entrée et masquerait
  // les pills de suggestions, qui sont le moyen prioritaire de choisir un exo.
  // Le champ ne reçoit le focus que si l'utilisateur le touche explicitement.
  const canContinue = name.trim().length > 1

  // Liste filtrée des exos précédemment faits, exclus ceux déjà ajoutés dans cette séance.
  // Sans requête : strict sur le type de séance courant (jambes → uniquement jambes).
  const candidates = useMemo(() => {
    const usedNames = new Set(prevExos.map((e) => e.nom.trim().toLowerCase()))
    const filtered = filterExos(dbExos, name, session.type)
    return filtered
      .filter((e) => !usedNames.has(e.nom.trim().toLowerCase()))
      .slice(0, MAX_EXO_PILLS)
  }, [dbExos, name, session.type, prevExos])

  // Suggestions statiques pour COMPLÉTER quand la DB n'a pas assez d'exos
  // du bon type (premier passage sur jambes par ex.). On comble jusqu'à MAX.
  const fallbackSugg = useMemo(() => {
    const dbNames = new Set(candidates.map((e) => e.nom.trim().toLowerCase()))
    const prevNames = new Set(prevExos.map((e) => e.nom.trim().toLowerCase()))
    const base = SUGGESTIONS[session.type] || SUGGESTIONS.push
    const slots = MAX_EXO_PILLS - candidates.length
    if (slots <= 0) return []
    return base
      .filter((s) => {
        const k = s.trim().toLowerCase()
        return !dbNames.has(k) && !prevNames.has(k)
      })
      .slice(0, slots)
  }, [session.type, candidates, prevExos])

  const confirm = (chosenName?: string) => {
    const finalName = (chosenName ?? name).trim()
    if (finalName.length < 2) return
    // Pré-remplit les flags PDC / unilatéral depuis le dernier usage du même exo.
    const nomKey = finalName.toLowerCase()
    const match = dbExos.find((e) => e.nom.trim().toLowerCase() === nomKey)
    const newExo = {
      tempId: newId('e'),
      nom: finalName,
      isBodyweight: match?.lastIsBodyweight ?? false,
      isUnilateral: match?.lastIsUnilateral ?? false,
      series: [],
    }
    setSession((s) => {
      if (isFirst) {
        return {
          ...s,
          exos: [newExo],
          currentExoIndex: 0,
          currentSerieIndex: 0,
        }
      }
      return {
        ...s,
        exos: [...s.exos, newExo],
        currentExoIndex: s.exos.length,
        currentSerieIndex: 0,
      }
    })
    nav('logging')
  }

  return (
    <div
      className="app-scroll"
      style={{
        // 100dvh (et non 100%, qui ne se résout pas faute de hauteur parente) :
        // garantit que la barre sticky se colle au bas réel du viewport, sans
        // écart sous le flou quand le contenu est court. Cf. ConfigScreen.
        minHeight: 'calc(100dvh - env(safe-area-inset-top, 0px))',
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent',
      }}
    >
      <TopBar
        leading={
          <IconButton
            icon={<ChevronLeft size={18} />}
            label="retour"
            variant="outlined"
            // isFirst → retour à la config sur l'étape chrono (le step juste
            // avant), sinon retour au logging de l'exo en cours.
            onClick={() =>
              isFirst ? nav('config', { configStep: 'chrono' }) : nav('logging')
            }
          />
        }
        title={isFirst ? 'Nouvelle séance' : 'Exercice suivant'}
        subtitle={
          isFirst ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
              <Steps count={4} current={2} />
            </div>
          ) : (
            `Exo ${nextIndex + 1}`
          )
        }
      />

      <div
        style={{
          flex: 1,
          padding: '8px 20px 24px',
          // L'écran entre en fondu pur (StepSwitcher) ; le mouvement vit ici, au
          // niveau de CHAQUE élément qui monte en cascade. Plus aucun « bloc »
          // qui glisse d'un coup → arrivée aussi fluide que ConfigScreen.
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
            flexWrap: 'wrap',
            ...rise(40),
          }}
        >
          <Pill tone="accent" icon={<Dumbbell size={10} />}>
            Séance {type?.label}
          </Pill>
          <Pill tone="outline" icon={<Timer size={10} />}>
            {formatMMSS(session.restTargetSec)} repos
          </Pill>
          {!isFirst && (
            <Pill tone="outline">
              {prevExos.length} exo{prevExos.length > 1 ? 's' : ''}
            </Pill>
          )}
        </div>
        <h2
          style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: -1.2,
            margin: '8px 0 6px',
            fontFamily: 'var(--display)',
            ...rise(110),
          }}
        >
          {isFirst ? 'Premier exercice' : 'Prochain exercice'}
          <span style={{ color: 'var(--brand)' }}> ?</span>
        </h2>
        <p style={{ margin: '0 0 18px', color: 'var(--muted)', fontSize: 14, ...rise(160) }}>
          {isFirst
            ? 'On commence par celui qui te demande le plus de concentration.'
            : 'Choisis ce qui suit. Tu peux toujours revenir.'}
        </p>

        {!isFirst && (
          <div style={{ marginBottom: 16, ...rise(200) }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                fontWeight: 600,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Déjà fait
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {prevExos.map((ex, i) => (
                <div
                  key={ex.tempId || i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'var(--surface)',
                    boxShadow: '0 0 0 1px var(--line) inset',
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
                      fontFamily: 'var(--mono)',
                      fontWeight: 600,
                      fontSize: 11,
                    }}
                  >
                    {i + 1}
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--ink)',
                      flex: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {ex.nom}
                  </span>
                  {ex.isBodyweight && <Pill tone="accent">PDC</Pill>}
                  {ex.isUnilateral && <Pill tone="neutral">uni</Pill>}
                  <span
                    style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}
                  >
                    {ex.series.length} série{ex.series.length > 1 ? 's' : ''}
                  </span>
                  <Check size={13} color="var(--ok)" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pills EN PREMIER : c'est le moyen prioritaire de choisir un exo
            (déjà faits avec data pré-remplie, ou suggestions jamais faites).
            Cibles tactiles agrandies. La recherche n'est qu'un repli, en dessous. */}
        {!exosLoading && (candidates.length > 0 || fallbackSugg.length > 0) && (
          <div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-2)',
                fontWeight: 700,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
                marginBottom: 12,
                ...rise(240),
              }}
            >
              {name.trim()
                ? 'Résultats'
                : candidates.length > 0
                  ? `Tes ${type?.label ?? 'exercices'}`
                  : `Suggestions ${type?.label ?? ''}`.trim()}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {/* Chaque pilule montée dans son propre span animé : l'entrée est
                  isolée du bouton (préserve l'opacity de StaticPill) et chaque
                  élément arrive l'un après l'autre. */}
              {candidates.map((exo, i) => (
                <span key={exo.nom} style={{ display: 'inline-flex', ...rise(270 + i * 30, 380) }}>
                  <ExoPill
                    exo={exo}
                    selected={name.trim().toLowerCase() === exo.nom.toLowerCase()}
                    onPick={() => setName(exo.nom)}
                  />
                </span>
              ))}
              {fallbackSugg.map((s, i) => (
                <span
                  key={s}
                  style={{ display: 'inline-flex', ...rise(270 + (candidates.length + i) * 30, 380) }}
                >
                  <StaticPill label={s} selected={name === s} onPick={() => setName(s)} />
                </span>
              ))}
            </div>
          </div>
        )}

        {/* État vide quand on cherche un terme qui ne matche rien en DB */}
        {!exosLoading && candidates.length === 0 && name.trim().length > 1 && (
          <div
            style={{
              marginTop: 16,
              padding: '14px 16px',
              borderRadius: 12,
              background: 'var(--surface-2)',
              boxShadow: '0 0 0 1px var(--line) inset',
              fontSize: 12,
              color: 'var(--muted)',
              lineHeight: 1.5,
              ...rise(240),
            }}
          >
            Aucun exo en DB pour «{' '}
            <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{name.trim()}</span> ». Tu
            peux le valider pour le créer.
          </div>
        )}

        {/* Repli secondaire : chercher dans tout l'historique ou créer un exo
            absent des pills. Champ compact et discret — pas le héros de l'écran. */}
        <div
          style={{
            marginTop: 22,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--surface)',
            borderRadius: 12,
            boxShadow: '0 0 0 1px var(--line) inset',
            padding: '11px 14px',
            ...rise(320),
          }}
        >
          <Search size={15} color="var(--subtle)" />
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canContinue) {
                e.preventDefault()
                confirm()
              }
            }}
            aria-label="Nom de l'exercice"
            placeholder={isFirst ? 'Autre exercice ? Cherche ou crée…' : 'Cherche ou crée un exercice…'}
            enterKeyHint="done"
            // Coupe l'autocomplétion native du navigateur (historique de saisie,
            // gestionnaires de mots de passe) qui recouvrait les pills.
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-autocomplete="none"
            data-1p-ignore
            data-lpignore="true"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--font)',
              // 16px mini : évite l'auto-zoom iOS au focus du champ.
              fontSize: 16,
              fontWeight: 500,
              color: 'var(--ink)',
              letterSpacing: -0.2,
              padding: 0,
            }}
          />
        </div>
      </div>

      <div
        style={{
          // Collé en bas du viewport : le CTA reste à portée du pouce même si la
          // liste de pills déborde. Marge haute = zone de fondu du flou progressif.
          position: 'sticky',
          bottom: 0,
          zIndex: 2,
          paddingTop: 56,
        }}
      >
        {/* Couche verre à flou progressif (repris de l'IdleScreen) : le masque
            dégradé efface flou + teinte en remontant → frontière floutée, pas un
            trait. Le bouton vit dans une couche sœur non masquée. */}
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
            // Couche GPU persistante (cf. ConfigScreen) : évite l'écart de
            // rendu couleur CPU↔GPU du bouton entre repos et animation.
            willChange: 'transform',
            transform: 'translateZ(0)',
            padding: '0 20px calc(var(--cta-pad-bottom, 12px) + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {/* Premier exo → CTA pleine largeur. Exos suivants → « Commencer cet
              exercice » et « Stop » côte à côte : terminer la séance vit en bas,
              près du pouce, plus en haut dans la TopBar. */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              onClick={() => confirm()}
              disabled={!canContinue}
              gpu
              trailingIcon={<ChevronRight size={16} />}
              style={{ flex: 1, boxShadow: 'none' }}
            >
              {isFirst ? 'Commencer' : 'Commencer'}
            </Button>
            {!isFirst && <StopButton onClick={() => nav('summary')} />}
          </div>
        </div>
      </div>
    </div>
  )
}

// Bouton « Stop » : clôture la séance (= aller au récap), sans modal. Ton
// danger, carré explicite, posé en bas à côté de « Commencer cet exercice ».
// Même grammaire que le StopButton du LoggingScreen.
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

function StaticPill({
  label,
  selected,
  onPick,
}: {
  label: string
  selected: boolean
  onPick: () => void
}) {
  return (
    <button
      onClick={onPick}
      style={{
        appearance: 'none',
        cursor: 'pointer',
        padding: '11px 15px',
        borderRadius: 999,
        background: selected ? 'var(--brand-soft)' : 'var(--surface)',
        // Texte clair (brand-bright) quand sélectionné : le brand foncé était
        // illisible sur le fond brand-soft, lui aussi sombre.
        color: selected ? 'var(--brand-bright)' : 'var(--ink-2)',
        boxShadow: selected
          ? '0 0 0 1.5px var(--brand) inset'
          : '0 0 0 1px var(--line) inset',
        fontSize: 14,
        fontWeight: 500,
        border: 'none',
        transition: 'all 140ms',
        fontFamily: 'var(--font)',
        opacity: 0.9,
      }}
    >
      {label}
    </button>
  )
}

function ExoPill({
  exo,
  selected,
  onPick,
}: {
  exo: ExoSuggestion
  selected: boolean
  onPick: () => void
}) {
  return (
    <button
      onClick={onPick}
      title={
        exo.lastPoids != null && exo.lastReps != null
          ? `${exo.count}× · dernière ${exo.lastPoids}kg × ${exo.lastReps}`
          : `${exo.count}×`
      }
      style={{
        appearance: 'none',
        cursor: 'pointer',
        padding: '11px 15px',
        borderRadius: 999,
        background: selected ? 'var(--brand-soft)' : 'var(--surface)',
        // Texte clair (brand-bright) quand sélectionné : le brand foncé était
        // illisible sur le fond brand-soft, lui aussi sombre.
        color: selected ? 'var(--brand-bright)' : 'var(--ink-2)',
        boxShadow: selected
          ? '0 0 0 1.5px var(--brand) inset'
          : '0 0 0 1px var(--line) inset',
        fontSize: 14,
        fontWeight: 500,
        border: 'none',
        transition: 'all 140ms',
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 6,
        fontFamily: 'var(--font)',
      }}
    >
      <span>{exo.nom}</span>
      {exo.lastIsBodyweight && (
        <span
          style={{
            fontSize: 9,
            color: selected ? 'var(--brand-bright)' : 'var(--subtle)',
            fontWeight: 700,
            letterSpacing: 0.3,
          }}
        >
          PDC
        </span>
      )}
      {exo.lastPoids != null && (
        <span
          style={{
            fontSize: 10,
            color: selected ? 'var(--brand-bright)' : 'var(--subtle)',
            fontFamily: 'var(--mono)',
            fontVariantNumeric: 'tabular-nums',
            opacity: 0.85,
          }}
        >
          {exo.lastIsBodyweight ? `+${exo.lastPoids}kg` : `${exo.lastPoids}kg`}
        </span>
      )}
    </button>
  )
}
