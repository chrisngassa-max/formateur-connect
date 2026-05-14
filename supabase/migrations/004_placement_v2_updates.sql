-- Migration pour le système de test de positionnement Expert V2
-- Ajout des colonnes de pondération et de support audio/v2

-- 1. Mise à jour des items de test
ALTER TABLE public.placement_test_items 
ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- 2. Mise à jour des tentatives (pour stocker les enregistrements oraux)
ALTER TABLE public.placement_test_answers
ADD COLUMN IF NOT EXISTS audio_response_url TEXT,
ADD COLUMN IF NOT EXISTS transcription TEXT;

-- 3. Mise à jour des résultats (bilan détaillé)
ALTER TABLE public.placement_test_results
ADD COLUMN IF NOT EXISTS confidence_level TEXT,
ADD COLUMN IF NOT EXISTS co_details JSONB,
ADD COLUMN IF NOT EXISTS ce_details JSONB,
ADD COLUMN IF NOT EXISTS ee_details JSONB,
ADD COLUMN IF NOT EXISTS eo_details JSONB;

-- 4. Ajout d'une variante au test
ALTER TABLE public.placement_tests
ADD COLUMN IF NOT EXISTS variant_name TEXT DEFAULT 'Standard',
ADD COLUMN IF NOT EXISTS is_adaptive BOOLEAN DEFAULT false;

-- Commentaire de suivi
COMMENT ON COLUMN public.placement_test_items.weight IS 'Poids de la question (5 pour A1, 10 pour A2, 15 pour B1, 20 pour B2)';
COMMENT ON COLUMN public.placement_test_results.confidence_level IS 'Indice de confiance de l évaluation automatique (Faible, Moyenne, Forte)';
