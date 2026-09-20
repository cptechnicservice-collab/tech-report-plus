ALTER TABLE public.relatorios_salvos
  ADD COLUMN despesas_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN total_despesas numeric NOT NULL DEFAULT 0;

ALTER TABLE public.relatorios_salvos
  ADD CONSTRAINT relatorios_salvos_total_despesas_valido CHECK (total_despesas >= 0);

COMMENT ON COLUMN public.relatorios_salvos.despesas_snapshot IS 'Despesas adicionais do relatório, com descrição e valor';
COMMENT ON COLUMN public.relatorios_salvos.total_despesas IS 'Soma das despesas adicionais incluídas no relatório';