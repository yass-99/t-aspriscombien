'use client'

import { Dispatch, SetStateAction, useState } from 'react'
import type { SessionState, WorkoutStep } from '../_lib/types'
import { WORKOUT_TYPES, REST_PRESETS } from '../_lib/constants'
import { formatMMSS } from '../_lib/helpers'
import { Button, IconButton, Steps, TopBar } from '../_components/primitives'
import { Check, ChevronLeft, ChevronRight, Minus, Plus, Timer } from '../_components/icons'

type Props = {
  session: SessionState
  setSession: Dispatch<SetStateAction<SessionState>>
  nav: (s: WorkoutStep) => void
}

export function ConfigScreen({ session, setSession, nav }: Props) {
  const [type, setType] = useState(session.type || 'push')
  const [rest, setRest] = useState(session.restTargetSec || 90)
  const canContinue = !!type && rest > 0
  const confirm = () => {
    // Starting (or restarting) a session from the config step: always wipe any
    // leftover exos from a previous run the user may have abandoned via the X.
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
            onClick={() => nav('idle')}
          />
        }
        title="Nouvelle séance"
        subtitle="Étape 1 / 3"
      />
      <div style={{ padding: '0 20px 14px' }}>
        <Steps count={3} current={0} />
      </div>
      <div
        style={{
          flex: 1,
          padding: '8px 20px 24px',
          animation: 'fadeUp 360ms ease both',
        }}
      >
        <h2
          style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: -1.2,
            margin: '8px 0 4px',
            fontFamily: 'var(--display)',
          }}
        >
          Quel type d&apos;entraînement
          <span style={{ color: 'var(--accent)' }}> ?</span>
        </h2>
        <p style={{ margin: '0 0 18px', color: 'var(--muted)', fontSize: 14 }}>
          Tu pourras toujours ajouter des exercices en cours de séance.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginBottom: 28,
          }}
        >
          {WORKOUT_TYPES.map((t) => {
            const active = type === t.id
            return (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                style={{
                  appearance: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  padding: '14px 14px 12px',
                  borderRadius: 14,
                  background: active ? 'var(--accent-soft)' : 'var(--surface)',
                  boxShadow: active
                    ? '0 0 0 1.5px var(--accent) inset, 0 4px 14px -6px color-mix(in oklch, var(--accent) 45%, transparent)'
                    : '0 0 0 1px var(--line) inset',
                  transition: 'all 160ms ease',
                  border: 'none',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: active ? 'var(--accent)' : 'var(--surface-2)',
                    color: active ? 'var(--accent-ink)' : 'var(--ink-2)',
                    fontFamily: 'var(--mono)',
                    fontWeight: 600,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                    transition: 'all 200ms',
                  }}
                >
                  {t.emoji}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t.label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{t.hint}</div>
                {active && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      background: 'var(--accent)',
                      color: 'var(--accent-ink)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
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

        <h3
          style={{
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: -0.3,
            margin: '0 0 6px',
          }}
        >
          Temps de repos cible
        </h3>
        <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 13 }}>
          Le minuteur démarre automatiquement après chaque série.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            marginBottom: 12,
          }}
        >
          {REST_PRESETS.map((s) => {
            const active = rest === s
            return (
              <button
                key={s}
                onClick={() => setRest(s)}
                style={{
                  height: 56,
                  borderRadius: 12,
                  cursor: 'pointer',
                  border: 'none',
                  background: active ? 'var(--accent-soft)' : 'var(--surface)',
                  color: active ? 'var(--accent)' : 'var(--ink)',
                  boxShadow: active
                    ? '0 0 0 1px var(--accent-line) inset'
                    : '0 0 0 1px var(--line) inset',
                  fontFamily: 'var(--mono)',
                  fontWeight: 600,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 160ms',
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
      </div>

      <div
        style={{
          padding: '14px 20px 22px',
          background: 'linear-gradient(180deg, transparent, var(--bg) 30%)',
        }}
      >
        <Button onClick={confirm} disabled={!canContinue} trailingIcon={<ChevronRight size={16} />}>
          Continuer
        </Button>
      </div>
    </div>
  )
}
