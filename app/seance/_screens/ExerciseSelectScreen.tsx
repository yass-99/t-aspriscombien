'use client'

import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react'
import type { SessionState, WorkoutStep } from '../_lib/types'
import { SUGGESTIONS, WORKOUT_TYPES } from '../_lib/constants'
import { formatMMSS, newId } from '../_lib/helpers'
import { Button, FinishPill, IconButton, Pill, Steps, TopBar } from '../_components/primitives'
import { Check, ChevronLeft, ChevronRight, Dumbbell, Timer } from '../_components/icons'

type Props = {
  session: SessionState
  setSession: Dispatch<SetStateAction<SessionState>>
  nav: (s: WorkoutStep) => void
}

export function ExerciseSelectScreen({ session, setSession, nav }: Props) {
  const isFirst = !session.exos?.length
  const nextIndex = session.exos?.length || 0
  const prevExos = session.exos || []

  const [name, setName] = useState(isFirst ? session.exos?.[0]?.nom || '' : '')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const sugg = SUGGESTIONS[session.type] || SUGGESTIONS.push
  const type = WORKOUT_TYPES.find((t) => t.id === session.type)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  const canContinue = name.trim().length > 1

  const confirm = () => {
    setSession((s) => {
      const trimmed = name.trim()
      if (isFirst) {
        return {
          ...s,
          exos: [{ tempId: newId('e'), nom: trimmed, series: [] }],
          currentExoIndex: 0,
          currentSerieIndex: 0,
        }
      }
      return {
        ...s,
        exos: [...s.exos, { tempId: newId('e'), nom: trimmed, series: [] }],
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
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
      }}
    >
      <TopBar
        leading={
          <IconButton
            icon={<ChevronLeft size={18} />}
            label="retour"
            onClick={() => nav(isFirst ? 'config' : 'logging')}
          />
        }
        title={isFirst ? 'Nouvelle séance' : 'Exercice suivant'}
        subtitle={isFirst ? 'Étape 2 / 3' : `Exo ${nextIndex + 1}`}
        trailing={!isFirst ? <FinishPill onClick={() => nav('summary')} /> : null}
      />
      {isFirst && (
        <div style={{ padding: '0 20px 14px' }}>
          <Steps count={3} current={1} />
        </div>
      )}

      <div
        style={{
          flex: 1,
          padding: '8px 20px 24px',
          animation: 'fadeUp 360ms ease both',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
            flexWrap: 'wrap',
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
          }}
        >
          {isFirst ? 'Premier exercice' : 'Prochain exercice'}
          <span style={{ color: 'var(--accent)' }}> ?</span>
        </h2>
        <p style={{ margin: '0 0 18px', color: 'var(--muted)', fontSize: 14 }}>
          {isFirst
            ? 'On commence par celui qui te demande le plus de concentration.'
            : 'Choisis ce qui suit. Tu peux toujours revenir.'}
        </p>

        {!isFirst && (
          <div style={{ marginBottom: 16, animation: 'fadeUp 280ms ease both' }}>
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

        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 14,
            boxShadow: '0 0 0 1px var(--line) inset',
            padding: '14px 16px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              fontWeight: 500,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Nom de l&apos;exercice
          </div>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isFirst ? 'Développé couché' : 'Élévations latérales'}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--font)',
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--ink)',
              letterSpacing: -0.4,
              padding: 0,
            }}
          />
        </div>

        <div style={{ marginTop: 22 }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              fontWeight: 600,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Suggestions
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sugg
              .filter((s) => !prevExos.some((e) => e.nom === s))
              .map((s) => (
                <button
                  key={s}
                  onClick={() => setName(s)}
                  style={{
                    appearance: 'none',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: 999,
                    background: name === s ? 'var(--accent-soft)' : 'var(--surface)',
                    color: name === s ? 'var(--accent)' : 'var(--ink-2)',
                    boxShadow:
                      name === s
                        ? '0 0 0 1px var(--accent) inset'
                        : '0 0 0 1px var(--line) inset',
                    fontSize: 13,
                    fontWeight: 500,
                    border: 'none',
                    transition: 'all 140ms',
                  }}
                >
                  {s}
                </button>
              ))}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '14px 20px 22px',
          background: 'linear-gradient(180deg, transparent, var(--bg) 30%)',
        }}
      >
        <Button
          onClick={confirm}
          disabled={!canContinue}
          trailingIcon={<ChevronRight size={16} />}
        >
          {isFirst ? 'Commencer' : 'Commencer cet exercice'}
        </Button>
      </div>
    </div>
  )
}
