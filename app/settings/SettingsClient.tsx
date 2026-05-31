'use client'

import Link from 'next/link'
import { usePrefs } from '../seance/_lib/prefs'
import { playRestEndAlert, unlockAudio } from '../seance/_lib/restAlert'
import { Toggle } from '../seance/_components/primitives'
import { ChevronRight } from '../seance/_components/icons'
import ProfileSettings from './ProfileSettings'

export default function SettingsClient() {
  const [prefs, setPrefs] = usePrefs()

  const testAlert = () => {
    unlockAudio()
    playRestEndAlert({ sound: prefs.soundEnabled, haptic: prefs.hapticEnabled })
  }

  return (
    <main
      className="app-scroll"
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 20px 48px',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <Link
          href="/seance"
          aria-label="retour"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-2)',
            background: 'var(--surface)',
            boxShadow: '0 0 0 1px var(--line) inset',
            textDecoration: 'none',
            transform: 'rotate(180deg)',
          }}
        >
          <ChevronRight size={16} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: -0.6,
              fontFamily: 'var(--display)',
              color: 'var(--ink)',
            }}
          >
            Réglages
          </h1>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            Profil synchronisé · préférences de repos sur cet appareil.
          </div>
        </div>
      </header>

      <section
        style={{
          background: 'var(--surface)',
          borderRadius: 16,
          boxShadow: '0 0 0 1px var(--line) inset',
          overflow: 'hidden',
        }}
      >
        <SettingTitle>Repos</SettingTitle>
        <ToggleRow
          title="Bip de fin de repos"
          subtitle="Trois tons quand la cible est atteinte."
          checked={prefs.soundEnabled}
          onChange={(v) => setPrefs({ soundEnabled: v })}
        />
        <Divider />
        <ToggleRow
          title="Vibration"
          subtitle="Court motif haptique en fin de repos (Android)."
          checked={prefs.hapticEnabled}
          onChange={(v) => setPrefs({ hapticEnabled: v })}
        />
        <Divider />
        <div style={{ padding: '14px 16px' }}>
          <button
            onClick={testAlert}
            style={{
              appearance: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '10px 14px',
              borderRadius: 10,
              background: 'var(--surface-2)',
              color: 'var(--ink-2)',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font)',
              boxShadow: '0 0 0 1px var(--line) inset',
            }}
          >
            Tester l&apos;alerte
          </button>
          <div style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 6 }}>
            Sur iOS, l&apos;audio nécessite une première interaction par session.
          </div>
        </div>
      </section>

      <ProfileSettings />
    </main>
  )
}

function SettingTitle({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  )
}

function ToggleRow({
  title,
  subtitle,
  checked,
  onChange,
}: {
  title: string
  subtitle?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--line)', margin: '0 16px' }} />
}
