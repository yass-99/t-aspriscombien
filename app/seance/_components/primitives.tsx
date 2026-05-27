'use client'

import { useState, useRef, CSSProperties, ReactNode } from 'react'
import { Minus, Plus } from './icons'

// ─── Button ────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'lg' | 'md' | 'sm'

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'lg',
  icon,
  trailingIcon,
  full = true,
  disabled = false,
  style = {},
}: {
  children?: ReactNode
  onClick?: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  trailingIcon?: ReactNode
  full?: boolean
  disabled?: boolean
  style?: CSSProperties
}) {
  const [hover, setHover] = useState(false)
  const [pressed, setPressed] = useState(false)

  const base: CSSProperties = {
    appearance: 'none',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontWeight: 600,
    letterSpacing: -0.1,
    transition: 'transform 120ms ease, background 120ms ease, box-shadow 160ms ease, color 120ms',
    width: full ? '100%' : 'auto',
    transform: pressed ? 'scale(0.985)' : 'scale(1)',
    opacity: disabled ? 0.45 : 1,
    fontFamily: 'var(--font)',
  }
  const sizes: Record<ButtonSize, CSSProperties> = {
    lg: { height: 52, padding: '0 18px', borderRadius: 12, fontSize: 16 },
    md: { height: 44, padding: '0 16px', borderRadius: 10, fontSize: 15 },
    sm: { height: 34, padding: '0 12px', borderRadius: 8, fontSize: 13 },
  }
  const variants: Record<ButtonVariant, CSSProperties> = {
    primary: {
      background: hover
        ? 'color-mix(in oklch, var(--accent) 88%, black)'
        : 'var(--accent)',
      color: 'var(--accent-ink)',
      boxShadow: hover
        ? '0 12px 30px -10px color-mix(in oklch, var(--accent) 60%, transparent)'
        : '0 6px 18px -8px color-mix(in oklch, var(--accent) 45%, transparent)',
    },
    secondary: {
      background: hover ? 'var(--surface-2)' : 'var(--surface)',
      color: 'var(--ink)',
      boxShadow: '0 0 0 1px var(--line) inset',
    },
    ghost: {
      background: hover ? 'var(--surface-2)' : 'transparent',
      color: 'var(--ink-2)',
    },
    danger: {
      background: hover
        ? 'color-mix(in oklch, var(--danger) 18%, var(--surface))'
        : 'var(--surface)',
      color: 'var(--danger)',
      boxShadow: '0 0 0 1px color-mix(in oklch, var(--danger) 28%, var(--line)) inset',
    },
  }

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setPressed(false)
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
    >
      {icon}
      {children}
      {trailingIcon}
    </button>
  )
}

// ─── Card ──────────────────────────────────────────────────────────
export function Card({
  children,
  style = {},
  interactive = false,
  onClick,
}: {
  children?: ReactNode
  style?: CSSProperties
  interactive?: boolean
  onClick?: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        boxShadow:
          hover && interactive
            ? '0 0 0 1px color-mix(in oklch, var(--line) 60%, var(--accent-line)) inset, 0 12px 32px -12px rgba(0,0,0,0.6)'
            : '0 0 0 1px var(--line) inset, 0 1px 2px rgba(0,0,0,0.3)',
        transition: 'box-shadow 180ms ease, transform 120ms',
        transform: hover && interactive ? 'translateY(-1px)' : 'none',
        cursor: interactive ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Numeric stepper input ─────────────────────────────────────────
export function NumericInput({
  value,
  onChange,
  label,
  suffix,
  step = 1,
  min = 0,
  max = 999,
  decimals = 0,
  size = 'md',
  hint,
  icon,
  allowNull = false,
}: {
  value: number | null
  onChange: (v: number | null) => void
  label?: ReactNode
  suffix?: ReactNode
  step?: number
  min?: number
  max?: number
  decimals?: number
  size?: 'md' | 'hero'
  hint?: ReactNode
  icon?: ReactNode
  // When true, decrementing from `min` switches to a « non compté » state (null → X).
  allowNull?: boolean
}) {
  const [focus, setFocus] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const isNull = value === null
  const fmt = (n: number) => {
    if (!decimals) return String(n)
    const fixed = Number(n).toFixed(decimals)
    return fixed.replace(/\.?0+$/, '')
  }
  const clamp = (n: number) => Math.max(min, Math.min(max, Number(n.toFixed(decimals))))
  const adjust = (delta: number) => {
    setDraft(null)
    if (isNull) {
      // Coming back from « non compté » → land on min, regardless of delta sign.
      onChange(delta > 0 ? min : null)
      return
    }
    const next = (value ?? 0) + delta
    if (allowNull && delta < 0 && (value ?? 0) <= min) {
      onChange(null)
      return
    }
    onChange(clamp(next))
  }

  // When null & not focused, show « JSP » directly in the input — bolder than a placeholder.
  const display = draft ?? (isNull ? (focus ? '' : 'JSP') : fmt(value as number))

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (!/^-?[0-9]*[.,]?[0-9]*$/.test(raw)) return
    setDraft(raw)
    const normalized = raw.replace(',', '.')
    if (normalized === '' || normalized === '-' || normalized === '.' || normalized === '-.') return
    const n = parseFloat(normalized)
    if (!isNaN(n)) {
      const bounded = Math.min(max, Math.max(min, n))
      onChange(bounded)
    }
  }

  const handleBlur = () => {
    setFocus(false)
    if (draft === null) return
    const normalized = draft.trim().replace(',', '.')
    if (normalized === '' || normalized === '-' || normalized === '.' || normalized === '-.') {
      if (allowNull) onChange(null)
      else onChange(clamp(0))
    } else {
      const n = parseFloat(normalized)
      if (!isNaN(n)) onChange(clamp(n))
    }
    setDraft(null)
  }

  const handleFocus = () => {
    setFocus(true)
    setDraft(isNull ? '' : fmt(value as number))
    requestAnimationFrame(() => {
      inputRef.current?.select()
    })
  }

  const sizes = {
    md: { h: 56, btn: 32, num: 24, suf: 13, gap: 4, lbl: 12 },
    hero: { h: 84, btn: 56, num: 44, suf: 16, gap: 6, lbl: 12 },
  }
  const sz = sizes[size]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            fontSize: sz.lbl,
            color: 'var(--muted)',
            fontWeight: 500,
            letterSpacing: -0.1,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          {icon}
          {label}
        </div>
        {hint && (
          <span style={{ fontSize: 10, color: 'var(--subtle)', fontFamily: 'var(--mono)' }}>
            {hint}
          </span>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: sz.h,
          background: 'var(--surface)',
          borderRadius: 14,
          boxShadow: focus
            ? '0 0 0 1.5px var(--accent) inset, 0 0 0 4px color-mix(in oklch, var(--accent) 22%, transparent)'
            : '0 0 0 1px var(--line) inset',
          transition: 'box-shadow 160ms',
        }}
      >
        <button
          onClick={() => adjust(-step)}
          style={{
            width: sz.btn,
            height: '100%',
            background: 'transparent',
            border: 'none',
            color: 'var(--muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="diminuer"
        >
          <Minus size={size === 'hero' ? 18 : 16} />
        </button>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: sz.gap,
            padding: '0 4px',
          }}
        >
          <input
            ref={inputRef}
            value={display}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            inputMode="decimal"
            enterKeyHint="done"
            aria-label={isNull ? 'non compté' : undefined}
            style={{
              flex: 1,
              minWidth: 0,
              width: '100%',
              textAlign: 'center',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--mono)',
              fontSize: sz.num,
              fontWeight: 600,
              color: isNull && !focus ? 'var(--subtle)' : 'var(--ink)',
              letterSpacing: -0.5,
              padding: 0,
              fontVariantNumeric: 'tabular-nums',
            }}
          />
          {suffix && !isNull && (
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: sz.suf,
                color: 'var(--subtle)',
                fontWeight: 500,
              }}
            >
              {suffix}
            </span>
          )}
        </div>
        <button
          onClick={() => adjust(step)}
          style={{
            width: sz.btn,
            height: '100%',
            background: 'transparent',
            border: 'none',
            color: 'var(--muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="augmenter"
        >
          <Plus size={size === 'hero' ? 18 : 16} />
        </button>
      </div>
    </div>
  )
}

// ─── Segmented control ─────────────────────────────────────────────
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 4,
        background: 'var(--surface-2)',
        borderRadius: 10,
        width: '100%',
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              height: 36,
              padding: '0 12px',
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--ink)' : 'var(--muted)',
              fontWeight: active ? 600 : 500,
              fontSize: 13,
              borderRadius: 8,
              boxShadow: active
                ? '0 1px 2px rgba(0,0,0,0.40), 0 0 0 1px var(--line)'
                : 'none',
              transition: 'all 160ms ease',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Toggle switch ─────────────────────────────────────────────────
export function Toggle({
  checked,
  onChange,
  size = 'md',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  size?: 'sm' | 'md'
}) {
  const w = size === 'sm' ? 36 : 44
  const h = size === 'sm' ? 22 : 26
  const t = h - 4
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: w,
        height: h,
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        background: checked ? 'var(--accent)' : 'var(--surface-2)',
        position: 'relative',
        padding: 0,
        transition: 'background 200ms',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? w - t - 2 : 2,
          width: t,
          height: t,
          borderRadius: 999,
          background: checked ? 'var(--accent-ink)' : 'var(--ink)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.40), 0 1px 0 rgba(0,0,0,0.20)',
          transition: 'left 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </button>
  )
}

// ─── Pill / badge ──────────────────────────────────────────────────
export function Pill({
  children,
  tone = 'neutral',
  icon,
}: {
  children?: ReactNode
  tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'outline'
  icon?: ReactNode
}) {
  const tones = {
    neutral: { bg: 'var(--surface-2)', fg: 'var(--ink-2)', border: 'transparent' },
    accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)', border: 'transparent' },
    ok: { bg: 'color-mix(in oklch, var(--ok) 18%, var(--surface))', fg: 'var(--ok)', border: 'transparent' },
    warn: { bg: 'color-mix(in oklch, var(--warn) 18%, var(--surface))', fg: 'var(--warn)', border: 'transparent' },
    outline: { bg: 'transparent', fg: 'var(--muted)', border: 'var(--line)' },
  }[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 22,
        padding: '0 8px',
        borderRadius: 999,
        background: tones.bg,
        color: tones.fg,
        boxShadow: tones.border !== 'transparent' ? `0 0 0 1px ${tones.border} inset` : 'none',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0,
        fontFamily: 'var(--font)',
      }}
    >
      {icon}
      {children}
    </span>
  )
}

// ─── Top app bar ───────────────────────────────────────────────────
export function TopBar({
  leading,
  title,
  subtitle,
  trailing,
}: {
  leading?: ReactNode
  title?: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px 12px',
        minHeight: 48,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          minWidth: 36,
        }}
      >
        {leading}
      </div>
      <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
        {title && (
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink)',
              letterSpacing: -0.1,
            }}
          >
            {title}
          </div>
        )}
        {subtitle && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              marginTop: 1,
              fontFamily: 'var(--mono)',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          minWidth: 36,
        }}
      >
        {trailing}
      </div>
    </div>
  )
}

// ─── Icon button (round) ───────────────────────────────────────────
export function IconButton({
  icon,
  onClick,
  label,
  variant = 'ghost',
}: {
  icon?: ReactNode
  onClick?: () => void
  label?: string
  variant?: 'ghost' | 'outlined'
}) {
  const [hover, setHover] = useState(false)
  const styles =
    variant === 'ghost'
      ? { bg: hover ? 'var(--surface-2)' : 'transparent', ring: 'transparent', color: 'var(--ink-2)' }
      : { bg: hover ? 'var(--surface-2)' : 'var(--surface)', ring: 'var(--line)', color: 'var(--ink-2)' }
  return (
    <button
      onClick={onClick}
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        background: styles.bg,
        color: styles.color,
        boxShadow: `0 0 0 1px ${styles.ring} inset`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 140ms',
      }}
    >
      {icon}
    </button>
  )
}

// ─── Progress dots (step indicator) ────────────────────────────────
export function Steps({ count, current }: { count: number; current: number }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 4,
            borderRadius: 2,
            width: i === current ? 24 : 16,
            background: i <= current ? 'var(--accent)' : 'var(--line)',
            transition: 'all 240ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      ))}
    </div>
  )
}

// ─── Finish / Terminer pill ────────────────────────────────────────
export function FinishPill({
  onClick,
  label = 'Terminer',
  tone = 'danger',
}: {
  onClick?: () => void
  label?: string
  tone?: 'accent' | 'danger'
}) {
  const [hover, setHover] = useState(false)
  const isDanger = tone === 'danger'
  const color = isDanger ? 'var(--danger)' : 'var(--accent)'
  const hoverBg = isDanger
    ? 'color-mix(in oklch, var(--danger) 16%, var(--surface))'
    : 'var(--accent-soft)'
  const ring = hover
    ? color
    : isDanger
      ? 'color-mix(in oklch, var(--danger) 38%, var(--line))'
      : 'var(--accent-line)'
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 32,
        padding: '0 12px 0 14px',
        borderRadius: 999,
        border: 'none',
        background: hover ? hoverBg : 'var(--surface)',
        color,
        boxShadow: `0 0 0 1px ${ring} inset`,
        fontFamily: 'var(--font)',
        fontSize: 12,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        transition: 'all 140ms',
        flexShrink: 0,
      }}
    >
      <span>{label}</span>
      <StopSquare size={10} color={color} />
    </button>
  )
}

function StopSquare({ size = 10, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden>
      <rect x="1" y="1" width="8" height="8" rx="1.5" fill={color} />
    </svg>
  )
}
