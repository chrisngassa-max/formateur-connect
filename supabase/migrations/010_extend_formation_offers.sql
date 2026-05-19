-- Migration 010 : Extension de formation_offers avec les attributs commerciaux et d'affichage

-- 1. Ajout des colonnes
ALTER TABLE public.formation_offers 
  ADD COLUMN IF NOT EXISTS public_price_eur integer,
  ADD COLUMN IF NOT EXISTS financed_reference_price_eur integer,
  ADD COLUMN IF NOT EXISTS monthly_installment_eur integer,
  ADD COLUMN IF NOT EXISTS sessions integer,
  ADD COLUMN IF NOT EXISTS is_most_requested boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS exam_target text,
  ADD COLUMN IF NOT EXISTS reassurance text,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- 2. Peuplement des attributs pour les 4 parcours actifs
UPDATE public.formation_offers 
SET 
  public_price_eur = 2400,
  financed_reference_price_eur = 1500,
  monthly_installment_eur = 800,
  sessions = 40,
  is_most_requested = false,
  exam_target = 'Validation des compétences fondamentales',
  reassurance = '1 formateur référent · 6 élèves max · Paiement x3',
  sort_order = 10
WHERE code = 'Socle-Francais-A0-A1';

UPDATE public.formation_offers 
SET 
  public_price_eur = 2800,
  financed_reference_price_eur = 1800,
  monthly_installment_eur = 933,
  sessions = 40,
  is_most_requested = false,
  exam_target = 'DELF A2 / TEF Carte de Résident',
  reassurance = '1 formateur référent · 6 élèves max · Paiement x3',
  sort_order = 20
WHERE code = 'Objectif-Sejour-A1-A2';

UPDATE public.formation_offers 
SET 
  public_price_eur = 3500,
  financed_reference_price_eur = 2200,
  monthly_installment_eur = 1166,
  sessions = 50,
  is_most_requested = true,
  exam_target = 'TCF IRN / DELF B1',
  reassurance = '1 formateur référent · 6 élèves max · Paiement x3',
  sort_order = 30
WHERE code = 'Objectif-Residence-A2-B1';

UPDATE public.formation_offers 
SET 
  public_price_eur = 4800,
  financed_reference_price_eur = 2900,
  monthly_installment_eur = 1600,
  sessions = 60,
  is_most_requested = false,
  exam_target = 'DELF B2 / TCF Tout Public',
  reassurance = '1 formateur référent · 6 élèves max · Paiement x3',
  sort_order = 40
WHERE code = 'Objectif-Citoyennete-B1-B2';
