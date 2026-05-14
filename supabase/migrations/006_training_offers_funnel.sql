-- Migration 006 : Table des offres de formation (Sales Funnel)
CREATE TABLE IF NOT EXISTS public.training_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  duration text,
  description text,
  target_profile text,
  cta_url text,
  created_at timestamptz DEFAULT now()
);

-- Insertion des offres stratégiques
INSERT INTO public.training_offers (code, title, duration, description, target_profile, cta_url)
VALUES 
  ('PACK_ALPHA', 'Pack "Alpha-Intégration"', '100h', 'Maîtriser les bases de la lecture et des échanges de survie.', 'A1 non validé / Difficulté de lecture', '/formations/alpha'),
  ('CARTE_SEJOUR_A2', 'Module "Objectif Carte de Séjour"', '40h', 'Sécuriser son niveau A2 pour la préfecture.', 'A2 en cours / Syntaxe fragile', '/formations/a2-resident'),
  ('RESIDENCE_B1', 'Atelier "Résidence & Argumentation"', '20h', 'Savoir justifier ses choix et obtenir sa carte de 10 ans.', 'B1 fragile / Manque de connecteurs', '/formations/b1-residence'),
  ('ADMIN_BOOSTER', 'Pack "Français Administratif Booster"', '10h', 'Gérer ses dossiers (CAF, Mairie) en toute autonomie.', 'Profil utilitaire / Lexique administratif', '/formations/admin'),
  ('ORAL_BOOSTER', 'Atelier "Libérer sa parole"', '5h visio', 'Pratique intensive de l''entretien avec un formateur.', 'Écrit > Oral / Débit haché', '/formations/oral-booster'),
  ('NATIO_B2', 'Parcours "Expert Nationalité Française"', 'Sur mesure', 'Préparation spécifique aux exigences du niveau B2.', 'Niveau B1 acquis, vise B2', '/formations/nationalite');

-- Ajouter le lien dans les résultats de test
ALTER TABLE public.placement_test_results
  ADD COLUMN IF NOT EXISTS recommended_offer_id uuid REFERENCES public.training_offers(id);
