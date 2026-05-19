-- Migration 007 : Ajout des flags qualitatifs au résultat (algorithme 10 commandements)
ALTER TABLE public.placement_test_results
  ADD COLUMN IF NOT EXISTS flags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reliability_by_level jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS time_metrics jsonb DEFAULT '{}';

COMMENT ON COLUMN public.placement_test_results.flags IS
  'Flags qualitatifs émis par l''algorithme 10 commandements : FIABILITE_FAIBLE_<N>, PROFIL_INCOHERENT, FATIGUE_DETECTEE, ALERTE_VITESSE_INCOHERENTE, PROFIL_ASYMETRIQUE, SOCLE_VALIDE_PAR_PREUVE_<N>';

COMMENT ON COLUMN public.placement_test_results.reliability_by_level IS
  'Fiabilité finale par niveau {A1:0.0..1.0, A2:..., B1:..., B2:...}';

COMMENT ON COLUMN public.placement_test_results.time_metrics IS
  'Métriques temporelles : medians_per_level, fatigue_by_third, total_active_time_ms';
