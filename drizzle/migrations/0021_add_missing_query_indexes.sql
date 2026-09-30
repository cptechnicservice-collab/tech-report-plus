CREATE INDEX IF NOT EXISTS idx_apontamentos_user_data
ON public.apontamentos (user_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_apontamento_pecas_apontamento
ON public.apontamento_pecas (apontamento_id);

CREATE INDEX IF NOT EXISTS idx_clientes_user_nome
ON public.clientes (user_id, nome);

CREATE INDEX IF NOT EXISTS idx_valores_user_vigencia
ON public.valores_vigencia (user_id, vigencia DESC);