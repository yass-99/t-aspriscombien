'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, NumericInput, Segmented } from './primitives'
import { useToast } from '../../_components/Toast'
import { invalidateProfileCache } from '../_lib/useProfile'
import { ageFromBirthDate, type Profile, type Sexe } from '../_lib/profile'

type Props = {
  profile: Profile | null
  onDismiss: () => void
}

export function OnboardingProfileModal({ profile, onDismiss }: Props) {
  const toast = useToast()

  const [sexe, setSexe] = useState<Sexe>(profile?.sexe ?? 'H')
  const [tailleCm, setTailleCm] = useState<number | null>(profile?.tailleCm ?? null)
  const [birthDate, setBirthDate] = useState<string>(profile?.birthDate ?? '')
  const [saving, setSaving] = useState(false)
  // Rendu via portal sur <body> (client-only) pour passer au-dessus de TOUT —
  // sinon un parent animé (transform/filter) piège le position:fixed dans un
  // stacking context local et des éléments survolés repassent par-dessus.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Verrouille le scroll de l'arrière-plan tant que le modal est ouvert.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Re-sync si le profil arrive après le mount (cache miss → fetch terminé).
  useEffect(() => {
    if (!profile) return
    if (profile.sexe) setSexe(profile.sexe)
    if (profile.tailleCm != null) setTailleCm(profile.tailleCm)
    if (profile.birthDate) setBirthDate(profile.birthDate)
  }, [profile])

  const age = useMemo(() => ageFromBirthDate(birthDate || null), [birthDate])

  const canSave = sexe != null && tailleCm != null && !!birthDate && !saving

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sexe, tailleCm, birthDate }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error ?? `Erreur ${res.status}`)
        return
      }
      invalidateProfileCache()
      toast.ok('Profil enregistré.')
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  if (!mounted) return null

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compléter ton profil"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'color-mix(in oklch, var(--bg) 70%, transparent)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'dialogFadeIn 200ms ease both',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          maxHeight: 'calc(100dvh - 40px)',
          overflowY: 'auto',
          background: 'var(--surface)',
          borderRadius: 18,
          boxShadow:
            '0 0 0 1px var(--line) inset, 0 30px 60px -20px rgba(0,0,0,0.6)',
          padding: 22,
          animation: 'dialogPopIn 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'var(--brand-soft)',
              color: 'var(--brand)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            Profil
          </span>

          <button
            onClick={onDismiss}
            disabled={saving}
            style={{
              appearance: 'none',
              border: 'none',
              background: 'transparent',
              color: 'var(--muted)',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'var(--font)',
              cursor: saving ? 'default' : 'pointer',
              padding: '4px 4px',
              margin: '-4px -4px -4px 0',
              letterSpacing: 0.1,
            }}
          >
            Plus tard
          </button>
        </div>

        <h2
          style={{
            margin: '0 0 8px',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: -0.6,
            color: 'var(--ink)',
            fontFamily: 'var(--display)',
            lineHeight: 1.15,
          }}
        >
          Trois infos pour un meilleur contexte
        </h2>
        <p
          style={{
            margin: '0 0 18px',
            fontSize: 13,
            color: 'var(--muted)',
            lineHeight: 1.5,
          }}
        >
          Ajoute ces informations pour une meilleure analyse de ton profil.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Sexe">
            <Segmented<Sexe>
              options={[
                { value: 'H', label: 'Homme' },
                { value: 'F', label: 'Femme' },
              ]}
              value={sexe}
              onChange={setSexe}
            />
          </Field>

          <div style={{ display: 'flex', gap: 10 }}>
            <NumericInput
              value={tailleCm}
              onChange={setTailleCm}
              label="Taille"
              suffix="cm"
              step={1}
              min={80}
              max={260}
              allowNull
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: 'var(--muted)',
                  fontWeight: 500,
                }}
              >
                <span>Naissance</span>
                {age != null && (
                  <span style={{ fontSize: 10, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>
                    {age} ans
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="date"
                  lang="fr-FR"
                  value={birthDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setBirthDate(e.target.value)}
                  style={{
                    height: 56,
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    // Neutralise le widget date natif iOS/Safari : sa largeur
                    // intrinsèque forçait l'input à dépasser la colonne (jusqu'à la
                    // bordure du modal) et décentrait le texte (champ « vide »).
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    // flex + align-items center : recentre verticalement la valeur,
                    // sinon le texte natif iOS reste collé en haut de l'input.
                    display: 'flex',
                    alignItems: 'center',
                    textAlign: 'left',
                    border: 'none',
                    outline: 'none',
                    background: 'var(--surface-2)',
                    borderRadius: 14,
                    boxShadow: '0 0 0 1px var(--line) inset',
                    padding: '0 12px',
                    fontFamily: 'var(--font)',
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--ink)',
                  }}
                  aria-label="Date de naissance"
                />
                {/* Placeholder custom : le placeholder natif d'un input date vide
                    disparaît avec -webkit-appearance:none sur iOS. */}
                {!birthDate && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      fontFamily: 'var(--font)',
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--subtle)',
                    }}
                  >
                    jj/mm/aaaa
                  </span>
                )}
              </div>
            </div>
          </div>

          <Button onClick={save} disabled={!canSave} size="lg">
            {saving ? 'Enregistrement…' : 'Enregistrer et continuer'}
          </Button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
      {children}
    </div>
  )
}
