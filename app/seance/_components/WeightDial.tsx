'use client'

import { useRef } from 'react'

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
export function clampWeight(n: number): number {
  return Math.max(30, Math.min(300, round1(n)))
}
export function fmtKg(n: number): string {
  return (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace('.', ',')
}

/**
 * Dial de pesée : grand chiffre central + boutons −/+ (0,1 kg) et glissement
 * horizontal (0,1 kg / px). Contrôlé. Réutilisé par le check-in et le modal poids.
 */
export function WeightDial({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const dragRef = useRef<{ x: number; v: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, v: value }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.x
    onChange(clampWeight(dragRef.current.v + dx * 0.1))
  }
  const endDrag = () => {
    dragRef.current = null
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '6px 0 2px',
        cursor: 'ew-resize',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <DialButton onClick={() => onChange(clampWeight(value - 0.1))}>−</DialButton>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 4,
          minWidth: 150,
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 46,
            fontWeight: 600,
            letterSpacing: -2,
            lineHeight: 1,
            color: 'var(--ink)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {fmtKg(value)}
        </span>
        <span style={{ fontSize: 15, color: 'var(--muted)', fontWeight: 600 }}>kg</span>
      </div>
      <DialButton onClick={() => onChange(clampWeight(value + 0.1))}>+</DialButton>
    </div>
  )
}

function DialButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        background: 'var(--surface)',
        color: 'var(--ink-2)',
        boxShadow: '0 0 0 1px var(--line) inset',
        fontFamily: 'var(--mono)',
        fontSize: 18,
        fontWeight: 600,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}
