'use client'

import { useMemo } from 'react'
import { useProfile } from './useProfile'
import { useBodyweight } from './useBodyweight'
import { ageFromBirthDate } from './profile'
import type { ProfileHeader } from './helpers'

// Source unique de vérité pour le header `Profil : …` injecté en tête des
// exports texte (LLM). Combine profil statique + dernière pesée connue.
// Voir formatProfileLine() dans helpers.ts pour le rendu.
export function useProfileHeader(): ProfileHeader {
  const { profile } = useProfile()
  const { current: currentBodyweight } = useBodyweight()
  return useMemo<ProfileHeader>(
    () => ({
      sexe: profile?.sexe ?? null,
      ageAnnees: ageFromBirthDate(profile?.birthDate),
      tailleCm: profile?.tailleCm ?? null,
      poidsKg: currentBodyweight,
    }),
    [profile, currentBodyweight],
  )
}
