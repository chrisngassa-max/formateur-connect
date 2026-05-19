-- Migration 009 : Alignement des offres de formation et désactivation des surnuméraires
-- Désactiver les 2 offres surnuméraires
UPDATE public.formation_offers 
SET is_active = false 
WHERE code IN ('PACK_ADMIN', 'ATELIER_ORAL');

-- Mettre à jour les 4 parcours validés par le métier
UPDATE public.formation_offers 
SET 
  code = 'Socle-Francais-A0-A1',
  titre = 'Socle Français',
  description = 'Idéal pour débuter sereinement et maîtriser les bases fondamentales à l''écrit comme à l''oral.',
  duree_heures = 80,
  keywords = ARRAY['socle a1 non validé','difficulté de lecture','grand débutant','socle-francais-a0-a1']
WHERE code = 'PACK_ALPHA';

UPDATE public.formation_offers 
SET 
  code = 'Objectif-Sejour-A1-A2',
  titre = 'Objectif Séjour',
  description = 'Parfait pour sécuriser votre renouvellement ou votre première carte pluriannuelle.',
  duree_heures = 80,
  keywords = ARRAY['confusion présent passé','syntaxe fragile','a2 en cours','objectif-sejour-a1-a2']
WHERE code = 'MODULE_CARTE_SEJ';

UPDATE public.formation_offers 
SET 
  code = 'Objectif-Residence-A2-B1',
  titre = 'Objectif Résidence',
  description = 'Le parcours de franchissement de seuil le plus demandé pour valider votre intégration.',
  duree_heures = 100,
  keywords = ARRAY['manque de connecteurs','opinion peu développée','b1 fragile','objectif-residence-a2-b1']
WHERE code = 'ATELIER_RESIDENCE';

UPDATE public.formation_offers 
SET 
  code = 'Objectif-Citoyennete-B1-B2',
  titre = 'Objectif Citoyenneté',
  description = 'Une préparation avancée pour une intégration professionnelle et citoyenne totale.',
  duree_heures = 120,
  keywords = ARRAY['niveau b1 acquis','vise b2','nationalité','objectif-citoyennete-b1-b2']
WHERE code = 'PARCOURS_NATIO';
