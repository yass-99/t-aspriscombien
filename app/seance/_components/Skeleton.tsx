'use client'

import { CSSProperties, ReactNode } from 'react'

// Skeleton shimmer — placeholder de chargement (cf. DESIGN.md : skeleton > spinner
// pour toute opération > ~300ms). Respecte prefers-reduced-motion via globals.css.
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 'var(--radius-md)',
  style = {},
}: {
  width?: number | string
  height?: number | string
  radius?: number | string
  style?: CSSProperties
}) {
  return (
    <div
      aria-hidden
      style={{
        width,
        height,
        borderRadius: radius,
        background:
          'linear-gradient(100deg, var(--surface-2) 25%, color-mix(in oklch, var(--surface-2) 55%, var(--ink)) 45%, var(--surface-2) 65%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

// Skeleton « graphe » — silhouette d'une courbe qui shimmer, et non un rectangle.
// On masque le dégradé shimmer par une aire de courbe douce (mask SVG) : pendant
// le chargement, l'utilisateur voit littéralement la forme d'un graphe se remplir.
// La courbe est volontairement la même famille de vagues que les vraies sparklines.
const CHART_WAVE =
  'M0 30 C30 30 50 12 80 16 C110 20 130 34 160 30 C190 26 210 8 250 14 C285 19 300 24 320 20 L320 40 L0 40 Z'

export function SkeletonChart({ height = 40 }: { height?: number }) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 40' preserveAspectRatio='none'><path d='${CHART_WAVE}' fill='black'/></svg>`
  const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  return (
    <div
      aria-hidden
      style={{
        width: '100%',
        height,
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        background:
          'linear-gradient(100deg, var(--surface-2) 25%, color-mix(in oklch, var(--surface-2) 55%, var(--ink)) 45%, var(--surface-2) 65%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
      }}
    />
  )
}

// Spinner discret — anneau qui tourne. Sert d'attente « ponctuelle » quand le
// chrome (texte, structure) est DÉJÀ affiché et qu'il ne manque qu'une donnée :
// le spinner indique « ça charge » sans masquer le contenu déjà en place.
export function Spinner({
  size = 18,
  stroke = 2,
  color = 'var(--muted)',
  track = 'var(--hairline)',
}: {
  size?: number
  stroke?: number
  color?: string
  track?: string
}) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `${stroke}px solid ${track}`,
        borderTopColor: color,
        animation: 'spin 0.7s linear infinite',
      }}
    />
  )
}

// Ligne d'historique fantôme — épouse SeanceRow/AthleticsRow (icône + 2 lignes),
// pour que la liste réelle se substitue sans saut de mise en page.
export function SkeletonHistoryRow() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 14px 14px 17px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--glass-strong)',
        boxShadow: '0 0 0 1px var(--glass-border) inset, 0 1px 0 0 var(--glass-highlight) inset',
      }}
    >
      <Skeleton width={42} height={42} radius={11} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <Skeleton width="42%" height={14} />
        <Skeleton width="70%" height={11} />
      </div>
    </div>
  )
}

// Conteneur neutre qui mime la géométrie d'une Card de contenu (rayon/inset/padding).
function SkelCard({ children, padding = 18 }: { children: ReactNode; padding?: number }) {
  return (
    <div
      style={{
        background: 'var(--surface-elevated)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 0 0 1px var(--hairline) inset',
        padding,
      }}
    >
      {children}
    </div>
  )
}

// Skeleton « carte stat » — mime « Volume cette semaine » : badge + libellé + gros
// chiffre + sparkline.
export function SkeletonStat() {
  return (
    <SkelCard>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Skeleton width={38} height={38} radius="var(--radius-md)" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 2 }}>
          <Skeleton width="45%" height={10} />
          <Skeleton width="62%" height={26} />
          <Skeleton width="38%" height={11} />
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <SkeletonChart height={38} />
      </div>
    </SkelCard>
  )
}

// Petite colonne « discipline » du skeleton « Ta semaine » : pastille + libellé,
// gros chiffre, sous-titre. Mime exactement DisciplineLabel + AnimatedNumber.
function SkelDiscipline() {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Skeleton width={7} height={7} radius={999} />
        <Skeleton width={40} height={9} />
      </div>
      <Skeleton width="62%" height={24} style={{ marginTop: 1 }} />
      <Skeleton width="82%" height={10} />
    </div>
  )
}

// Skeleton « Ta semaine » — épouse au pixel la carte d'aperçu d'IdleScreen :
// header (libellé + flèche), deux colonnes muscu/athlé séparées par un filet,
// puis le rythme de la semaine en forme de graphe.
export function SkeletonWeekStat() {
  return (
    <SkelCard padding={16}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <Skeleton width={74} height={10} />
        <Skeleton width={16} height={16} radius="var(--radius-sm)" />
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 14 }}>
        <SkelDiscipline />
        <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--hairline)' }} />
        <SkelDiscipline />
      </div>
      <div style={{ marginTop: 14 }}>
        <SkeletonChart height={40} />
      </div>
    </SkelCard>
  )
}

// Skeleton « pill coach » — mime le bouton « Copier ma semaine pour mon coach » :
// pastille ronde + libellé + chevron, dans un conteneur glass arrondi.
export function SkeletonCoachPill() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 'var(--radius-full)',
        background: 'var(--glass)',
        boxShadow: '0 0 0 1px var(--hairline) inset',
      }}
    >
      <Skeleton width={24} height={24} radius={999} />
      <Skeleton width="56%" height={12} />
      <Skeleton width={14} height={12} style={{ marginLeft: 'auto' }} />
    </div>
  )
}

// Skeleton « carte action » — mime « Ma semaine pour mon coach » : icône + 2 lignes + bouton.
export function SkeletonAction() {
  return (
    <SkelCard padding={16}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Skeleton width={40} height={40} radius="var(--radius-md)" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton width="58%" height={14} />
          <Skeleton width="40%" height={11} />
        </div>
        <Skeleton width={84} height={32} radius="var(--radius-full)" />
      </div>
    </SkelCard>
  )
}

// Skeleton « carte séance » — mime « Dernière séance » : header (avatar + titre + pill),
// chips d'exos, footer.
export function SkeletonSession() {
  return (
    <SkelCard padding={16}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Skeleton width={34} height={34} radius="var(--radius-md)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width={124} height={13} />
            <Skeleton width={72} height={10} />
          </div>
        </div>
        <Skeleton width={54} height={24} radius="var(--radius-full)" />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Skeleton width={96} height={28} radius="var(--radius-sm)" />
        <Skeleton width={132} height={28} radius="var(--radius-sm)" />
        <Skeleton width={104} height={28} radius="var(--radius-sm)" />
      </div>
      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid var(--hairline)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Skeleton width={118} height={11} />
        <Skeleton width={14} height={11} />
      </div>
    </SkelCard>
  )
}

// Carte skeleton prête à l'emploi (mime une Card de contenu).
export function SkeletonCard({ lines = 2, height = 96 }: { lines?: number; height?: number }) {
  return (
    <div
      style={{
        background: 'var(--surface-elevated)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 0 0 1px var(--hairline) inset',
        padding: 18,
        minHeight: height,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <Skeleton width={38} height={38} radius="var(--radius-md)" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 2 }}>
        <Skeleton width="40%" height={11} />
        <Skeleton width="70%" height={22} />
        {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
          <Skeleton key={i} width={`${55 - i * 12}%`} height={11} />
        ))}
      </div>
    </div>
  )
}
