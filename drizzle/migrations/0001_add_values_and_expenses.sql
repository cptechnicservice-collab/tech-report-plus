ALTER TABLE public.apontamentos
  ADD COLUMN diaria_tipo text NOT NULL DEFAULT 'nenhuma',
  ADD COLUMN pedagio numeric(12,2),
  ADD COLUMN outras_despesas numeric(12,2),
  ADD COLUMN outras_despesas_descricao text;

ALTER TABLE public.apontamentos
  ADD CONSTRAINT apontamentos_diaria_tipo_check
  CHECK (diaria_tipo IN ('nenhuma', 'meia', 'inteira'));

ALTER TABLE public.apontamentos
  ADD CONSTRAINT apontamentos_pedagio_nonnegative_check
  CHECK (pedagio IS NULL OR pedagio >= 0);

ALTER TABLE public.apontamentos
  ADD CONSTRAINT apontamentos_outras_despesas_nonnegative_check
  CHECK (outras_despesas IS NULL OR outras_despesas >= 0);

CREATE TABLE public.valores_vigencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vigencia date NOT NULL,
  valor_hora_trabalhada numeric(12,2) NOT NULL DEFAULT 0,
  valor_hora_viagem numeric(12,2) NOT NULL DEFAULT 0,
  valor_km numeric(12,2) NOT NULL DEFAULT 0,
  valor_diaria_inteira numeric(12,2) NOT NULL DEFAULT 0,
  valor_meia_diaria numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT valores_vigencia_nonnegative_check CHECK (
    valor_hora_trabalhada >= 0 AND
    valor_hora_viagem >= 0 AND
    valor_km >= 0 AND
    valor_diaria_inteira >= 0 AND
    valor_meia_diaria >= 0
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.valores_vigencia TO anon, authenticated;
GRANT ALL ON public.valores_vigencia TO service_role;

ALTER TABLE public.valores_vigencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY valores_vigencia_public_all
ON public.valores_vigencia
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE INDEX valores_vigencia_vigencia_idx
ON public.valores_vigencia (vigencia DESC, created_at DESC);

CREATE TRIGGER valores_vigencia_updated_at
BEFORE UPDATE ON public.valores_vigencia
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();