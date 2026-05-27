type IconProps = {
  size?: number
  color?: string
  stroke?: number
}

export const Copy = ({ size = 16, color = 'currentColor', stroke = 1.8 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="9" y="9" width="11" height="11" rx="2" stroke={color} strokeWidth={stroke} />
    <path
      d="M5 15V6a2 2 0 0 1 2-2h9"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
    />
  </svg>
)

export const ChevronRight = ({ size = 16, color = 'currentColor', stroke = 2 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M9 6l6 6-6 6" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const ChevronLeft = ({ size = 16, color = 'currentColor', stroke = 2 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M15 6l-6 6 6 6" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const ChevronDown = ({ size = 16, color = 'currentColor', stroke = 2 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M6 9l6 6 6-6" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const ChevronUp = ({ size = 16, color = 'currentColor', stroke = 2 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M6 15l6-6 6 6" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const Plus = ({ size = 16, color = 'currentColor', stroke = 2 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 5v14M5 12h14" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
  </svg>
)

export const Minus = ({ size = 16, color = 'currentColor', stroke = 2 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5 12h14" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
  </svg>
)

export const Check = ({ size = 16, color = 'currentColor', stroke = 2.2 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M4 12.5l5 5L20 6" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const Spark = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M5 19l4-4M15 9l4-4"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
)

export const ArrowUpRight = ({ size = 16, color = 'currentColor', stroke = 2 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M7 17L17 7M9 7h8v8" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const Flame = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 3c1 3-1 4-1 7a4 4 0 008 0c0-4-3-6-3-9 0 0-2 1-3 4-1-1-1-2-1-2zM8 13a4 4 0 008 0"
      stroke={color}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const Timer = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="13" r="8" stroke={color} strokeWidth="1.7" />
    <path d="M12 9v4l2.5 2M9 2h6M12 2v2" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

export const Dumbbell = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

export const TrendUp = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M3 17l6-6 4 4 7-8M14 7h6v6" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const Settings = ({ size = 16, color = 'currentColor' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.7" />
    <path
      d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
      stroke={color}
      strokeWidth="1.4"
    />
  </svg>
)

export const X = ({ size = 16, color = 'currentColor', stroke = 2 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
  </svg>
)

export const Trash = ({ size = 16, color = 'currentColor', stroke = 1.8 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M10 11v7M14 11v7"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const Logo = ({ size = 22, color = 'var(--accent)' }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="10" fill={color} />
    <rect x="5.5" y="11" width="13" height="2.2" rx="1.1" fill="rgba(255,255,255,0.95)" />
    <circle cx="12" cy="12" r="1.8" fill={color} />
    <circle cx="12" cy="12" r="1.8" stroke="rgba(255,255,255,0.95)" strokeWidth="0.8" fill="none" />
  </svg>
)
