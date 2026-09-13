CREATE TABLE public.pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  descricao text NOT NULL,
  codigo text,
  unidade text NOT NULL DEFAULT 'unidade',
  preco numeric NOT NULL DEFAULT 0 CHECK (preco >= 0),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pecas TO authenticated;
GRANT ALL ON public.pecas TO service_role;

ALTER TABLE public.pecas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pecas_select_own"
ON public.pecas FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "pecas_insert_own"
ON public.pecas FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "pecas_update_own"
ON public.pecas FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "pecas_delete_own"
ON public.pecas FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX pecas_user_descricao_idx ON public.pecas (user_id, descricao);
CREATE INDEX pecas_user_codigo_idx ON public.pecas (user_id, codigo);

CREATE TRIGGER pecas_updated_at
BEFORE UPDATE ON public.pecas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();