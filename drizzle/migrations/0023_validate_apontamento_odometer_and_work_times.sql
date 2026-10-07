ALTER TABLE public.apontamentos
  ADD CONSTRAINT apontamentos_odometer_order
  CHECK (km_inicial IS NULL OR km_final IS NULL OR km_final >= km_inicial) NOT VALID,
  ADD CONSTRAINT apontamentos_distinct_work_times
  CHECK (
    trabalho_inicio IS NULL OR trabalho_fim IS NULL
    OR EXTRACT(HOUR FROM trabalho_inicio) <> EXTRACT(HOUR FROM trabalho_fim)
    OR EXTRACT(MINUTE FROM trabalho_inicio) <> EXTRACT(MINUTE FROM trabalho_fim)
  ) NOT VALID;
COMMENT ON CONSTRAINT apontamentos_odometer_order ON public.apontamentos IS 'Validate new writes without modifying existing records: final odometer must not precede initial odometer.';
COMMENT ON CONSTRAINT apontamentos_distinct_work_times ON public.apontamentos IS 'Validate new writes without modifying existing records: filled work times must differ at minute precision; midnight rollover remains supported.';