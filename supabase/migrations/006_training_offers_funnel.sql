-- Migration 006 : Table des offres de formation (Funnel Avancé)
CREATE TABLE IF NOT EXISTS public.formation_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  titre text NOT NULL,
  description text,
  duree_heures int,
  url_cta text,
  niveau_minimum text,  -- 'A0' | 'A1' | 'A2' | 'B1'
  niveau_maximum text,  -- 'A1' | 'A2' | 'B1' | 'B2'
  keywords text[],      -- mots-clés de lacunes déclencheurs
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Données initiales (6 offres stratégiques)
INSERT INTO public.formation_offers (code, titre, description, duree_heures, url_cta, niveau_minimum, niveau_maximum, keywords) 
VALUES
('PACK_ALPHA',       'Pack Alpha-Intégration',          'Maîtriser les bases de la lecture et des échanges de survie.',         100, '/formations/alpha-integration',          'A0', 'A1', ARRAY['socle a1 non validé','difficulté de lecture','grand débutant']),
('MODULE_CARTE_SEJ', 'Module Objectif Carte de Séjour', 'Sécuriser son niveau A2 pour la préfecture.',                           40, '/formations/objectif-carte-sejour',      'A1', 'A2', ARRAY['confusion présent passé','syntaxe fragile','a2 en cours']),
('ATELIER_RESIDENCE','Atelier Résidence & Argumentation','Savoir justifier ses choix et obtenir sa carte de 10 ans.',            20, '/formations/residence-argumentation',    'A2', 'B1', ARRAY['manque de connecteurs','opinion peu développée','b1 fragile']),
('PACK_ADMIN',       'Pack Français Administratif',     'Gérer ses dossiers CAF, mairie et préfecture en toute autonomie.',      10, '/formations/francais-administratif',     'A1', 'B1', ARRAY['lexique administratif limité','caf','mairie','préfecture']),
('ATELIER_ORAL',     'Atelier Libérer sa Parole',       'Pratique intensive de l''entretien avec un formateur en visio.',        5,  '/formations/liberer-sa-parole',          'A2', 'B1', ARRAY['transcription eo incohérente','débit haché','écrit oral']),
('PARCOURS_NATIO',   'Parcours Expert Nationalité',     'Préparation spécifique aux exigences du niveau B2 pour la nationalité.',null,'/formations/expert-nationalite-francaise','B1', 'B2', ARRAY['niveau b1 acquis','vise b2','nationalité'])
ON CONFLICT (code) DO UPDATE SET 
  titre = EXCLUDED.titre, 
  description = EXCLUDED.description, 
  keywords = EXCLUDED.keywords;

-- Liens dans les résultats (on utilise formation_offer_id)
ALTER TABLE public.placement_test_results 
  ADD COLUMN IF NOT EXISTS recommended_offer_json jsonb,
  ADD COLUMN IF NOT EXISTS profile_message text;

ALTER TABLE public.formation_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active offers"
  ON public.formation_offers FOR SELECT TO anon, authenticated
  USING (is_active = true);
