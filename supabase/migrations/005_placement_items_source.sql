-- Migration 005 : Traçabilité des items de test vers la banque d'exercices
ALTER TABLE public.placement_test_items
  ADD COLUMN IF NOT EXISTS source_exercise_id uuid
  REFERENCES public.exercices(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.placement_test_items.source_exercise_id
  IS 'Exercice de la banque ayant inspiré cet item. NULL si généré from scratch.';
