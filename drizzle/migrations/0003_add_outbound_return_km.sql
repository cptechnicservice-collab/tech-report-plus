ALTER TABLE public.apontamentos
  ADD COLUMN km_ida numeric,
  ADD COLUMN km_volta numeric;

UPDATE public.apontamentos
SET km_ida = CASE
  WHEN km_total IS NOT NULL THEN km_total
  WHEN km_inicial IS NOT NULL AND km_final IS NOT NULL AND km_final >= km_inicial THEN km_final - km_inicial
  ELSE NULL
END
WHERE km_ida IS NULL;

ALTER TABLE public.apontamentos
  ADD CONSTRAINT apontamentos_km_ida_nonnegative CHECK (km_ida IS NULL OR km_ida >= 0),
  ADD CONSTRAINT apontamentos_km_volta_nonnegative CHECK (km_volta IS NULL OR km_volta >= 0);