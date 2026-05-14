-- Migration 004 : Ajout de is_active et test_version sur placement_tests
-- is_active : un seul test actif à la fois (le site internet consomme toujours ce test)
-- test_version : incrémenté à chaque nouvelle publication pour traçabilité

ALTER TABLE public.placement_tests
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_version int DEFAULT 1;

-- Index pour accélérer la recherche du test actif
CREATE INDEX IF NOT EXISTS idx_placement_tests_active
  ON public.placement_tests (is_active, status)
  WHERE is_active = true AND status = 'published';

-- Contrainte : un seul test actif à la fois (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_placement_tests_one_active
  ON public.placement_tests (is_active)
  WHERE is_active = true;

-- Mise à jour de la politique RLS publique pour exiger is_active = true
DROP POLICY IF EXISTS "Anyone can view published tests via token" ON public.placement_tests;

CREATE POLICY "Anyone can view active published test" ON public.placement_tests
  FOR SELECT USING (status = 'published' AND is_active = true);

CREATE POLICY "Anyone can view test by token" ON public.placement_tests
  FOR SELECT USING (play_token IS NOT NULL AND status = 'published');
