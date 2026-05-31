'use client'

import { Dispatch, SetStateAction, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Serie, SessionState, WorkoutStep } from '../_lib/types'
import { WORKOUT_TYPES } from '../_lib/constants'
import { fmtChargeLabel, formatSessionAsText } from '../_lib/helpers'
import { invalidateAfterSeanceMutation } from '../_lib/invalidate'
import { useProfileHeader } from '../_lib/useProfileHeader'
import { Button, Card, IconButton, Pill, TopBar } from '../_components/primitives'
import { Check, ChevronDown, ChevronLeft, Copy, Minus, Plus, X } from '../_components/icons'

type Props = {
  session: SessionState
  setSession: Dispatch<SetStateAction<SessionState>>
  nav: (s: WorkoutStep) => void
  resetSession: () => void
}

export function SummaryScreen({ session, setSession, nav, resetSession }: Props) {
  const profileHeader = useProfileHeader()
  const nonEmptyExos = session.exos?.filter((e) => e.series.length > 0) ?? []
  const totalSets = nonEmptyExos.reduce((a, e) => a + e.series.length, 0)
  const totalVolume = nonEmptyExos.reduce(
    (a, e) => a + e.series.reduce((b, s) => (s.reps == null ? b : b + s.poids * s.reps), 0),
    0,
  )
  // Séries effectivement enregistrables (reps comptées).
  const countedExos = nonEmptyExos
    .map((e) => ({ ...e, series: e.series.filter((s) => s.reps != null) }))
    .filter((e) => e.series.length > 0)
  const type = WORKOUT_TYPES.find((t) => t.id === session.type)

  const updateSerie = (exoIdx: number, serieIdx: number, patch: Partial<Serie>) => {
    setSession((s) => {
      const exos = s.exos.map((ex, ei) =>
        ei !== exoIdx
          ? ex
          : {
              ...ex,
              series: ex.series.map((sr, si) => (si !== serieIdx ? sr : { ...sr, ...patch })),
            },
      )
      return { ...s, exos }
    })
  }

  const deleteSerie = (exoIdx: number, serieIdx: number) => {
    setSession((s) => {
      const exos = s.exos.map((ex, ei) =>
        ei !== exoIdx
          ? ex
          : {
              ...ex,
              series: ex.series.filter((_, si) => si !== serieIdx),
            },
      )
      return { ...s, exos }
    })
  }

  const deleteExo = (exoIdx: number) => {
    setSession((s) => ({ ...s, exos: s.exos.filter((_, i) => i !== exoIdx) }))
  }

  const addSerieToExo = (exoIdx: number) => {
    setSession((s) => ({ ...s, currentExoIndex: exoIdx }))
    nav('logging')
  }

  const addNewExo = () => {
    nav('exercise_select')
  }

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [expandedExos, setExpandedExos] = useState<Set<string>>(new Set())

  const toggleExpanded = (key: string) =>
    setExpandedExos((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const handleCopy = async () => {
    const text = formatSessionAsText(
      { ...session, exos: countedExos },
      profileHeader,
    )
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 2200)
    } catch {
      setCopyStatus('error')
      window.setTimeout(() => setCopyStatus('idle'), 2200)
    }
  }

  const handleValidate = async () => {
    setSaveStatus('saving')
    setErrorMsg('')
    // Strip non-comptées : la DB ne stocke que les séries effectivement comptées.
    const payload: SessionState = {
      ...session,
      exos: countedExos,
    }
    try {
      const res = await fetch('/api/seance/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionState: payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || `Erreur ${res.status}`)
        setSaveStatus('error')
        return
      }
      invalidateAfterSeanceMutation()
      setSaveStatus('saved')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Erreur réseau')
      setSaveStatus('error')
    }
  }

  const handleNewSession = () => {
    resetSession()
    nav('config')
  }

  const handleBackToMenu = () => {
    resetSession()
    nav('idle')
  }

  const canValidate = countedExos.length > 0

  return (
    <div
      className="app-scroll"
      style={{ minHeight: '100%', background: 'transparent' }}
    >
      <TopBar
        leading={
          <IconButton
            icon={<ChevronLeft size={18} />}
            label="retour"
            onClick={() => nav('logging')}
          />
        }
        title="Séance terminée"
        subtitle="Vérifie et confirme"
      />
      <div style={{ padding: '4px 16px 210px', animation: 'fadeUp 360ms ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Check size={22} stroke={2.4} />
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
              Beau travail<span style={{ color: 'var(--accent)' }}>.</span>
            </h2>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
              Séance {type?.label} · prête à enregistrer
            </p>
          </div>
        </div>

        <Card style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Exos', value: nonEmptyExos.length, suffix: '' },
              { label: 'Séries', value: totalSets, suffix: '' },
              { label: 'Volume', value: totalVolume.toLocaleString('fr-FR'), suffix: 'kg' },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--muted)',
                    fontWeight: 600,
                    letterSpacing: 0.3,
                    textTransform: 'uppercase',
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 20,
                    fontWeight: 600,
                    letterSpacing: -0.6,
                    marginTop: 4,
                  }}
                >
                  {s.value}
                  {s.suffix && (
                    <span style={{ fontSize: 11, color: 'var(--subtle)', marginLeft: 2 }}>
                      {s.suffix}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {session.exos?.length > 0 && (
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
              tape pour modifier
            </span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
          {session.exos?.map((exo, exoIdx) => {
            const isEmpty = exo.series.length === 0
            const key = exo.tempId || `exo-${exoIdx}`
            const expanded = expandedExos.has(key)
            const exoVolume = exo.series.reduce(
              (a, s) => (s.reps == null ? a : a + s.poids * s.reps),
              0,
            )
            const topSet = exo.series.reduce<Serie | null>(
              (best, s) => (!best || s.poids > best.poids ? s : best),
              null,
            )
            return (
              <Card key={key} style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => !isEmpty && toggleExpanded(key)}
                  aria-expanded={expanded}
                  aria-controls={`exo-body-${key}`}
                  disabled={isEmpty}
                  style={{
                    width: '100%',
                    appearance: 'none',
                    border: 'none',
                    cursor: isEmpty ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    background: 'var(--line-2)',
                    color: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 7,
                      background: 'var(--surface)',
                      color: 'var(--ink-2)',
                      boxShadow: '0 0 0 1px var(--line) inset',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {exoIdx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--ink)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {exo.nom}
                      </span>
                      {exo.isBodyweight && <Pill tone="accent">PDC</Pill>}
                      {exo.isUnilateral && <Pill tone="neutral">uni</Pill>}
                    </div>
                    {!isEmpty && !expanded && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--muted)',
                          fontFamily: 'var(--mono)',
                          marginTop: 2,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {exo.series.length} série{exo.series.length > 1 ? 's' : ''}
                        {topSet && (
                          <>
                            <span style={{ color: 'var(--subtle)' }}> · top </span>
                            {fmtChargeLabel(topSet.poids, exo.isBodyweight)}×{topSet.reps ?? 'JSP'}
                            <span style={{ color: 'var(--subtle)' }}> · vol </span>
                            {exoVolume.toLocaleString('fr-FR')}kg
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteExo(exoIdx)
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="supprimer l'exercice"
                    title="supprimer l'exercice"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      cursor: 'pointer',
                      background: 'transparent',
                      color: 'var(--subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <X size={13} />
                  </span>
                  {!isEmpty && (
                    <span
                      aria-hidden
                      style={{
                        display: 'inline-flex',
                        color: 'var(--muted)',
                        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 200ms ease',
                        flexShrink: 0,
                      }}
                    >
                      <ChevronDown size={16} />
                    </span>
                  )}
                </button>
                {isEmpty ? (
                  <div
                    style={{
                      padding: '14px 16px',
                      fontSize: 12,
                      color: 'var(--subtle)',
                      fontStyle: 'italic',
                    }}
                  >
                    aucune série — ne sera pas enregistré
                  </div>
                ) : expanded ? (
                  <div id={`exo-body-${key}`} style={{ animation: 'fadeUp 200ms ease both' }}>
                    {exo.series.map((s, si) => (
                      <EditableSerieRow
                        key={s.tempId || si}
                        index={si}
                        serie={s}
                        isBodyweight={exo.isBodyweight}
                        onPatch={(patch) => updateSerie(exoIdx, si, patch)}
                        onDelete={() => deleteSerie(exoIdx, si)}
                      />
                    ))}
                    <button
                      onClick={() => addSerieToExo(exoIdx)}
                      style={{
                        width: '100%',
                        appearance: 'none',
                        border: 'none',
                        borderTop: '1px solid var(--line-2)',
                        background: 'transparent',
                        color: 'var(--accent)',
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'var(--font)',
                        padding: '10px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Plus size={14} />
                      Ajouter une série
                    </button>
                  </div>
                ) : null}
              </Card>
            )
          })}

          <button
            onClick={addNewExo}
            style={{
              width: '100%',
              appearance: 'none',
              cursor: 'pointer',
              border: 'none',
              borderRadius: 'var(--radius)',
              background: 'var(--surface)',
              boxShadow: '0 0 0 1px dashed var(--line) inset',
              color: 'var(--ink-2)',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Plus size={14} />
            Ajouter un exercice
          </button>
        </div>
      </div>

      {/* Barre d'actions collée en bas du viewport. Portalisée sur <body> :
          le will-change:transform du StepSwitcher capture position:fixed. */}
      {createPortal(
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 30,
          padding: '14px 16px max(22px, env(safe-area-inset-bottom))',
          background: 'linear-gradient(180deg, transparent, var(--bg) 35%)',
          pointerEvents: 'none',
        }}
      >
        <div style={{ maxWidth: 480, margin: '0 auto', pointerEvents: 'auto' }}>
        {saveStatus === 'saved' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: 'color-mix(in oklch, var(--ok) 18%, var(--surface))',
                color: 'var(--ok)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontWeight: 600,
                fontSize: 14,
                animation: 'fadeUp 240ms ease both',
              }}
            >
              <Check size={16} stroke={2.4} />
              <span>Séance enregistrée</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleCopy}
                aria-label={
                  copyStatus === 'copied'
                    ? 'Copié'
                    : copyStatus === 'error'
                      ? 'Impossible de copier'
                      : 'Copier la séance pour LLM (markdown)'
                }
                title={
                  copyStatus === 'copied'
                    ? 'Copié dans le presse-papier'
                    : copyStatus === 'error'
                      ? 'Impossible de copier'
                      : 'Copier pour LLM (markdown)'
                }
                style={{
                  width: 52,
                  height: 52,
                  flexShrink: 0,
                  appearance: 'none',
                  border: 'none',
                  borderRadius: 12,
                  cursor: 'pointer',
                  background:
                    copyStatus === 'copied' ? 'var(--accent-soft)' : 'var(--surface)',
                  color:
                    copyStatus === 'copied' ? 'var(--accent)' : 'var(--ink-2)',
                  boxShadow:
                    copyStatus === 'copied'
                      ? '0 0 0 1px var(--accent-line) inset'
                      : '0 0 0 1px var(--line) inset',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 160ms ease',
                }}
              >
                {copyStatus === 'copied' ? (
                  <Check size={18} stroke={2.4} />
                ) : (
                  <Copy size={18} />
                )}
              </button>
              <Button
                onClick={handleNewSession}
                icon={<Plus size={16} />}
                style={{ flex: 1 }}
              >
                Nouvelle séance
              </Button>
            </div>
            <button
              type="button"
              onClick={handleBackToMenu}
              style={{
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--muted)',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'var(--font)',
                padding: '8px 12px',
                alignSelf: 'center',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                textDecorationColor: 'var(--line)',
              }}
            >
              Retour au menu principal
            </button>
          </div>
        ) : saveStatus === 'error' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: 'color-mix(in oklch, var(--warn) 18%, var(--surface))',
                color: 'var(--warn)',
                fontWeight: 500,
                fontSize: 13,
                lineHeight: 1.4,
              }}
            >
              {errorMsg || 'Erreur lors de la sauvegarde'}
            </div>
            <Button onClick={handleValidate}>Réessayer</Button>
            <Button
              variant="secondary"
              onClick={() => {
                resetSession()
                nav('idle')
              }}
            >
              Annuler
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Button
              onClick={handleValidate}
              disabled={saveStatus === 'saving' || !canValidate}
              icon={saveStatus === 'saving' ? undefined : <Check size={16} />}
            >
              {saveStatus === 'saving'
                ? 'Enregistrement…'
                : canValidate
                  ? 'Valider la séance'
                  : 'Ajoute au moins une série'}
            </Button>
            <Button
              variant="secondary"
              disabled={saveStatus === 'saving'}
              onClick={() => {
                resetSession()
                nav('idle')
              }}
            >
              Annuler
            </Button>
          </div>
        )}
        </div>
      </div>,
        document.body,
      )}
    </div>
  )
}

function EditableSerieRow({
  index,
  serie,
  isBodyweight,
  onPatch,
  onDelete,
}: {
  index: number
  serie: Serie
  isBodyweight?: boolean
  onPatch: (patch: Partial<Serie>) => void
  onDelete: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        padding: '12px 12px',
        borderTop: '1px solid var(--line-2)',
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: 'var(--surface)',
          color: 'var(--ink-2)',
          boxShadow: '0 0 0 1px var(--line) inset',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {index + 1}
      </div>
      {isBodyweight && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.3,
            color: 'var(--accent)',
            background: 'var(--accent-soft)',
            padding: '2px 5px',
            borderRadius: 5,
            flexShrink: 0,
          }}
          title="poids du corps — lest"
        >
          {serie.poids > 0 ? 'PDC+' : 'PDC'}
        </span>
      )}
      <StepperCell
        value={serie.poids}
        onChange={(v) => onPatch({ poids: Math.max(0, v ?? 0) })}
        step={2.5}
        decimals={1}
        suffix="kg"
        width="4.5ch"
      />
      <span style={{ fontFamily: 'var(--mono)', color: 'var(--subtle)', fontSize: 12 }}>×</span>
      <StepperCell
        value={serie.reps}
        onChange={(v) =>
          onPatch({ reps: v == null ? null : Math.max(0, Math.round(v)) })
        }
        step={1}
        decimals={0}
        width="3.2ch"
        allowNull
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--subtle)', fontWeight: 500 }}>RIR</span>
        <SimpleNumCell
          value={serie.rir}
          decimals={0}
          onChange={(v) =>
            onPatch({ rir: v == null ? null : Math.max(0, Math.round(v)) })
          }
          width="2.6ch"
          allowNull
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
        <button
          onClick={() => onPatch({ degressive: !serie.degressive })}
          title="dégressive"
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: 'none',
            cursor: 'pointer',
            background: serie.degressive ? 'var(--accent)' : 'var(--surface-2)',
            color: serie.degressive ? 'var(--accent-ink)' : 'var(--subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 140ms',
          }}
        >
          <DropIcon active={serie.degressive} size={12} />
        </button>
        <button
          onClick={onDelete}
          aria-label="supprimer"
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

function StepperCell({
  value,
  onChange,
  step,
  decimals = 0,
  suffix,
  width,
  allowNull = false,
}: {
  value: number | null
  onChange: (v: number | null) => void
  step: number
  decimals?: number
  suffix?: string
  width?: string
  allowNull?: boolean
}) {
  const round = (n: number) =>
    decimals ? Number(n.toFixed(decimals)) : Math.round(n)
  const isNull = value === null

  const handleDec = () => {
    if (isNull) return
    const next = (value as number) - step
    if (allowNull && next < 0) {
      onChange(null)
      return
    }
    onChange(round(next))
  }
  const handleInc = () => {
    if (isNull) {
      onChange(0)
      return
    }
    onChange(round((value as number) + step))
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0,
        background: 'var(--line-2)',
        borderRadius: 8,
        padding: 2,
      }}
    >
      <button
        type="button"
        onClick={handleDec}
        aria-label="diminuer"
        style={{
          width: 24,
          height: 26,
          border: 'none',
          background: 'transparent',
          color: 'var(--muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
        }}
      >
        <Minus size={12} />
      </button>
      <SimpleNumCell
        value={value}
        decimals={decimals}
        onChange={onChange}
        suffix={suffix}
        width={width}
        allowNull={allowNull}
      />
      <button
        type="button"
        onClick={handleInc}
        aria-label="augmenter"
        style={{
          width: 24,
          height: 26,
          border: 'none',
          background: 'transparent',
          color: 'var(--muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
        }}
      >
        <Plus size={12} />
      </button>
    </div>
  )
}

function SimpleNumCell({
  value,
  onChange,
  decimals = 0,
  suffix,
  width,
  allowNull = false,
}: {
  value: number | null
  onChange: (v: number | null) => void
  decimals?: number
  suffix?: string
  width?: string
  allowNull?: boolean
}) {
  const [text, setText] = useState<string | null>(null)
  const [focus, setFocus] = useState(false)
  const isNull = value === null
  const formatted = isNull
    ? focus
      ? ''
      : 'JSP'
    : decimals
      ? Number(value as number).toFixed(decimals).replace('.', ',')
      : String(value)
  const display = text ?? formatted

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 2,
        padding: '4px 6px',
        borderRadius: 6,
        background: focus ? 'var(--accent-soft)' : 'transparent',
        boxShadow: focus ? '0 0 0 1px var(--accent) inset' : 'none',
        transition: 'all 120ms',
      }}
    >
      <input
        value={display}
        inputMode="decimal"
        onFocus={(e) => {
          setFocus(true)
          setText(isNull ? '' : String(value).replace('.', ','))
          requestAnimationFrame(() => e.target.select())
        }}
        onChange={(e) => {
          const raw = e.target.value
          setText(raw)
          const normalized = raw.replace(',', '.')
          if (normalized === '' || normalized === '-' || normalized === '.') {
            if (allowNull) onChange(null)
            else onChange(0)
            return
          }
          const n = parseFloat(normalized)
          if (!isNaN(n)) {
            onChange(decimals ? Number(n.toFixed(decimals)) : Math.round(n))
          }
        }}
        onBlur={() => {
          setFocus(false)
          setText(null)
        }}
        style={{
          width,
          textAlign: 'center',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: 'var(--mono)',
          fontSize: 13,
          fontWeight: 600,
          color: isNull && !focus ? 'var(--subtle)' : 'var(--ink)',
          padding: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      />
      {suffix && !isNull && (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--subtle)' }}>
          {suffix}
        </span>
      )}
    </span>
  )
}

function DropIcon({ active, size = 14 }: { active?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 5l14 14M12 19h7v-7"
        stroke={active ? 'var(--accent-ink)' : 'currentColor'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
