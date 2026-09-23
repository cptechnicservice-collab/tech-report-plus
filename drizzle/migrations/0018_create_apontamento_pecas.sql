CREATE TABLE public.apontamento_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  apontamento_id uuid NOT NULL REFERENCES public.apontamentos(id) ON DELETE CASCADE,
  peca_id uuid REFERENCES public.pecas(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  codigo text,
  unidade text NOT NULL DEFAULT 'unidade',
  valor_unitario numeric NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  quantidade numeric NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  foto_data_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.apontamento_pecas TO authenticated;
GRANT ALL ON public.apontamento_pecas TO service_role;

ALTER TABLE public.apontamento_pecas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apontamento_pecas_select_own"
ON public.apontamento_pecas FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "apontamento_pecas_insert_own"
ON public.apontamento_pecas FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.apontamentos
    WHERE apontamentos.id = apontamento_id
      AND apontamentos.user_id = auth.uid()
  )
);

CREATE POLICY "apontamento_pecas_update_own"
ON public.apontamento_pecas FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.apontamentos
    WHERE apontamentos.id = apontamento_id
      AND apontamentos.user_id = auth.uid()
  )
);

CREATE POLICY "apontamento_pecas_delete_own"
ON public.apontamento_pecas FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX apontamento_pecas_user_apontamento_idx
ON public.apontamento_pecas (user_id, apontamento_id);

CREATE INDEX apontamento_pecas_peca_idx
ON public.apontamento_pecas (peca_id);

CREATE TRIGGER apontamento_pecas_updated_at
BEFORE UPDATE ON public.apontamento_pecas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();