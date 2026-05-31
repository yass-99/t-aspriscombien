// Lissage de courbes — transforme une suite de points en chemin SVG fluide,
// pour remplacer les polylignes en angles droits (`M…L…L`) par des courbes.
//
// On utilise l'interpolation cubique MONOTONE (Fritsch–Carlson, alias
// d3 `curveMonotoneX`) : la courbe passe exactement par chaque point et ne
// dépasse JAMAIS verticalement les valeurs des données entre deux points.
// C'est crucial ici — une spline de Catmull-Rom classique « overshoot » et
// plongerait sous la ligne de base, salissant les remplissages (fill) qui se
// referment en bas. Monotone = zéro artefact sous zéro, courbe douce et stable.

export type Pt = { x: number; y: number }

// Arrondi compact pour garder des chaînes de path légères et déterministes.
const r = (n: number) => Math.round(n * 100) / 100

/**
 * Chemin lissé passant par tous les points (axe X strictement croissant).
 * Retombe proprement sur des segments droits si < 3 points.
 */
export function smoothLine(points: Pt[]): string {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M ${r(points[0].x)} ${r(points[0].y)}`
  if (n === 2)
    return `M ${r(points[0].x)} ${r(points[0].y)} L ${r(points[1].x)} ${r(points[1].y)}`

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)

  // Pentes des sécantes entre points consécutifs.
  const dx: number[] = []
  const dy: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1] - xs[i]
    dy[i] = ys[i + 1] - ys[i]
    slope[i] = dx[i] === 0 ? 0 : dy[i] / dx[i]
  }

  // Tangentes en chaque point.
  const m: number[] = new Array(n)
  m[0] = slope[0]
  m[n - 1] = slope[n - 2]
  for (let i = 1; i < n - 1; i++) {
    // Extremum local (changement de signe) → tangente plate, pas de dépassement.
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2
  }

  // Contrainte de monotonicité de Fritsch–Carlson.
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
    } else {
      const a = m[i] / slope[i]
      const b = m[i + 1] / slope[i]
      const h = Math.hypot(a, b)
      if (h > 3) {
        const t = 3 / h
        m[i] = t * a * slope[i]
        m[i + 1] = t * b * slope[i]
      }
    }
  }

  // Conversion en courbes de Bézier cubiques (1/3 de la corde de chaque côté).
  let d = `M ${r(xs[0])} ${r(ys[0])}`
  for (let i = 0; i < n - 1; i++) {
    const c1x = xs[i] + dx[i] / 3
    const c1y = ys[i] + (m[i] * dx[i]) / 3
    const c2x = xs[i + 1] - dx[i] / 3
    const c2y = ys[i + 1] - (m[i + 1] * dx[i]) / 3
    d += ` C ${r(c1x)} ${r(c1y)} ${r(c2x)} ${r(c2y)} ${r(xs[i + 1])} ${r(ys[i + 1])}`
  }
  return d
}

/**
 * Variante pratique : courbe lissée à partir de valeurs Y régulièrement
 * espacées sur l'axe X. `y` mappe une valeur vers sa coordonnée verticale.
 */
export function smoothLineFromValues(
  values: number[],
  step: number,
  y: (v: number) => number,
): string {
  return smoothLine(values.map((v, i) => ({ x: i * step, y: y(v) })))
}

/**
 * Échantillonne la MÊME courbe monotone que `smoothLine`, mais renvoie une
 * suite de points (xs, ys) répartis UNIFORMÉMENT EN LONGUEUR D'ARC.
 *
 * Sert à faire suivre un point (le « stylo ») exactement le long du tracé en
 * synchro parfaite avec un `pathLength` framer-motion : pathLength interpole en
 * longueur d'arc → en animant cx/cy sur ces points en `ease: 'linear'`, la tête
 * du trait et le point restent collés tout du long.
 */
export function sampleSmoothByValues(
  values: number[],
  step: number,
  y: (v: number) => number,
  count = 48,
): { xs: number[]; ys: number[] } {
  const n = values.length
  if (n === 0) return { xs: [], ys: [] }
  const xs0 = values.map((_, i) => i * step)
  const ys0 = values.map((v) => y(v))
  if (n === 1) return { xs: [xs0[0]], ys: [ys0[0]] }

  // Tangentes monotones (Fritsch–Carlson) — identique à smoothLine.
  const dx: number[] = []
  const dy: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs0[i + 1] - xs0[i]
    dy[i] = ys0[i + 1] - ys0[i]
    slope[i] = dx[i] === 0 ? 0 : dy[i] / dx[i]
  }
  const m: number[] = new Array(n)
  m[0] = slope[0]
  m[n - 1] = slope[n - 2]
  for (let i = 1; i < n - 1; i++) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
    } else {
      const a = m[i] / slope[i]
      const b = m[i + 1] / slope[i]
      const h = Math.hypot(a, b)
      if (h > 3) {
        const t = 3 / h
        m[i] = t * a * slope[i]
        m[i + 1] = t * b * slope[i]
      }
    }
  }

  // Échantillonnage dense de chaque segment de Bézier cubique.
  const dense: { x: number; y: number }[] = []
  const K = 24
  for (let i = 0; i < n - 1; i++) {
    const c1x = xs0[i] + dx[i] / 3
    const c1y = ys0[i] + (m[i] * dx[i]) / 3
    const c2x = xs0[i + 1] - dx[i] / 3
    const c2y = ys0[i + 1] - (m[i + 1] * dx[i]) / 3
    for (let k = i === 0 ? 0 : 1; k <= K; k++) {
      const t = k / K
      const u = 1 - t
      const bx = u * u * u * xs0[i] + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * xs0[i + 1]
      const by = u * u * u * ys0[i] + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ys0[i + 1]
      dense.push({ x: bx, y: by })
    }
  }

  // Longueur cumulée puis ré-échantillonnage uniforme en longueur d'arc.
  const cum: number[] = [0]
  for (let i = 1; i < dense.length; i++) {
    cum[i] = cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y)
  }
  const total = cum[cum.length - 1] || 1
  const xs: number[] = []
  const ys: number[] = []
  let j = 0
  for (let s = 0; s < count; s++) {
    const target = (s / (count - 1)) * total
    while (j < dense.length - 1 && cum[j + 1] < target) j++
    const segLen = cum[j + 1] - cum[j] || 1
    const f = (target - cum[j]) / segLen
    xs.push(dense[j].x + (dense[j + 1].x - dense[j].x) * f)
    ys.push(dense[j].y + (dense[j + 1].y - dense[j].y) * f)
  }
  return { xs, ys }
}
