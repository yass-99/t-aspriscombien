import { CSSProperties } from 'react'

// Un segment = soit du texte (avec couleur optionnelle), soit un saut de ligne
// dur (`br`). Le saut de ligne ne consomme pas d'index de stagger.
type Segment = { text?: string; color?: string; br?: boolean }

// Affiche un titre lettre par lettre : chaque glyphe « monte » du bas avec un
// léger décalage (stagger). Les mots restent insécables (inline-block +
// nowrap) pour ne jamais couper un mot en fin de ligne ; les espaces restent
// des points de césure normaux. `rise` règle la hauteur de montée (em) — on la
// réduit sur les très gros titres pour éviter que les lettres empiètent sur la
// ligne du dessous pendant l'animation.
export function LetterReveal({
  segments,
  baseDelay = 0.12,
  step = 0.034,
  duration = 0.62,
  rise = '0.6em',
  style,
}: {
  segments: Segment[]
  // Délai avant la première lettre (s).
  baseDelay?: number
  // Décalage entre deux lettres consécutives (s).
  step?: number
  // Durée de la montée d'une lettre (s).
  duration?: number
  // Hauteur de montée initiale (unité CSS, em recommandé).
  rise?: string
  style?: CSSProperties
}) {
  let i = -1
  return (
    <span style={{ display: 'inline', ...style }}>
      {segments.map((seg, si) => {
        if (seg.br) return <br key={`br-${si}`} />
        const tokens = (seg.text ?? '').split(/(\s+)/)
        return tokens.map((tok, ti) => {
          if (tok === '') return null
          if (/^\s+$/.test(tok)) return <span key={`${si}-${ti}`}>{tok}</span>
          return (
            <span
              key={`${si}-${ti}`}
              style={{ display: 'inline-block', whiteSpace: 'nowrap', color: seg.color }}
            >
              {Array.from(tok).map((ch) => {
                i += 1
                return (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      ['--lr-rise' as string]: rise,
                      animation: `letterUp ${duration}s ${(baseDelay + i * step).toFixed(3)}s cubic-bezier(0.22, 1, 0.36, 1) both`,
                    }}
                  >
                    {ch}
                  </span>
                )
              })}
            </span>
          )
        })
      })}
    </span>
  )
}
