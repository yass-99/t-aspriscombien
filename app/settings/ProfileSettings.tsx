'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button, NumericInput, Segmented } from '../seance/_components/primitives'
import { useProfile, invalidateProfileCache } from '../seance/_lib/useProfile'
import { useBodyweight, invalidateBodyweightCache } from '../seance/_lib/useBodyweight'
import { useMounted } from '../seance/_lib/useMounted'
import { ageFromBirthDate, type Sexe } from '../seance/_lib/profile'
import { ChevronRight, TrendUp } from '../seance/_components/icons'
import { useToast } from '../_components/Toast'

export default function ProfileSettings() {
  const mounted = useMounted()
  const { profile, loading } = useProfile()
  const { current, lastDate } = useBodyweight()
  const toast = useToast()

  const [sexe, setSexe] = useState<Sexe>('H')
  const [tailleCm, setTailleCm] = useState<number | null>(null)
  const [birthDate, setBirthDate] = useState<string>('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [poids, setPoids] = useState<number | null>(null)
  const [savingPoids, setSavingPoids] = useState(false)

  // Hydrate le formulaire dès que le profil est chargé.
  useEffect(() => {
    if (profile) {
      /* eslint-disable react-hooks/set-state-in-effect */
      if (profile.sexe) setSexe(profile.sexe)
      setTailleCm(profile.tailleCm)
      setBirthDate(profile.birthDate ?? '')
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [profile])

  // Pré-remplit le champ poids avec la dernière pesée connue.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (current != null) setPoids(current)
  }, [current])

  const age = useMemo(() => ageFromBirthDate(birthDate || null), [birthDate])

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sexe,
          tailleCm: tailleCm ?? null,
          birthDate: birthDate || null,
        }),
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
      setSavingProfile(false)
    }
  }

  const savePoids = async () => {
    if (poids == null || poids <= 0) return
    setSavingPoids(true)
    try {
      const res = await fetch('/api/bodyweight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poidsKg: poids }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error ?? `Erreur ${res.status}`)
        return
      }
      invalidateBodyweightCache()
      toast.ok('Pesée enregistrée.')
    } catch (e) {
      toast.warn(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setSavingPoids(false)
    }
  }

  return (
    <section
      style={{
        background: 'var(--surface)',
        borderRadius: 16,
        boxShadow: '0 0 0 1px var(--line) inset',
        overflow: 'hidden',
        marginTop: 18,
      }}
    >
      <div
        style={{
          padding: '12px 16px 8px',
          fontSize: 10,
          color: 'var(--muted)',
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        Profil — synchronisé
      </div>

      <div style={{ padding: '6px 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Sexe */}
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

        {/* Taille + naissance */}
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
                  // bordure) et décentrait le texte (champ « vide »).
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

        <Button onClick={saveProfile} disabled={savingProfile || loading} size="md">
          {savingProfile ? 'Enregistrement…' : 'Enregistrer le profil'}
        </Button>
      </div>

      <div style={{ height: 1, background: 'var(--line)', margin: '0 16px' }} />

      {/* Poids de corps — édition seule. La visualisation vit dans les stats. */}
      <div style={{ padding: '14px 16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Poids de corps</span>
          {mounted && current != null && (
            <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
              actuel {current} kg
              {lastDate && (
                <span style={{ color: 'var(--subtle)' }}> · {fmtLastDate(lastDate)}</span>
              )}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <NumericInput
            value={poids}
            onChange={setPoids}
            label="Ma pesée"
            suffix="kg"
            step={0.1}
            decimals={1}
            min={30}
            max={400}
            allowNull
          />
          <Button onClick={savePoids} disabled={savingPoids || poids == null} size="md">
            {savingPoids ? '…' : 'Enregistrer'}
          </Button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--subtle)', lineHeight: 1.45 }}>
          Une pesée par jour — réenregistrer écrase celle du jour.
        </div>

        {/* Lien vers la visualisation (stats global → poids de corps). */}
        <Link
          href="/seance?screen=stats"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 2,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'var(--surface-2)',
            boxShadow: '0 0 0 1px var(--line) inset',
            textDecoration: 'none',
          }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: 'var(--brand-soft)',
              color: 'var(--brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TrendUp size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Voir l&apos;évolution
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Courbe, tendance et historique dans les stats.
            </div>
          </div>
          <ChevronRight size={16} color="var(--subtle)" />
        </Link>
      </div>
    </section>
  )
}

// Date « 29 mai » de la dernière pesée, pour rappeler ce qu'on édite.
function fmtLastDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{label}</div>
      {children}
    </div>
  )
}
