-- Amplitude de mouvement (ROM) par série + supersets (exos alternés).
-- À exécuter dans l'éditeur SQL Supabase (ou via `supabase db push`).

-- M1 — amplitude par série. NULL = amplitude complète (rétrocompat des lignes
-- existantes). On ne stocke JAMAIS 'complete' : l'absence de valeur la dénote,
-- d'où le CHECK à 2 valeurs seulement (export LLM épuré, cf. helpers.ts).
ALTER TABLE public.series
  ADD COLUMN IF NOT EXISTS amplitude text
  CHECK (amplitude IN ('90', 'partielle'));

-- M2 — superset : groupe d'exos alternés au sein d'une séance.
-- NULL = exo solo ; même valeur (1, 2, …) = même superset ; l'ordre intra-groupe
-- reste l'ordre d'insertion des exos (le schéma n'a pas de colonne d'ordre).
ALTER TABLE public.exos
  ADD COLUMN IF NOT EXISTS superset_group smallint;
