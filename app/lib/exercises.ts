import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Résout un nom d'exercice → `exercises.id` (nouvelle architecture post-migration :
 * `exos.exercise_id` NOT NULL pointe vers le catalogue `exercises`, qui porte
 * désormais `nom`, `is_bodyweight`, `is_unilateral`).
 *
 * Stratégie :
 *  1. On cherche un exercice existant visible par l'utilisateur — soit global
 *     (`is_global = true`), soit créé par lui (`created_by = userId`) — par nom
 *     (match exact, insensible à la casse via `ilike`).
 *  2. Trouvé → on réutilise son id (on ne touche pas à ses flags : un exo global
 *     fait foi).
 *  3. Absent → on crée un exercice perso (`is_global = false`, `created_by`) en
 *     reportant les flags PDC / unilatéral saisis.
 *
 * Renvoie `null` en cas d'échec (l'appelant décide de l'erreur HTTP).
 */
export async function resolveExerciseId(
  supabase: SupabaseClient,
  userId: string,
  nom: string,
  isBodyweight = false,
  isUnilateral = false,
): Promise<number | null> {
  const trimmed = nom.trim()
  if (!trimmed) return null

  // 1) Exercice déjà au catalogue (global ou perso) ?
  const { data: existing } = await supabase
    .from('exercises')
    .select('id')
    .or(`is_global.eq.true,created_by.eq.${userId}`)
    .ilike('nom', trimmed)
    .limit(1)
    .maybeSingle()

  if (existing?.id != null) return existing.id as number

  // 2) Sinon, création d'un exercice perso.
  const { data: created, error } = await supabase
    .from('exercises')
    .insert({
      nom: trimmed,
      is_bodyweight: isBodyweight,
      is_unilateral: isUnilateral,
      is_global: false,
      created_by: userId,
    })
    .select('id')
    .single()

  if (error || !created) return null
  return created.id as number
}
