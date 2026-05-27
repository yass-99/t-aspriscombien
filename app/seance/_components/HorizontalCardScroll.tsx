'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'

type Slide = {
  id: string
  label: string
  content: ReactNode
}

const HINT_STORAGE_KEY = 'tpc.hscroll.hinted'

export function HorizontalCardScroll({ slides }: { slides: Slide[] }) {
  const reduced = useReducedMotion()
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const [active, setActive] = useState(0)

  // IntersectionObserver pour synchroniser les dots avec le scroll.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const observer = new IntersectionObserver(
      (entries) => {
        // L'entrée la plus visible gagne.
        let bestIdx = active
        let bestRatio = 0
        for (const entry of entries) {
          const idx = slideRefs.current.indexOf(entry.target as HTMLDivElement)
          if (idx === -1) continue
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio
            bestIdx = idx
          }
        }
        if (bestRatio > 0.5 && bestIdx !== active) {
          setActive(bestIdx)
        }
      },
      { root: scroller, threshold: [0.5, 0.75, 0.99] },
    )

    for (const ref of slideRefs.current) {
      if (ref) observer.observe(ref)
    }
    return () => observer.disconnect()
  }, [active, slides.length])

  // Hint au premier affichage : petite oscillation pour signaler le swipe.
  useEffect(() => {
    if (reduced) return
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(HINT_STORAGE_KEY) === '1') return
    if (slides.length < 2) return

    const scroller = scrollerRef.current
    if (!scroller) return

    const w = scroller.clientWidth
    const peek = Math.round(w * 0.08)
    const id = window.setTimeout(() => {
      scroller.scrollTo({ left: peek, behavior: 'smooth' })
      window.setTimeout(() => {
        scroller.scrollTo({ left: 0, behavior: 'smooth' })
        window.localStorage.setItem(HINT_STORAGE_KEY, '1')
      }, 420)
    }, 500)
    return () => window.clearTimeout(id)
  }, [reduced, slides.length])

  const goTo = (idx: number) => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const w = scroller.clientWidth
    scroller.scrollTo({ left: idx * w, behavior: reduced ? 'auto' : 'smooth' })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      goTo(Math.min(slides.length - 1, active + 1))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goTo(Math.max(0, active - 1))
    }
  }

  return (
    <div>
      <div
        ref={scrollerRef}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="region"
        aria-label="Carrousel de visualisations"
        aria-roledescription="carrousel"
        style={{
          display: 'grid',
          gridAutoFlow: 'column',
          gridAutoColumns: '100%',
          gap: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          touchAction: 'pan-x pan-y',
          overscrollBehaviorX: 'contain',
          outline: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
        className="app-scroll"
      >
        {slides.map((s, i) => (
          <div
            key={s.id}
            ref={(el) => {
              slideRefs.current[i] = el
            }}
            role="group"
            aria-roledescription="slide"
            aria-label={`${s.label} (${i + 1} sur ${slides.length})`}
            aria-hidden={active !== i}
            style={{
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
              minWidth: 0,
            }}
          >
            {s.content}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div
          role="tablist"
          aria-label="Pagination"
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 6,
            marginTop: 10,
          }}
        >
          {slides.map((s, i) => {
            const isActive = i === active
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`hscroll-${s.id}`}
                aria-label={`Aller à : ${s.label}`}
                onClick={() => goTo(i)}
                style={{
                  height: 6,
                  width: isActive ? 22 : 6,
                  padding: 0,
                  border: 'none',
                  borderRadius: 3,
                  background: isActive ? 'var(--accent)' : 'var(--line)',
                  cursor: 'pointer',
                  transition: 'all 240ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
