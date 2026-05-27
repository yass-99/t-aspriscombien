'use client'

import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import type { NavFn, Run } from '../_lib/types'
import { useRuns } from '../_lib/useRuns'
import {
  DISTANCE_MAX_M,
  DISTANCE_MIN_M,
  DISTANCE_PRESETS_M,
  formatChrono,
  formatRunDate,
  parseChrono,
  summarizeByDistance,
} from '../_lib/runs'
import { Button, Card, IconButton, TopBar } from '../_components/primitives'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Plus,
  Timer,
  Trash,
  X,
} from '../_components/icons'
import { useToast } from '../../_components/Toast'
import { useWakeLock } from '../_lib/useWakeLock'

type Props = {
  nav: NavFn
  // 'chrono' (depuis Idle Sprint) → ouvre directement le timer avec last-used distance.
  // 'hub' (depuis Stats Voir tout) → ouvre la page historique.
  initialView?: 'hub' | 'chrono'
}

type SubView = 'hub' | 'chrono' | 'distance'

const DEFAULT_DISTANCE = 100

export function AthleticsScreen({ nav, initialView = 'chrono' }: Props) {
  const [view, setView] = useState<SubView>(initialView)
  // Default immédiat à 100m pour éviter un fallback Hub pendant le chargement des runs.
  // Sera écrasé par la distance du dernier run dès que `runs` arrive (cf. effect ci-dessous).
  const [selectedDistance, setSelectedDistance] = useState<number | null>(
    initialView === 'chrono' ? DEFAULT_DISTANCE : null,
  )
  const { runs, loading, error, create, remove, refresh } = useRuns()
  const toast = useToast()
  const initializedRef = useRef(false)

  useEffect(() => {
    if (error) toast.warn(error)
  }, [error, toast])

  // À la première arrivée en mode 'chrono', basculer sur la dernière distance utilisée
  // si on en trouve une. Ne se déclenche qu'une fois pour ne pas écraser un changement
  // utilisateur ultérieur via le DistancePicker.
  useEffect(() => {
    if (initializedRef.current) return
    if (loading) return
    initializedRef.current = true
    if (initialView !== 'chrono') return
    const lastRun = runs[0]
    if (lastRun) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedDistance(lastRun.distance_m)
    }
  }, [loading, initialView, runs])

  const summaries = useMemo(() => summarizeByDistance(runs), [runs])

  const openDistance = (distance: number) => {
    setSelectedDistance(distance)
    setView('distance')
  }
  const openChrono = (distance: number) => {
    setSelectedDistance(distance)
    setView('chrono')
  }

  // Sortie vers l'écran d'origine : Idle si l'utilisateur est entré via le bouton
  // Sprint, Stats s'il est entré via « Voir tout sprints » dans Stats.
  const exitToOrigin = () => nav(initialView === 'chrono' ? 'idle' : 'stats')

  if (view === 'chrono' && selectedDistance != null) {
    // Si Chrono est la vue racine (entrée depuis Idle), X ramène à Idle.
    // Sinon (Chrono ouvert depuis le Hub), X ramène au Hub.
    const cancelChrono =
      initialView === 'chrono' ? exitToOrigin : () => setView('hub')
    // Après save, on retombe sur le Hub uniquement quand c'est l'origine ;
    // sinon on garde Chrono (l'utilisateur enchaîne ses runs depuis Idle).
    const afterSave = () => {
      if (initialView === 'chrono') {
        // Reste sur Chrono : l'utilisateur peut faire un autre sprint immédiatement.
        return
      }
      setView('hub')
    }
    return (
      <ChronoView
        distance={selectedDistance}
        onCancel={cancelChrono}
        onValidated={async (ms) => {
          await create({ distance_m: selectedDistance, duration_ms: ms })
          toast.ok('Chrono enregistré.')
          afterSave()
        }}
        onChangeDistance={(d) => setSelectedDistance(d)}
      />
    )
  }

  if (view === 'distance' && selectedDistance != null) {
    const distanceRuns = runs.filter((r) => r.distance_m === selectedDistance)
    return (
      <DistanceDetailView
        distance={selectedDistance}
        runs={distanceRuns}
        loading={loading}
        onBack={() => setView('hub')}
        onNewChrono={() => setView('chrono')}
        onDelete={async (id) => {
          await remove(id)
          toast.ok('Chrono supprimé.')
        }}
      />
    )
  }

  return (
    <HubView
      summaries={summaries}
      runs={runs}
      loading={loading}
      onBack={exitToOrigin}
      onPickDistance={openDistance}
      onLaunchChrono={openChrono}
      onRefresh={refresh}
    />
  )
}

// ══════════════════════════════════════════════════════════════════
// HUB
// ══════════════════════════════════════════════════════════════════
function HubView({
  summaries,
  runs,
  loading,
  onBack,
  onPickDistance,
  onLaunchChrono,
}: {
  summaries: ReturnType<typeof summarizeByDistance>
  runs: Run[]
  loading: boolean
  onBack: () => void
  onPickDistance: (d: number) => void
  onLaunchChrono: (d: number) => void
  onRefresh: () => void
}) {
  // Toutes les distances à afficher : presets + celles déjà courues.
  const allDistances = useMemo(() => {
    const set = new Set<number>(DISTANCE_PRESETS_M)
    for (const s of summaries) set.add(s.distance_m)
    return Array.from(set).sort((a, b) => a - b)
  }, [summaries])

  const totalRuns = runs.length
  const overallBest = summaries.reduce<Run | null>(
    (b, s) => (s.best && (!b || s.best.duration_ms < b.duration_ms) ? s.best : b),
    null,
  )

  return (
    <div className="app-scroll" style={{ minHeight: '100%', background: 'var(--bg)' }}>
      <TopBar
        leading={
          <IconButton icon={<ChevronLeft size={18} />} label="retour" onClick={onBack} />
        }
        title="Athlétisme"
        subtitle={
          loading
            ? '…'
            : totalRuns === 0
              ? 'Aucun chrono enregistré'
              : `${totalRuns} chrono${totalRuns > 1 ? 's' : ''} · ${summaries.length} distance${summaries.length > 1 ? 's' : ''}`
        }
      />

      <div style={{ padding: '4px 20px 32px' }}>
        {overallBest && (
          <Card style={{ padding: 16, marginBottom: 14 }}>
            <div
              style={{
                fontSize: 10,
                color: 'var(--muted)',
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              Meilleure perf récente
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 34,
                  fontWeight: 600,
                  letterSpacing: -1,
                  color: 'var(--ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatChrono(overallBest.duration_ms)}
              </span>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 13,
                  color: 'var(--accent)',
                  fontWeight: 600,
                }}
              >
                {overallBest.distance_m}m
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  color: 'var(--subtle)',
                  fontFamily: 'var(--mono)',
                }}
              >
                {formatRunDate(overallBest.date)}
              </span>
            </div>
          </Card>
        )}

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
          Mes distances
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allDistances.map((dist) => {
            const sum = summaries.find((s) => s.distance_m === dist)
            return (
              <DistanceRow
                key={dist}
                distance={dist}
                count={sum?.count ?? 0}
                best={sum?.best}
                onOpen={() =>
                  sum && sum.count > 0 ? onPickDistance(dist) : onLaunchChrono(dist)
                }
                onLaunch={() => onLaunchChrono(dist)}
              />
            )
          })}
        </div>

        <div
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            marginBottom: 8,
            paddingLeft: 2,
            marginTop: 20,
          }}
        >
          Derniers chronos
        </div>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <EmptyLine label="…" />
          ) : runs.length === 0 ? (
            <EmptyLine label="Aucun chrono pour l'instant." />
          ) : (
            runs.slice(0, 8).map((r, i) => <RecentRunRow key={r.id} run={r} first={i === 0} />)
          )}
        </Card>
      </div>
    </div>
  )
}

function DistanceRow({
  distance,
  count,
  best,
  onOpen,
  onLaunch,
}: {
  distance: number
  count: number
  best?: Run
  onOpen: () => void
  onLaunch: () => void
}) {
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }} interactive onClick={onOpen}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: count > 0 ? 'var(--accent-soft)' : 'var(--surface-2)',
            color: count > 0 ? 'var(--accent)' : 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--mono)',
            fontWeight: 700,
            fontSize: 13,
            flexShrink: 0,
            letterSpacing: -0.3,
          }}
        >
          {distance}m
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {best ? (
            <>
              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 17,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  letterSpacing: -0.4,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatChrono(best.duration_ms)}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--subtle)',
                  fontFamily: 'var(--mono)',
                  marginTop: 1,
                }}
              >
                <Flame size={10} color="var(--accent)" /> PR · {count} chrono{count > 1 ? 's' : ''}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>
                Pas encore couru
              </div>
              <div style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 1 }}>
                Lance ton premier chrono
              </div>
            </>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onLaunch()
          }}
          aria-label={`Lancer un chrono sur ${distance}m`}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 6px 16px -8px color-mix(in oklch, var(--accent) 60%, transparent)',
          }}
        >
          <Timer size={16} />
        </button>
        <ChevronRight size={14} color="var(--muted)" />
      </div>
    </Card>
  )
}

function RecentRunRow({ run, first }: { run: Run; first: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderTop: first ? 'none' : '1px solid var(--line-2)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: 'var(--muted)',
          width: 44,
          flexShrink: 0,
        }}
      >
        {run.distance_m}m
      </div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--ink)',
          letterSpacing: -0.3,
          fontVariantNumeric: 'tabular-nums',
          flex: 1,
        }}
      >
        {formatChrono(run.duration_ms)}
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--subtle)',
          fontFamily: 'var(--mono)',
        }}
      >
        {formatRunDate(run.date)}
      </div>
    </div>
  )
}

function EmptyLine({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '18px 14px',
        textAlign: 'center',
        fontSize: 12,
        color: 'var(--muted)',
        fontFamily: 'var(--mono)',
      }}
    >
      {label}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// CHRONO
// ══════════════════════════════════════════════════════════════════
type ChronoStatus = 'idle' | 'running' | 'stopped'

function ChronoView({
  distance,
  onCancel,
  onValidated,
  onChangeDistance,
}: {
  distance: number
  onCancel: () => void
  onValidated: (ms: number) => Promise<void>
  onChangeDistance: (d: number) => void
}) {
  const [status, setStatus] = useState<ChronoStatus>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const startAtRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useWakeLock(true)

  // Drive the display while running via rAF for smoothness.
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
  }
  const stop = () => {
    if (startAtRef.current != null) {
      setElapsedMs(performance.now() - startAtRef.current)
    }
    setStatus('stopped')
  }
  const reset = () => {
    setStatus('idle')
    setElapsedMs(0)
    startAtRef.current = null
    setEditing(false)
    setEditError(null)
  }

  const beginEdit = () => {
    setEditText(formatChrono(elapsedMs))
    setEditError(null)
    setEditing(true)
  }
  const commitEdit = () => {
    const parsed = parseChrono(editText)
    if (parsed == null || parsed <= 0) {
      setEditError('Format attendu : 12,45 ou 1:23,45')
      return
    }
    setElapsedMs(parsed)
    setEditing(false)
    setEditError(null)
  }

  const validate = async () => {
    if (elapsedMs <= 0) return
    setSaving(true)
    try {
      await onValidated(Math.round(elapsedMs))
      // Si le parent ne démonte pas ChronoView (cas flow direct depuis Idle Sprint),
      // on reset l'état interne pour permettre d'enchaîner un nouveau chrono.
      setSaving(false)
      reset()
    } catch (e) {
      setSaving(false)
      setEditError(e instanceof Error ? e.message : 'Erreur enregistrement')
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background:
          status === 'running'
            ? 'radial-gradient(120% 70% at 50% 0%, color-mix(in oklch, var(--accent) 14%, var(--bg)) 0%, var(--bg) 60%)'
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
        subtitle={`${distance}m`}
      />

      <div style={{ padding: '4px 20px 0' }}>
        <DistancePicker value={distance} onChange={onChangeDistance} disabled={status === 'running'} />
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 20px',
        }}
      >
        {editing ? (
          <div style={{ width: '100%', maxWidth: 320 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                fontWeight: 600,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              Corriger le chrono
            </div>
            <input
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') setEditing(false)
              }}
              inputMode="decimal"
              enterKeyHint="done"
              placeholder="12,45"
              style={{
                width: '100%',
                height: 72,
                textAlign: 'center',
                border: 'none',
                outline: 'none',
                background: 'var(--surface)',
                borderRadius: 16,
                boxShadow:
                  '0 0 0 1.5px var(--accent) inset, 0 0 0 4px color-mix(in oklch, var(--accent) 22%, transparent)',
                fontFamily: 'var(--mono)',
                fontSize: 36,
                fontWeight: 600,
                color: 'var(--ink)',
                letterSpacing: -1.2,
                fontVariantNumeric: 'tabular-nums',
                padding: '0 16px',
              }}
            />
            {editError && (
              <div
                style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'color-mix(in oklch, var(--warn) 18%, var(--surface))',
                  color: 'var(--warn)',
                  fontSize: 12,
                  fontWeight: 500,
                  textAlign: 'center',
                }}
              >
                {editError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setEditing(false)
                  setEditError(null)
                }}
              >
                Annuler
              </Button>
              <Button size="md" onClick={commitEdit} icon={<Check size={16} />}>
                OK
              </Button>
            </div>
          </div>
        ) : (
          <>
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
                      ? 'var(--accent)'
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
              {status === 'idle'
                ? 'prêt'
                : status === 'running'
                  ? 'en cours'
                  : 'arrêté · vérifie le temps'}
            </div>

            {status === 'stopped' && (
              <button
                onClick={beginEdit}
                style={{
                  marginTop: 18,
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: 'none',
                  background: 'var(--surface)',
                  boxShadow: '0 0 0 1px var(--line) inset',
                  color: 'var(--ink-2)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                }}
              >
                Corriger manuellement
              </button>
            )}
          </>
        )}
      </div>

      {!editing && (
        <div
          style={{
            padding: '14px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)',
            background: 'linear-gradient(180deg, transparent, var(--bg) 30%)',
          }}
        >
          <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {status === 'idle' && (
              <Button onClick={start} icon={<Timer size={16} />}>
                Démarrer
              </Button>
            )}
            {status === 'running' && (
              <Button variant="danger" onClick={stop} icon={<X size={16} stroke={2.4} />}>
                Stop
              </Button>
            )}
            {status === 'stopped' && (
              <>
                <Button
                  onClick={validate}
                  icon={saving ? undefined : <Check size={16} />}
                  disabled={saving || elapsedMs <= 0}
                >
                  {saving ? 'Enregistrement…' : 'Valider et enregistrer'}
                </Button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="secondary" size="md" onClick={reset} disabled={saving}>
                    Refaire
                  </Button>
                  <Button variant="secondary" size="md" onClick={onCancel} disabled={saving}>
                    Annuler
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DistancePicker({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (d: number) => void
  disabled: boolean
}) {
  const [customMode, setCustomMode] = useState(!DISTANCE_PRESETS_M.includes(value as never))
  const [customText, setCustomText] = useState(
    !DISTANCE_PRESETS_M.includes(value as never) ? String(value) : '',
  )
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
        {DISTANCE_PRESETS_M.map((d) => {
          const active = !customMode && value === d
          return (
            <button
              key={d}
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
                background: active ? 'var(--accent-soft)' : 'var(--surface)',
                color: active ? 'var(--accent)' : 'var(--ink-2)',
                boxShadow: active
                  ? '0 0 0 1.5px var(--accent) inset'
                  : '0 0 0 1px var(--line) inset',
                fontFamily: 'var(--mono)',
                fontWeight: 600,
                fontSize: 13,
                opacity: disabled ? 0.5 : 1,
                transition: 'all 140ms',
              }}
            >
              {d}m
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <button
          onClick={() => setCustomMode((v) => !v)}
          disabled={disabled}
          style={{
            appearance: 'none',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: '8px 12px',
            borderRadius: 8,
            background: customMode ? 'var(--accent-soft)' : 'var(--surface-2)',
            color: customMode ? 'var(--accent)' : 'var(--muted)',
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
// DISTANCE DETAIL
// ══════════════════════════════════════════════════════════════════
function DistanceDetailView({
  distance,
  runs,
  loading,
  onBack,
  onNewChrono,
  onDelete,
}: {
  distance: number
  runs: Run[]
  loading: boolean
  onBack: () => void
  onNewChrono: () => void
  onDelete: (id: string) => Promise<void>
}) {
  const best = runs.reduce<Run | undefined>(
    (b, r) => (!b || r.duration_ms < b.duration_ms ? r : b),
    undefined,
  )
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  return (
    <div className="app-scroll" style={{ minHeight: '100%', background: 'var(--bg)' }}>
      <TopBar
        leading={<IconButton icon={<ChevronLeft size={18} />} label="retour" onClick={onBack} />}
        title={`${distance}m`}
        subtitle={loading ? '…' : `${runs.length} chrono${runs.length > 1 ? 's' : ''}`}
      />

      <div style={{ padding: '4px 20px 32px' }}>
        {best && (
          <Card style={{ padding: 16, marginBottom: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 4,
              }}
            >
              <Flame size={14} color="var(--accent)" />
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--accent)',
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                Record personnel
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 40,
                  fontWeight: 600,
                  letterSpacing: -1.4,
                  color: 'var(--ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatChrono(best.duration_ms)}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--subtle)',
                  fontFamily: 'var(--mono)',
                  marginLeft: 'auto',
                }}
              >
                {formatRunDate(best.date)}
              </span>
            </div>
          </Card>
        )}

        <Button onClick={onNewChrono} icon={<Plus size={16} />} style={{ marginBottom: 18 }}>
          Nouveau chrono
        </Button>

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
          Tous les chronos
        </div>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <EmptyLine label="…" />
          ) : runs.length === 0 ? (
            <EmptyLine label="Aucun chrono sur cette distance." />
          ) : (
            runs.map((r, i) => {
              const isBest = best?.id === r.id
              return (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: isBest ? 'var(--accent-soft)' : 'var(--surface-2)',
                      color: isBest ? 'var(--accent)' : 'var(--muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {isBest ? <Flame size={11} /> : i + 1}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--ink)',
                      letterSpacing: -0.3,
                      fontVariantNumeric: 'tabular-nums',
                      flex: 1,
                    }}
                  >
                    {formatChrono(r.duration_ms)}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--subtle)',
                      fontFamily: 'var(--mono)',
                    }}
                  >
                    {formatRunDate(r.date)}
                  </span>
                  <button
                    onClick={() => setPendingDeleteId(r.id)}
                    aria-label="supprimer"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Trash size={13} />
                  </button>
                </div>
              )
            })
          )}
        </Card>
      </div>

      {pendingDeleteId && (
        <DeleteConfirmBar
          busy={deleting}
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={async () => {
            if (!pendingDeleteId) return
            setDeleting(true)
            try {
              await onDelete(pendingDeleteId)
              setPendingDeleteId(null)
            } finally {
              setDeleting(false)
            }
          }}
        />
      )}
    </div>
  )
}

function DeleteConfirmBar({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const styles: CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    padding: '14px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)',
    background: 'var(--surface)',
    boxShadow: '0 -12px 32px -12px rgba(0,0,0,0.5), 0 0 0 1px var(--line) inset',
  }
  return (
    <div style={styles}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, marginBottom: 10 }}>
          Supprimer ce chrono ?
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="md" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button variant="danger" size="md" onClick={onConfirm} disabled={busy}>
            {busy ? 'Suppression…' : 'Supprimer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
