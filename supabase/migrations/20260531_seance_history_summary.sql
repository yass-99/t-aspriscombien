-- Résumé d'historique des séances calculé côté Postgres (count + sum), pour éviter
-- de télécharger toutes les séries de 500 séances juste pour 3 agrégats par carte.
-- À exécuter dans l'éditeur SQL Supabase (ou via `supabase db push`).

-- SECURITY INVOKER (par défaut) : la fonction s'exécute sous le rôle de l'appelant,
-- donc les RLS policies de seances/exos/series s'appliquent telles quelles — on ne
-- contourne PAS la sécurité, pas besoin de filtrer user_id manuellement.
--
-- id casté en text : seances.id est un bigint ; le client le traite déjà comme
-- string et /api/seances/[id] fait .eq('id', id) (Postgres coerce le paramètre).
--
-- coalesce(poids,0) : pour les exos au poids du corps, series.poids (= lest) peut
-- être NULL. On reproduit l'ancien calcul JS où `null * reps` valait 0.
CREATE OR REPLACE FUNCTION public.seance_history_summary()
RETURNS TABLE (
  id           text,
  date         date,
  type         text,
  exos_count   integer,
  series_count integer,
  volume       numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.id::text                                              AS id,
    s.date,
    s.type,
    count(DISTINCT e.id)::int                                AS exos_count,
    count(sr.id)::int                                        AS series_count,
    coalesce(sum(coalesce(sr.poids, 0) * sr.reps), 0)::numeric AS volume
  FROM seances s
  LEFT JOIN exos e    ON e.seance_id = s.id
  LEFT JOIN series sr ON sr.exo_id   = e.id
  GROUP BY s.id, s.date, s.type
  ORDER BY s.date DESC
  LIMIT 500;
$$;

-- Droits d'exécution explicites : seul un utilisateur authentifié appelle la RPC
-- (la RLS le filtre déjà par user_id). On retire anon par principe.
GRANT EXECUTE ON FUNCTION public.seance_history_summary() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.seance_history_summary() FROM anon;

-- Index sur les FK de jointure : sans eux, le GROUP BY fait des seq scans.
-- IF NOT EXISTS = idempotent (ne touche rien s'ils existent déjà).
CREATE INDEX IF NOT EXISTS idx_exos_seance_id ON public.exos (seance_id);
CREATE INDEX IF NOT EXISTS idx_series_exo_id  ON public.series (exo_id);
