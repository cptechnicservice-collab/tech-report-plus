CREATE TABLE public.relatorios_salvos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome TEXT NOT NULL,
  inicio DATE NOT NULL,
  fim DATE NOT NULL,
  total_servicos NUMERIC NOT NULL DEFAULT 0,
  total_pecas NUMERIC NOT NULL DEFAULT 0,
  total_geral NUMERIC NOT NULL DEFAULT 0,
  cliente_snapshot JSONB NOT NULL,
  apontamentos_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  valores_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  pecas_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT relatorios_salvos_periodo_valido CHECK (fim >= inicio),
  CONSTRAINT relatorios_salvos_totais_validos CHECK (total_servicos >= 0 AND total_pecas >= 0 AND total_geral >= 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorios_salvos TO authenticated;
GRANT ALL ON public.relatorios_salvos TO service_role;

ALTER TABLE public.relatorios_salvos ENABLE ROW LEVEL SECURITY;

CREATE POLICY relatorios_salvos_select_own
ON public.relatorios_salvos FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY relatorios_salvos_insert_own
ON public.relatorios_salvos FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY relatorios_salvos_update_own
ON public.relatorios_salvos FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY relatorios_salvos_delete_own
ON public.relatorios_salvos FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX relatorios_salvos_user_created_idx
ON public.relatorios_salvos (user_id, created_at DESC);

CREATE INDEX relatorios_salvos_user_cliente_idx
ON public.relatorios_salvos (user_id, cliente_nome, created_at DESC);

CREATE TRIGGER relatorios_salvos_updated_at
BEFORE UPDATE ON public.relatorios_salvos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();