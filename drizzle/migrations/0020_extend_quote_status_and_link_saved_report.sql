ALTER TABLE public.orcamentos
  DROP CONSTRAINT orcamentos_status_check;

ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_status_check
  CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'recusado', 'aguardando_confirmacao', 'concluido'));

ALTER TABLE public.relatorios_salvos
  ADD COLUMN source_orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX relatorios_salvos_user_source_orcamento_unique_idx
  ON public.relatorios_salvos (user_id, source_orcamento_id)
  WHERE source_orcamento_id IS NOT NULL;

COMMENT ON COLUMN public.relatorios_salvos.source_orcamento_id IS 'Orçamento de origem quando o relatório final foi criado diretamente a partir de um orçamento.';