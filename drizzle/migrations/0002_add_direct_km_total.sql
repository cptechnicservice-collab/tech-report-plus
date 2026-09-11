ALTER TABLE public.apontamentos
ADD COLUMN km_total numeric;

ALTER TABLE public.apontamentos
ADD CONSTRAINT apontamentos_km_total_nonnegative
CHECK (km_total IS NULL OR km_total >= 0);