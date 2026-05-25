import Link from 'next/link'
import { Show } from '@clerk/nextjs'

export default function Home() {
  return (
    <main
      style={{
        minHeight: 'calc(100dvh - 60px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        background: 'var(--bg)',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontSize: 52,
          fontWeight: 700,
          letterSpacing: -2.2,
          margin: '0 0 12px',
          fontFamily: 'var(--display)',
        }}
      >
        T&apos;asPris
        <span style={{ color: 'var(--accent)' }}>Combien</span>
        <span style={{ color: 'var(--accent)' }}>?</span>
      </h1>
      <p
        style={{
          margin: '0 0 28px',
          color: 'var(--muted)',
          fontSize: 16,
          lineHeight: 1.5,
          maxWidth: 420,
        }}
      >
        Une séance guidée, série par série. Pas de tableaux de bord — juste ce que tu portes, et
        combien de fois.
      </p>
      <Show when="signed-in">
        <Link
          href="/seance"
          style={{
            height: 52,
            padding: '0 22px',
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            fontFamily: 'var(--font)',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--accent-ink)',
            textDecoration: 'none',
            background: 'var(--accent)',
          }}
        >
          Commencer une séance
        </Link>
      </Show>
      <Show when="signed-out">
        <Link
          href="/sign-in?redirect_url=/seance"
          style={{
            height: 52,
            padding: '0 22px',
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            fontFamily: 'var(--font)',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--accent-ink)',
            textDecoration: 'none',
            background: 'var(--accent)',
          }}
        >
          Se connecter pour commencer
        </Link>
      </Show>
    </main>
  )
}
