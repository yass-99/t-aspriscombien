'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, Spark } from './icons'
import { WeightModal } from './WeightModal'
import { fmtKg } from './WeightDial'
import { OnboardingProfileModal } from './OnboardingProfileModal'
import { greetingFor } from '../_lib/helpers'
import { useBodyweight } from '../_lib/useBodyweight'
import { useProfile } from '../_lib/useProfile'
import { useCheckinSkip } from '../_lib/useCheckinSkip'
import { useOnboardingDismiss } from '../_lib/useOnboardingDismiss'
import { useMounted } from '../_lib/useMounted'
import { isThisWeek, weekKey, isoLocalDate } from '../_lib/profile'
import { usePlan } from '../_lib/usePlan'
import { buildIdleItems, TYPE_LABELS } from '../_lib/plan'
import { PlanWeekModal } from './PlanWeekModal'

const ROTATE_MS = 3800

type AlertKind = 'weight' | 'profile'
type Alert = { kind: AlertKind; label: string; color: string }

/**
 * Spot d'information du HERO. État normal : pill statique « Prêt à reprendre ? ».
 * Si une action est en attente après avoir été repoussée (poids hebdo non saisi,
 * ou profil d'onboarding incomplet), la pill devient une alerte cliquable : badge
 * pulsant + texte qui alterne entre les rappels. Chaque rappel a sa couleur
 * (poids = jaune --warn, profil = rouge --danger) et ouvre son propre modal.
 */
export function StatusSpot() {
  const mounted = useMounted()
  const { current: currentWeight, lastDate, loading: bwLoading } = useBodyweight()
  const { profile, loading: profileLoading } = useProfile()
  const skipped = useCheckinSkip()
  const onboardingDismissed = useOnboardingDismiss()

  const [open, setOpen] = useState<AlertKind | 'plan' | null>(null)
  const [idx, setIdx] = useState(0)

  // Séance planifiée aujourd'hui (gate `mounted` → pas de mismatch d'hydratation).
  const { entries: planEntries } = usePlan(weekKey())
  const plannedToday = mounted
    ? planEntries.find((e) => e.date === isoLocalDate()) ?? null
    : null
  const plannedLabel = plannedToday ? TYPE_LABELS[plannedToday.type] ?? null : null

  // Avant le montage : rendu déterministe (= HTML serveur) pour éviter le mismatch
  // d'hydratation. greetingFor() dépend de l'heure ; les alertes, de localStorage.
  const base = mounted ? `Prêt à reprendre ? · ${greetingFor()}` : 'Prêt à reprendre ?'

  const needsWeight = mounted && !bwLoading && !isThisWeek(lastDate)
  // Pesée déjà faite cette semaine → on l'affiche en pastille verte (data) à côté
  // du hero, cliquable pour rouvrir le modal de saisie (« modifier votre pesée »).
  const weighedThisWeek = mounted && !bwLoading && isThisWeek(lastDate)
  const profileIncomplete =
    profile === null ||
    profile.sexe === null ||
    profile.tailleCm === null ||
    profile.birthDate === null
  const needsProfile = mounted && !profileLoading && profileIncomplete

  // Liste des actions en attente (nom + couleur + modal ouvert au clic).
  const alerts: Alert[] = []
  if (needsWeight && skipped)
    alerts.push({ kind: 'weight', label: 'Poids à renseigner', color: 'var(--warn)' })
  if (needsProfile && onboardingDismissed)
    alerts.push({ kind: 'profile', label: 'Profil à compléter', color: 'var(--danger)' })

  const alertActive = alerts.length > 0
  // Dès qu'une action est en attente : on masque le greeting et on déroule
  // uniquement la liste des actions.
  const items = alertActive ? alerts.map((a) => a.label) : buildIdleItems(base, plannedLabel)

  // Rotation auto du message uniquement quand il y a au moins une alerte.
  useEffect(() => {
    if (items.length < 2) {
      setIdx(0)
      return
    }
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % items.length)
    }, ROTATE_MS)
    return () => window.clearInterval(id)
  }, [items.length])

  const current = items[Math.min(idx, items.length - 1)]
  const currentAlert = alerts.find((a) => a.label === current) ?? null
  // Couleur de l'habillage : celle de l'item courant, sinon de la 1re alerte.
  const chromeColor = (currentAlert ?? alerts[0])?.color ?? null

  const openTarget = () => {
    const target = currentAlert ?? alerts[0]
    if (target) setOpen(target.kind)
  }

  // Hors alerte, la pill est l'entrée de planification (clic → modal semaine).
  const onPill = () => (alertActive ? openTarget() : setOpen('plan'))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        role="button"
        tabIndex={0}
        aria-label={alertActive ? (currentAlert ?? alerts[0])?.label : current}
        onClick={onPill}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onPill()
          }
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: alertActive ? '4px 8px 4px 6px' : '4px 10px 4px 6px',
          borderRadius: 999,
          background: chromeColor
            ? `color-mix(in oklch, ${chromeColor} 14%, var(--surface))`
            : 'var(--surface)',
          boxShadow: chromeColor
            ? `0 0 0 1px color-mix(in oklch, ${chromeColor} 45%, var(--line)) inset`
            : '0 0 0 1px var(--line) inset',
          cursor: 'pointer',
          transition: 'background 220ms, box-shadow 220ms',
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            background: currentAlert ? currentAlert.color : 'var(--brand-soft)',
            color: currentAlert ? 'var(--bg)' : 'var(--brand)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 220ms, color 220ms',
          }}
        >
          <Spark size={11} />
        </span>

        <span style={{ position: 'relative', display: 'inline-flex', overflow: 'hidden' }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={current}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              style={{
                fontSize: 11,
                color: currentAlert ? currentAlert.color : 'var(--ink-2)',
                fontWeight: currentAlert ? 700 : 500,
                whiteSpace: 'nowrap',
              }}
            >
              {current}
            </motion.span>
          </AnimatePresence>
        </span>

        {alertActive && (
          <span style={{ display: 'inline-flex', color: chromeColor ?? 'var(--muted)', flexShrink: 0 }}>
            <ChevronRight size={12} stroke={2.6} />
          </span>
        )}
      </div>

      {/* Badge d'alerte pulsant au-dessus de la pill (signale le cliquable). */}
      {alertActive && chromeColor && (
        <motion.span
          aria-hidden
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.18, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: -5,
            right: -4,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: chromeColor,
            color: 'var(--bg)',
            boxShadow: '0 0 0 2px var(--bg)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 800,
            lineHeight: 1,
            fontFamily: 'var(--font)',
          }}
        >
          !
        </motion.span>
      )}
      </div>

      {weighedThisWeek && currentWeight != null && (
        <button
          onClick={() => setOpen('weight')}
          aria-label={`Pesée ${fmtKg(currentWeight)} kg — modifier`}
          style={{
            appearance: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px 4px 8px',
            borderRadius: 999,
            background: 'var(--accent-soft)',
            boxShadow: '0 0 0 1px color-mix(in oklch, var(--accent) 30%, transparent) inset',
            fontFamily: 'var(--font)',
          }}
        >
          <span
            style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)', flexShrink: 0 }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--accent)',
              fontFamily: 'var(--mono)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtKg(currentWeight)} kg
          </span>
        </button>
      )}

      <WeightModal open={open === 'weight'} onClose={() => setOpen(null)} />
      {open === 'profile' && needsProfile && (
        <OnboardingProfileModal profile={profile} onDismiss={() => setOpen(null)} />
      )}
      <PlanWeekModal open={open === 'plan'} onClose={() => setOpen(null)} />
    </div>
  )
}
