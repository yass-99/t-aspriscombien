'use client'

// Fond ambiant violet — halos diffus très sombres derrière tout le contenu.
// Donne de la matière au verre dépoli (les cards/barre en glass floutent ces halos
// au lieu d'un noir plat). Statique (perf + reduced-motion). cf. DESIGN.md.
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      style={{
        // Fixé au viewport + largeur de la colonne (480) → les halos restent
        // toujours visibles, sur tous les écrans (pas seulement l'Idle borné).
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}
    >
      {/* Halo principal — haut, large, violet marque */}
      <div
        style={{
          position: 'absolute',
          top: '-14%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          height: 480,
          background:
            'radial-gradient(50% 50% at 50% 50%, color-mix(in oklch, var(--brand) 42%, transparent) 0%, transparent 70%)',
          filter: 'blur(60px)',
          opacity: 0.42,
        }}
      />
      {/* Halo secondaire — bas droite, violet profond */}
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '-20%',
          width: 420,
          height: 420,
          background:
            'radial-gradient(50% 50% at 50% 50%, color-mix(in oklch, var(--brand-deep) 50%, transparent) 0%, transparent 70%)',
          filter: 'blur(70px)',
          opacity: 0.32,
        }}
      />
      {/* Halo d'appoint — milieu gauche, très diffus */}
      <div
        style={{
          position: 'absolute',
          top: '38%',
          left: '-25%',
          width: 360,
          height: 360,
          background:
            'radial-gradient(50% 50% at 50% 50%, color-mix(in oklch, var(--brand) 30%, transparent) 0%, transparent 72%)',
          filter: 'blur(70px)',
          opacity: 0.22,
        }}
      />
    </div>
  )
}
