ALTER TABLE public.relatorios_salvos
ADD COLUMN observacao_relatorio text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.relatorios_salvos.observacao_relatorio IS 'Observação geral opcional exibida no PDF final do relatório';