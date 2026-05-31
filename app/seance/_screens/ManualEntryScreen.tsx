'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { NavFn } from '../_lib/types'
import { REST_PRESETS, SUGGESTIONS, WORKOUT_TYPES } from '../_lib/constants'
import { formatMMSS, newId } from '../_lib/helpers'
import {
  useExos,
  filterExos,
  MAX_EXO_PILLS,
  type ExoSuggestion,
} from '../_lib/useExos'
import { invalidateAfterSeanceMutation } from '../_lib/invalidate'
import { Button, Card, IconButton, TopBar } from '../_components/primitives'
import { ChevronLeft, Minus, Plus, Search, Timer } from '../_components/icons'
import { useToast } from '../../_components/Toast'

type Props = {
  seanceId: string | null
  nav: NavFn
}

type LocalSerie = {
  tempId: string
  poids: number
  reps: number
  rir: number
  degressive: boolean
}
type LocalExo = {
  tempId: string
  nom: string
  isBodyweight: boolean
  isUnilateral: boolean
  series: LocalSerie[]
}

type LocalSeance = {
  date: string
  type: string
  restTargetSec: number
  exos: LocalExo[]
}

const todayISO = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function initialSeance(): LocalSeance {
  return {
    date: todayISO(),
    type: 'push',
    restTargetSec: 90,
    exos: [],
  }
}

export function ManualEntryScreen({ seanceId, nav }: Props) {
  const isEdit = !!seanceId
  const [seance, setSeance] = useState<LocalSeance>(initialSeance)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [addingExo, setAddingExo] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (!seanceId) {
      setLoading(false)
      return
    }
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/seances/${seanceId}`)
        if (cancelled) return
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          toast.error(e.error ?? `Erreur ${res.status}`)
          setLoading(false)
          return
        }
        const d = (await res.json()) as {
          seance: {
            date: string
            type: string
            restTargetSec: number
            exos: {
              id: string
              nom: string
              isBodyweight?: boolean
              isUnilateral?: boolean
              series: { id: string; poids: number; reps: number; rir: number; degressive: boolean }[]
            }[]
          }
        }
        setSeance({
          date: d.seance.date,
          type: d.seance.type,
          restTargetSec: d.seance.restTargetSec,
          exos: d.seance.exos.map((e) => ({
            tempId: newId('e'),
            nom: e.nom,
            isBodyweight: !!e.isBodyweight,
            isUnilateral: !!e.isUnilateral,
            series: e.series.map((s) => ({
              tempId: newId('s'),
              poids: s.poids,
              reps: s.reps,
              rir: s.rir,
              degressive: s.degressive,
            })),
          })),
        })
      } catch (e) {
        if (!cancelled) toast.warn(e instanceof Error ? e.message : 'Erreur réseau')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [seanceId, toast])

  const validExos = useMemo(
    () => seance.exos.filter((e) => e.nom.trim().length > 0 && e.series.length > 0),
    [seance.exos],
  )
  const canSave = validExos.length > 0 && !!seance.type && !!seance.date

  const updateExo = (tempId: string, patch: Partial<LocalExo>) => {
    setSeance((s) => ({
      ...s,
      exos: s.exos.map((e) => (e.tempId === tempId ? { ...e, ...patch } : e)),
    }))
  }
  const removeExo = (tempId: string) => {
    setSeance((s) => ({ ...s, exos: s.exos.filter((e) => e.tempId !== tempId) }))
  }
  const addExo = (nom: string, isBodyweight = false, isUnilateral = false) => {
    const trimmed = nom.trim()
    if (!trimmed) return
    setSeance((s) => ({
      ...s,
      exos: [
        ...s.exos,
        {
          tempId: newId('e'),
          nom: trimmed,
          isBodyweight,
          isUnilateral,
          series: [{ tempId: newId('s'), poids: 0, reps: 8, rir: 2, degressive: false }],
        },
      ],
    }))
    setAddingExo(false)
  }
  const addSerie = (exoTempId: string) => {
    setSeance((s) => ({
      ...s,
      exos: s.exos.map((e) => {
        if (e.tempId !== exoTempId) return e
        const last = e.series[e.series.length - 1]
        const next: LocalSerie = last
          ? { tempId: newId('s'), poids: last.poids, reps: last.reps, rir: last.rir, degressive: false }
          : { tempId: newId('s'), poids: 0, reps: 8, rir: 2, degressive: false }
        return { ...e, series: [...e.series, next] }
      }),
    }))
  }
  const updateSerie = (exoTempId: string, serieTempId: string, patch: Partial<LocalSerie>) => {
    setSeance((s) => ({
      ...s,
      exos: s.exos.map((e) => {
        if (e.tempId !== exoTempId) return e
        return {
          ...e,
          series: e.series.map((sr) => (sr.tempId === serieTempId ? { ...sr, ...patch } : sr)),
        }
      }),
    }))
  }
  const removeSerie = (exoTempId: string, serieTempId: string) => {
    setSeance((s) => ({
      ...s,
      exos: s.exos.map((e) =>
        e.tempId === exoTempId
          ? { ...e, series: e.series.filter((sr) => sr.tempId !== serieTempId) }
          : e,
      ),
    }))
  }

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    const payload = {
      date: seance.date,
      type: seance.type,
      restTargetSec: seance.restTargetSec,
      exos: validExos.map((e) => ({
        nom: e.nom.trim(),
        isBodyweight: e.isBodyweight,
        isUnilateral: e.isUnilateral,
        series: e.series.map((s) => ({
          poids: s.poids,
          reps: s.reps,
          rir: s.rir,
          degressive: s.degressive,
        })),
      })),
    }
    try {
      const url = isEdit ? `/api/seances/${seanceId}` : '/api/seances'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error ?? `Erreur ${res.status}`)
        setSaving(false)
        return
      }
      invalidateAfterSeanceMutation()
      toast.ok(isEdit ? 'Séance modifiée.' : 'Séance enregistrée.')
      if (isEdit) {
        nav('session_detail', { seanceId })
      } else {
        nav('history')
      }
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : 'Erreur réseau')
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (isEdit) nav('session_detail', { seanceId })
    else nav('history')
  }

  return (
    <div className="app-scroll" style={{ minHeight: '100%', background: 'transparent' }}>
      <TopBar
        leading={
          <IconButton icon={<ChevronLeft size={18} />} label="retour" onClick={handleCancel} />
        }
        title={isEdit ? 'Modifier la séance' : 'Nouvelle séance manuelle'}
        subtitle={
          loading
            ? '…'
            : `${seance.exos.length} exo${seance.exos.length > 1 ? 's' : ''} · ${seance.exos.reduce((a, e) => a + e.series.length, 0)} séries`
        }
      />

      {loading && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Chargement…
        </div>
      )}

      {!loading && (
        <div style={{ padding: '4px 20px 120px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* DATE */}
          <SettingBlock label="Date">
            <DateInput
              value={seance.date}
              onChange={(d) => setSeance((s) => ({ ...s, date: d }))}
            />
          </SettingBlock>

          {/* TYPE */}
          <SettingBlock label="Type de séance">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {WORKOUT_TYPES.map((t) => {
                const active = seance.type === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setSeance((s) => ({ ...s, type: t.id }))}
                    style={{
                      appearance: 'none',
                      padding: '10px 8px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: active ? 'var(--accent-soft)' : 'var(--surface)',
                      color: active ? 'var(--accent)' : 'var(--ink-2)',
                      boxShadow: active
                        ? '0 0 0 1.5px var(--accent) inset'
                        : '0 0 0 1px var(--line) inset',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: 'var(--font)',
                      transition: 'all 160ms',
                    }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          </SettingBlock>

          {/* REPOS */}
          <SettingBlock label="Repos cible">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {REST_PRESETS.map((s) => {
                const active = seance.restTargetSec === s
                return (
                  <button
                    key={s}
                    onClick={() => setSeance((cur) => ({ ...cur, restTargetSec: s }))}
                    style={{
                      height: 44,
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: 'none',
                      background: active ? 'var(--accent-soft)' : 'var(--surface)',
                      color: active ? 'var(--accent)' : 'var(--ink)',
                      boxShadow: active
                        ? '0 0 0 1px var(--brand-line, var(--accent)) inset'
                        : '0 0 0 1px var(--line) inset',
                      fontFamily: 'var(--mono)',
                      fontWeight: 600,
                      fontSize: 13,
                      transition: 'all 160ms',
                    }}
                  >
                    {formatMMSS(s)}
                  </button>
                )
              })}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                background: 'var(--surface)',
                borderRadius: 10,
                boxShadow: '0 0 0 1px var(--line) inset',
                marginTop: 8,
              }}
            >
              <Timer size={14} color="var(--muted)" />
              <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>Personnaliser</span>
              <button
                onClick={() =>
                  setSeance((s) => ({ ...s, restTargetSec: Math.max(15, s.restTargetSec - 15) }))
                }
                style={tinyBtn}
                aria-label="diminuer repos"
              >
                <Minus size={12} />
              </button>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 14,
                  fontWeight: 600,
                  minWidth: 50,
                  textAlign: 'center',
                }}
              >
                {formatMMSS(seance.restTargetSec)}
              </span>
              <button
                onClick={() =>
                  setSeance((s) => ({ ...s, restTargetSec: Math.min(600, s.restTargetSec + 15) }))
                }
                style={tinyBtn}
                aria-label="augmenter repos"
              >
                <Plus size={12} />
              </button>
            </div>
          </SettingBlock>

          {/* EXOS */}
          <div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                fontWeight: 600,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                marginBottom: 10,
                paddingLeft: 2,
              }}
            >
              Exercices
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <AnimatePresence initial={false}>
                {seance.exos.map((exo, i) => (
                  <ExoCard
                    key={exo.tempId}
                    exo={exo}
                    index={i}
                    onUpdate={(patch) => updateExo(exo.tempId, patch)}
                    onRemove={() => removeExo(exo.tempId)}
                    onAddSerie={() => addSerie(exo.tempId)}
                    onUpdateSerie={(sId, patch) => updateSerie(exo.tempId, sId, patch)}
                    onRemoveSerie={(sId) => removeSerie(exo.tempId, sId)}
                  />
                ))}
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
              {addingExo ? (
                <AddExoForm
                  key="form"
                  workoutType={seance.type}
                  onAdd={addExo}
                  onCancel={() => setAddingExo(false)}
                />
              ) : (
                <motion.button
                  key="btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setAddingExo(true)}
                  style={{
                    width: '100%',
                    marginTop: 10,
                    padding: '14px 14px',
                    borderRadius: 12,
                    border: '1.5px dashed var(--line)',
                    background: 'transparent',
                    color: 'var(--muted)',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'var(--font)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Plus size={14} stroke={2.4} />
                  Ajouter un exercice
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Sticky save bar */}
      {!loading && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 30,
            padding: '14px 20px 22px',
            background:
              'linear-gradient(180deg, transparent, var(--bg) 35%)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ maxWidth: 480, margin: '0 auto', pointerEvents: 'auto' }}>
            <Button
              size="lg"
              full
              disabled={!canSave || saving}
              onClick={handleSave}
            >
              {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Enregistrer la séance'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

const tinyBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: '1px solid var(--line)',
  background: 'var(--surface-2)',
  cursor: 'pointer',
  color: 'var(--muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

// Chip toggle compact (PDC / unilatéral) au niveau exo dans l'éditeur manuel.
function MiniToggle({
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
        height: 34,
        padding: '0 10px',
        borderRadius: 9,
        background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
        color: active ? 'var(--accent)' : 'var(--muted)',
        boxShadow: active ? '0 0 0 1.5px var(--accent) inset' : '0 0 0 1px var(--line) inset',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'var(--font)',
        transition: 'all 140ms',
      }}
    >
      {label}
    </button>
  )
}

function SettingBlock({ label, children }: { label: string; children: React.ReactNode }) {
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
        {label}
      </div>
      {children}
    </div>
  )
}

// ───────────────────────── Date input ─────────────────────────
function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        height: 50,
        padding: '0 14px',
        background: 'var(--surface)',
        borderRadius: 12,
        boxShadow: '0 0 0 1px var(--line) inset',
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--ink)',
          flex: 1,
          pointerEvents: 'none',
        }}
      >
        {formatLongDate(value)}
      </span>
      <input
        type="date"
        value={value}
        max={todayISO()}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value)
        }}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          width: '100%',
          height: '100%',
          cursor: 'pointer',
          fontSize: 16, // avoids iOS zoom-on-focus
        }}
        aria-label="Choisir la date"
      />
    </div>
  )
}

function formatLongDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .format(d)
    .replace(/^./, (c) => c.toUpperCase())
}

// ───────────────────────── Exo card ─────────────────────────
function ExoCard({
  exo,
  index,
  onUpdate,
  onRemove,
  onAddSerie,
  onUpdateSerie,
  onRemoveSerie,
}: {
  exo: LocalExo
  index: number
  onUpdate: (patch: Partial<LocalExo>) => void
  onRemove: () => void
  onAddSerie: () => void
  onUpdateSerie: (serieTempId: string, patch: Partial<LocalSerie>) => void
  onRemoveSerie: (serieTempId: string) => void
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      layout
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, x: -20, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: reduced ? 0 : index * 0.03 }}
    >
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 12px 10px 14px',
            borderBottom: '1px solid var(--line-2)',
          }}
        >
          <input
            value={exo.nom}
            onChange={(e) => onUpdate({ nom: e.target.value })}
            placeholder="Nom de l'exercice"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--ink)',
              fontFamily: 'var(--font)',
              padding: 0,
            }}
          />
          <button
            onClick={onRemove}
            aria-label="Supprimer l'exercice"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: 'var(--subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '10px 12px',
            borderBottom: '1px solid var(--line-2)',
          }}
        >
          <MiniToggle
            label="Poids du corps"
            active={exo.isBodyweight}
            onClick={() => onUpdate({ isBodyweight: !exo.isBodyweight })}
          />
          <MiniToggle
            label="Unilatéral"
            active={exo.isUnilateral}
            onClick={() => onUpdate({ isUnilateral: !exo.isUnilateral })}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <AnimatePresence initial={false}>
            {exo.series.map((s, i) => (
              <SerieRow
                key={s.tempId}
                index={i}
                serie={s}
                isBodyweight={exo.isBodyweight}
                onChange={(patch) => onUpdateSerie(s.tempId, patch)}
                onRemove={() => onRemoveSerie(s.tempId)}
              />
            ))}
          </AnimatePresence>
        </div>

        <button
          onClick={onAddSerie}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'transparent',
            border: 'none',
            borderTop: '1px solid var(--line-2)',
            color: 'var(--accent)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Plus size={12} stroke={2.4} />
          {exo.series.length === 0 ? 'Ajouter une série' : 'Série suivante'}
        </button>
      </Card>
    </motion.div>
  )
}

// ───────────────────────── Serie row ─────────────────────────
function SerieRow({
  index,
  serie,
  isBodyweight,
  onChange,
  onRemove,
}: {
  index: number
  serie: LocalSerie
  isBodyweight?: boolean
  onChange: (patch: Partial<LocalSerie>) => void
  onRemove: () => void
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      layout
      initial={reduced ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={reduced ? undefined : { opacity: 0, height: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{ overflow: 'hidden' }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '22px 1fr 1fr 1fr 28px',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderTop: index === 0 ? 'none' : '1px solid var(--line-2)',
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: 'var(--subtle)',
            fontFamily: 'var(--mono)',
            fontWeight: 600,
          }}
        >
          #{index + 1}
        </span>
        <CompactNumeric
          label={isBodyweight ? 'lest' : 'kg'}
          value={serie.poids}
          onChange={(v) => onChange({ poids: v })}
          min={0}
          max={999}
          decimals={1}
        />
        <CompactNumeric
          label="r"
          value={serie.reps}
          onChange={(v) => onChange({ reps: v })}
          min={1}
          max={99}
        />
        <CompactNumeric
          label="RIR"
          value={serie.rir}
          onChange={(v) => onChange({ rir: v })}
          min={0}
          max={10}
        />
        <button
          onClick={onRemove}
          aria-label="Supprimer la série"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: 'var(--subtle)',
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 12px 10px 42px',
        }}
      >
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: serie.degressive ? 'var(--accent)' : 'var(--subtle)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={serie.degressive}
            onChange={(e) => onChange({ degressive: e.target.checked })}
            style={{ accentColor: 'var(--accent)' }}
          />
          dégressive
        </label>
      </div>
    </motion.div>
  )
}

// ───────────────────────── Compact numeric ─────────────────────────
function CompactNumeric({
  label,
  value,
  onChange,
  min,
  max,
  decimals = 0,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  decimals?: number
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [focus, setFocus] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const fmt = (n: number) => {
    if (!decimals) return String(n)
    return Number(n).toFixed(decimals).replace(/\.?0+$/, '')
  }
  const display = draft ?? fmt(value)
  const commit = (raw: string) => {
    const cleaned = raw.replace(',', '.').trim()
    if (cleaned === '' || cleaned === '.' || cleaned === '-') {
      onChange(min)
      return
    }
    const n = parseFloat(cleaned)
    if (!isNaN(n)) {
      onChange(Math.max(min, Math.min(max, Number(n.toFixed(decimals)))))
    }
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 4,
        padding: '6px 8px',
        background: focus ? 'var(--accent-soft)' : 'var(--surface-2)',
        borderRadius: 8,
        boxShadow: focus
          ? '0 0 0 1.5px var(--accent) inset'
          : '0 0 0 1px var(--line) inset',
        transition: 'box-shadow 140ms',
      }}
    >
      <input
        ref={inputRef}
        value={display}
        onChange={(e) => {
          const raw = e.target.value
          if (!/^-?[0-9]*[.,]?[0-9]*$/.test(raw)) return
          setDraft(raw)
          const cleaned = raw.replace(',', '.')
          if (cleaned === '' || cleaned === '.' || cleaned === '-') return
          const n = parseFloat(cleaned)
          if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)))
        }}
        onFocus={() => {
          setFocus(true)
          setDraft(fmt(value))
          requestAnimationFrame(() => inputRef.current?.select())
        }}
        onBlur={() => {
          setFocus(false)
          if (draft !== null) commit(draft)
          setDraft(null)
        }}
        inputMode="decimal"
        enterKeyHint="done"
        style={{
          flex: 1,
          minWidth: 0,
          width: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          textAlign: 'right',
          fontFamily: 'var(--mono)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--ink)',
          padding: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      />
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10,
          color: 'var(--subtle)',
          fontWeight: 500,
        }}
      >
        {label}
      </span>
    </div>
  )
}

// ───────────────────────── Add exo form ─────────────────────────
function AddExoForm({
  workoutType,
  onAdd,
  onCancel,
}: {
  workoutType: string
  onAdd: (nom: string, isBodyweight?: boolean, isUnilateral?: boolean) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { exos: dbExos, loading: exosLoading } = useExos()

  const candidates = useMemo(
    () => filterExos(dbExos, name, workoutType).slice(0, MAX_EXO_PILLS),
    [dbExos, name, workoutType],
  )
  // Suggestions statiques pour COMPLÉTER si DB pas assez fournie sur ce type.
  const fallbackSugg = useMemo(() => {
    const dbNames = new Set(candidates.map((e) => e.nom.trim().toLowerCase()))
    const base = SUGGESTIONS[workoutType] ?? SUGGESTIONS.push
    const slots = MAX_EXO_PILLS - candidates.length
    if (slots <= 0) return []
    return base.filter((s) => !dbNames.has(s.trim().toLowerCase())).slice(0, slots)
  }, [workoutType, candidates])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  const submit = (chosen?: string) => {
    const final = (chosen ?? name).trim()
    if (final.length === 0) return
    // Pré-remplit PDC / unilatéral depuis le dernier usage du même exo.
    const match = dbExos.find((e) => e.nom.trim().toLowerCase() === final.toLowerCase())
    onAdd(final, match?.lastIsBodyweight ?? false, match?.lastIsUnilateral ?? false)
    setName('')
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.22 }}
      style={{
        marginTop: 10,
        padding: 14,
        background: 'var(--surface)',
        borderRadius: 12,
        boxShadow: '0 0 0 1px var(--accent) inset',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 10px',
          height: 38,
          border: '1px solid var(--line)',
          borderRadius: 8,
          background: 'var(--surface-2)',
        }}
      >
        <Search size={13} color="var(--subtle)" />
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
            if (e.key === 'Escape') onCancel()
          }}
          placeholder="Cherche ou tape un exercice…"
          enterKeyHint="done"
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--ink)',
            fontSize: 14,
            fontFamily: 'var(--font)',
            padding: 0,
          }}
        />
      </div>
      {!exosLoading && (candidates.length > 0 || fallbackSugg.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {candidates.map((exo) => (
            <DbExoPill key={exo.nom} exo={exo} onPick={() => submit(exo.nom)} />
          ))}
          {fallbackSugg.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              style={{
                appearance: 'none',
                padding: '6px 10px',
                borderRadius: 999,
                border: 'none',
                background: 'var(--surface-2)',
                color: 'var(--ink-2)',
                fontSize: 11,
                fontWeight: 500,
                fontFamily: 'var(--font)',
                cursor: 'pointer',
                boxShadow: '0 0 0 1px var(--line) inset',
                opacity: 0.85,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <Button variant="secondary" size="sm" full onClick={onCancel}>
          Annuler
        </Button>
        <Button size="sm" full onClick={() => submit()} disabled={!name.trim()}>
          Ajouter
        </Button>
      </div>
    </motion.div>
  )
}

function DbExoPill({ exo, onPick }: { exo: ExoSuggestion; onPick: () => void }) {
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
        padding: '6px 10px',
        borderRadius: 999,
        border: 'none',
        background: 'var(--surface-2)',
        color: 'var(--ink-2)',
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'var(--font)',
        cursor: 'pointer',
        boxShadow: '0 0 0 1px var(--line) inset',
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 5,
      }}
    >
      <span>{exo.nom}</span>
      {exo.lastPoids != null && (
        <span
          style={{
            fontSize: 9,
            color: 'var(--subtle)',
            fontFamily: 'var(--mono)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {exo.lastPoids}kg
        </span>
      )}
    </button>
  )
}
