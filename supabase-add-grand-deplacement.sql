-- À exécuter dans Supabase → SQL Editor (une fois)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS grand_deplacement boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employees.grand_deplacement IS 'Si true : repas visibles mais non comptés dans les totaux';
