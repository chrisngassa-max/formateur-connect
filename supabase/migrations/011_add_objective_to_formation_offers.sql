-- Migration 011 : Ajout de la colonne objective à formation_offers

-- 1. Ajout de la colonne
ALTER TABLE public.formation_offers 
  ADD COLUMN IF NOT EXISTS objective text;

-- 2. Peuplement
UPDATE public.formation_offers 
SET objective = 'Acquérir les bases indispensables de la langue française pour le quotidien.'
WHERE code = 'Socle-Francais-A0-A1';

UPDATE public.formation_offers 
SET objective = 'Valider le niveau requis pour votre carte de séjour pluriannuelle ou de résident.'
WHERE code = 'Objectif-Sejour-A1-A2';

UPDATE public.formation_offers 
SET objective = 'Atteindre le niveau B1 exigé pour la carte de résident de 10 ans et la naturalisation.'
WHERE code = 'Objectif-Residence-A2-B1';

UPDATE public.formation_offers 
SET objective = 'Assurer une expression fluide et une aisance parfaite pour sécuriser votre projet.'
WHERE code = 'Objectif-Citoyennete-B1-B2';
