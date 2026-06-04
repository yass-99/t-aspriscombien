'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from './icons'
import { WORKOUT_TYPES } from '../_lib/constants'
import { TYPE_LABELS } from '../_lib/plan'
import { usePlan, invalidatePlan } from '../_lib/usePlan'
import { weekDatesFrom } from '../_lib/helpers'
import { weekKey } from '../_lib/profile'
import { subscribeToPush, pushSupported, isStandalone } from '../_lib/push'

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const TYPE_CHOICES = [...WORKOUT_TYPES.map((t) => t.id), 'athletics']

// Couleur de discipline d'un type (vert muscu / orange athlé).
const typeColor = (type: string) => (type === 'athletics' ? 'var(--warn)' : 'var(--accent)')

const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
    .format(new Date(iso + 'T00:00:00'))
    .replace('.', '')

/**
 * Modal de planification de la semaine : un type de séance par jour.
 * Édition en mémoire, enregistrement en batch (POST /api/plan).
 */
export function PlanWeekModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const weekStart = weekKey()
  const dates = useMemo(() => weekDatesFrom(weekStart), [weekStart])
  const { entries } = usePlan(weekStart)

  const [mounted, setMounted] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // iOS non installé : on ne peut pas s'abonner aux push → indice d'installation.
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  // (Ré)initialise le brouillon depuis le plan chargé à chaque ouverture.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(Object.fromEntries(entries.map((e) => [e.date, e.type])))
    setEditing(null)
    setShowIosHint(false)
  }, [open, entries])

  // Verrouille le scroll du body tant que le modal est ouvert.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const setType = (date: string, type: string | null) => {
    setDraft((d) => {
      const next = { ...d }
      if (type === null) delete next[date]
      else next[date] = type
      return next
    })
    setEditing(null)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart,
          entries: Object.entries(draft).map(([date, type]) => ({ date, type })),
        }),
      })
      if (!res.ok) {
        setSaving(false)
        return
      }
      invalidatePlan(weekStart)

      // Au tout premier plan enregistré, proposer les notifs (une seule fois).
      if (pushSupported() && Notification.permission === 'default') {
        const onIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
        if (onIOS && !isStandalone()) {
          // iOS non installé : garder le modal ouvert pour montrer l'indice.
          setShowIosHint(true)
          setSaving(false)
          return
        }
        await subscribeToPush()
      }
      onClose()
    } catch {
      setSaving(false)
    }
  }

  if (!mounted) return null

  const sheet = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px 16px max(16px, env(safe-area-inset-bottom))',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) onClose()
          }}
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 448,
              padding: 20,
              borderRadius: 18,
              background: 'var(--surface)',
              boxShadow: '0 0 0 1px var(--line) inset, 0 22px 60px -22px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  letterSpacing: -0.3,
                  fontFamily: 'var(--display)',
                  flex: 1,
                }}
              >
                Planifier ma semaine
              </span>
              <button
                onClick={onClose}
                aria-label="fermer"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--surface-2)',
                  color: 'var(--ink-2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={15} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
              Pose un type par jour. Tu choisiras le reste sur place.
            </div>

            <div>
              {dates.map((date, i) => {
                const type = draft[date]
                const isEditing = editing === date
                return (
                  <div
                    key={date}
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
                      padding: '10px 0',
                    }}
                  >
                    <button
                      onClick={() => setEditing(isEditing ? null : date)}
                      style={{
                        width: '100%',
                        appearance: 'none',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 0,
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                        {DAY_NAMES[i]}
                        <span style={{ color: 'var(--subtle)', fontWeight: 500, marginLeft: 7 }}>
                          {fmtDay(date)}
                        </span>
                      </span>
                      {type ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '5px 12px',
                            borderRadius: 999,
                            color: 'var(--bg)',
                            background: typeColor(type),
                          }}
                        >
                          {TYPE_LABELS[type] ?? type}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '5px 12px',
                            borderRadius: 999,
                            color: 'var(--subtle)',
                            boxShadow: '0 0 0 1px var(--line) inset',
                          }}
                        >
                          + Ajouter
                        </span>
                      )}
                    </button>

                    <AnimatePresence initial={false}>
                      {isEditing && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 6,
                              paddingTop: 10,
                            }}
                          >
                            {TYPE_CHOICES.map((t) => {
                              const active = type === t
                              return (
                                <button
                                  key={t}
                                  onClick={() => setType(date, t)}
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    padding: '6px 11px',
                                    borderRadius: 999,
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: active ? 'var(--bg)' : 'var(--ink-2)',
                                    background: active ? typeColor(t) : 'var(--surface-2)',
                                  }}
                                >
                                  {TYPE_LABELS[t] ?? t}
                                </button>
                              )
                            })}
                            {type && (
                              <button
                                onClick={() => setType(date, null)}
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  padding: '6px 11px',
                                  borderRadius: 999,
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'var(--muted)',
                                  background: 'transparent',
                                  boxShadow: '0 0 0 1px var(--line) inset',
                                }}
                              >
                                Aucune
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>

            {showIosHint && (
              <div
                style={{
                  marginTop: 14,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--brand-soft)',
                  boxShadow: '0 0 0 1px var(--brand-line) inset',
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  color: 'var(--ink-2)',
                }}
              >
                Plan enregistré ✓ — pour recevoir le rappel le jour J, ajoute l&apos;app à
                ton écran d&apos;accueil (Partager → « Sur l&apos;écran d&apos;accueil »).
              </div>
            )}
            <button
              onClick={showIosHint ? onClose : save}
              disabled={saving}
              style={{
                width: '100%',
                appearance: 'none',
                border: 'none',
                borderRadius: 12,
                cursor: saving ? 'default' : 'pointer',
                background: 'var(--brand)',
                color: 'var(--brand-ink)',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'var(--font)',
                height: 48,
                marginTop: 16,
                boxShadow: '0 8px 22px -8px color-mix(in oklch, var(--brand) 55%, transparent)',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {showIosHint ? 'Fermer' : saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(sheet, document.body)
}
