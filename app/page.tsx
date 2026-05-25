import Link from 'next/link'
import { Show } from '@clerk/nextjs'

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 20px 24px',
        maxWidth: 480,
        margin: '0 auto',
        background:
          'radial-gradient(120% 70% at 50% 0%, color-mix(in oklch, var(--accent) 8%, var(--bg)) 0%, var(--bg) 60%)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px 4px 6px',
          borderRadius: 999,
          background: 'var(--surface)',
          boxShadow: '0 0 0 1px var(--line) inset',
          marginBottom: 16,
          fontSize: 11,
          color: 'var(--ink-2)',
          fontWeight: 500,
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 999,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
          }}
        >
          ✦
        </span>
        Tracker de séance · local-first
      </div>
      <h1
        style={{
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: -1.6,
          margin: '0 0 10px',
          fontFamily: 'var(--display)',
          lineHeight: 1.02,
          color: 'var(--ink)',
        }}
      >
        T&apos;asPris
        <span style={{ color: 'var(--accent)' }}>Combien</span>
        <span style={{ color: 'var(--accent)' }}>?</span>
      </h1>
      <p
        style={{
          margin: '0 0 22px',
          color: 'var(--muted)',
          fontSize: 14,
          lineHeight: 1.45,
          maxWidth: 340,
        }}
      >
        Une séance guidée, série par série. Pas de tableaux de bord — juste ce que tu portes, et
        combien de fois.
      </p>
      <Show when="signed-in">
        <Link
          href="/seance"
          style={{
            height: 50,
            padding: '0 22px',
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'var(--font)',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--accent-ink)',
            textDecoration: 'none',
            background: 'var(--accent)',
            boxShadow:
              '0 10px 24px -10px color-mix(in oklch, var(--accent) 50%, transparent)',
            letterSpacing: -0.2,
          }}
        >
          Commencer une séance
          <span style={{ fontSize: 16 }}>→</span>
        </Link>
      </Show>
      <Show when="signed-out">
        <Link
          href="/sign-in?redirect_url=/seance"
          style={{
            height: 50,
            padding: '0 22px',
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'var(--font)',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--accent-ink)',
            textDecoration: 'none',
            background: 'var(--accent)',
            boxShadow:
              '0 10px 24px -10px color-mix(in oklch, var(--accent) 50%, transparent)',
            letterSpacing: -0.2,
          }}
        >
          Se connecter pour commencer
          <span style={{ fontSize: 16 }}>→</span>
        </Link>
      </Show>
    </main>
  )
}
