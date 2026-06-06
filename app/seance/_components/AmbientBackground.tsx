'use client'

// Fond ambiant Compagnon — canvas clair + deux halos très doux (vert pré en
// haut, ciel en bas droite) qui donnent de la vie au fond sans le teinter.
// Statique (perf + reduced-motion). cf. DESIGN.md.
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
      {/* Halo principal — haut, large, vert pré très dilué */}
      <div
        style={{
          position: 'absolute',
          top: '-14%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          height: 480,
          background:
            'radial-gradient(50% 50% at 50% 50%, color-mix(in oklch, var(--brand) 16%, transparent) 0%, transparent 70%)',
          filter: 'blur(60px)',
          opacity: 0.5,
        }}
      />
      {/* Halo secondaire — bas droite, ciel très dilué */}
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '-20%',
          width: 420,
          height: 420,
          background:
            'radial-gradient(50% 50% at 50% 50%, color-mix(in oklch, var(--ciel) 14%, transparent) 0%, transparent 70%)',
          filter: 'blur(70px)',
          opacity: 0.4,
        }}
      />
    </div>
  )
}
