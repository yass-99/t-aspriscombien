'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useWeek } from '../_lib/useWeek'
import { useProfileHeader } from '../_lib/useProfileHeader'
import { useMounted } from '../_lib/useMounted'
import { formatWeekForLLM, weekHasContent } from '../_lib/helpers'
import { groupRunsIntoSessions } from '../_lib/runs'
import { Check, Copy, Spark, X } from './icons'
import { Spinner } from './Skeleton'

type Props = {
  open: boolean
  onClose: () => void
}

// Feuille glissante (overlay, pas un écran de navigation) : aperçu du bilan
// hebdo + bouton « Copier pour mon coach ». Ne charge le détail qu'à l'ouverture.
export function WeekReportSheet({ open, onClose }: Props) {
  const mounted = useMounted()
  const [copied, setCopied] = useState(false)
  const profile = useProfileHeader()
  const { data, loading } = useWeek(open)
  // Semaine précédente : pour la variation de volume + référence par exo.
  const { data: prevData } = useWeek(open, 1)

  // Lock du scroll body tant que la feuille est ouverte.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Reset l'état « copié » à chaque ouverture (état UI transitoire).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setCopied(false)
  }, [open])

  const hasContent = weekHasContent(data)
  const text = useMemo(
    () => (data && hasContent ? formatWeekForLLM(data, profile, prevData) : ''),
    [data, hasContent, profile, prevData],
  )

  const stats = useMemo(() => {
    if (!data) return { seances: 0, volume: 0 }
    const muscu = data.seances.filter((s) => s.exos.some((e) => e.series.length > 0))
    const athle = groupRunsIntoSessions(data.runs).length
    const volume = muscu.reduce(
      (a, s) =>
        a +
        s.exos.reduce(
          (b, e) => b + e.series.reduce((c, sr) => (sr.reps == null ? c : c + sr.poids * sr.reps), 0),
          0,
        ),
      0,
    )
    return { seances: muscu.length + athle, volume }
  }, [data])

  const handleCopy = async () => {
    if (!text) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2600)
    } catch {
      /* silencieux — l'utilisateur peut sélectionner l'aperçu à la main */
    }
  }

  if (!mounted) return null

  const sheet = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--surface)',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              boxShadow: '0 0 0 1px var(--line) inset, 0 -10px 40px rgba(0,0,0,0.5)',
              paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            }}
          >
            {/* poignée */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
              <span
                aria-hidden
                style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--line)' }}
              />
            </div>

            {/* En-tête */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 18px 12px',
              }}
            >
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  background: 'var(--brand-soft)',
                  color: 'var(--brand)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Spark size={18} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    letterSpacing: -0.4,
                    color: 'var(--ink)',
                    fontFamily: 'var(--display)',
                  }}
                >
                  Ma semaine
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {loading
                    ? 'Préparation…'
                    : hasContent
                      ? `${stats.seances} séance${stats.seances > 1 ? 's' : ''}${stats.volume > 0 ? ` · ${stats.volume.toLocaleString('fr-FR')} kg` : ''}`
                      : 'Rien à analyser cette semaine'}
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Fermer"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  border: 'none',
                  cursor: 'pointer',
                  background: 'var(--surface-2)',
                  color: 'var(--muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Corps */}
            {!loading && !hasContent ? (
              <div
                style={{
                  padding: '24px 22px 28px',
                  textAlign: 'center',
                  color: 'var(--muted)',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Aucune séance enregistrée cette semaine.
                <br />
                Lance une séance, puis reviens copier ton bilan.
              </div>
            ) : (
              <>
                <div style={{ padding: '0 18px 6px', fontSize: 12, color: 'var(--subtle)' }}>
                  Aperçu du texte — déjà prêt avec la consigne pour ton coach.
                </div>
                {/* Le cadre d'aperçu est DÉJÀ là : pendant le chargement un spinner
                    l'occupe, puis le texte s'y inscrit en fondu (apparition cinématique). */}
                <div
                  className="app-scroll"
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    margin: '0 14px',
                    padding: 14,
                    minHeight: 140,
                    borderRadius: 12,
                    background: 'var(--bg)',
                    boxShadow: '0 0 0 1px var(--line) inset',
                    fontFamily: 'var(--mono)',
                    fontSize: 11.5,
                    lineHeight: 1.55,
                    color: 'var(--ink-2)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {loading ? (
                    <div
                      style={{
                        minHeight: 112,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        color: 'var(--muted)',
                        fontFamily: 'var(--font)',
                        fontSize: 13,
                      }}
                    >
                      <Spinner size={22} stroke={2.5} color="var(--brand-bright)" />
                      Préparation de ta semaine…
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {text}
                    </motion.div>
                  )}
                </div>

                <div style={{ padding: '14px 14px 4px' }}>
                  <button
                    onClick={handleCopy}
                    disabled={loading}
                    style={{
                      width: '100%',
                      height: 52,
                      appearance: 'none',
                      border: 'none',
                      borderRadius: 14,
                      cursor: loading ? 'default' : 'pointer',
                      opacity: loading ? 0.5 : 1,
                      background: copied ? 'var(--ok)' : 'var(--brand)',
                      color: copied ? 'var(--bg)' : 'var(--brand-ink)',
                      fontSize: 15,
                      fontWeight: 700,
                      fontFamily: 'var(--font)',
                      letterSpacing: -0.2,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 10px 24px -10px color-mix(in oklch, var(--brand) 55%, transparent)',
                      transition: 'background 160ms, opacity 160ms',
                    }}
                  >
                    {copied ? <Check size={18} stroke={2.6} /> : <Copy size={17} />}
                    {copied ? 'Copié — c’est prêt' : 'Copier ma semaine'}
                  </button>
                  <div
                    style={{
                      textAlign: 'center',
                      fontSize: 11,
                      color: 'var(--subtle)',
                      marginTop: 8,
                    }}
                  >
                    Colle-le ensuite à ton coach pour l’analyse.
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(sheet, document.body)
}
