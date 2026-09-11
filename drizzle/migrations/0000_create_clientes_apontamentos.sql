CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cidade text,
  cnpj text,
  contato text,
  telefone text,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes_public_all" ON public.clientes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.apontamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  maquina_servico text,
  viagem_ida_saida time,
  viagem_ida_chegada time,
  trabalho_inicio time,
  trabalho_fim time,
  intervalo_inicio time,
  intervalo_fim time,
  viagem_volta_saida time,
  viagem_volta_chegada time,
  km_inicial numeric,
  km_final numeric,
  observacoes text,
  sync_status text NOT NULL DEFAULT 'pending',
  synced_at timestamptz,
  external_row_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX apontamentos_data_idx ON public.apontamentos (data DESC);
CREATE INDEX apontamentos_cliente_idx ON public.apontamentos (cliente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.apontamentos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apontamentos TO authenticated;
GRANT ALL ON public.apontamentos TO service_role;

ALTER TABLE public.apontamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apontamentos_public_all" ON public.apontamentos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER clientes_updated_at BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER apontamentos_updated_at BEFORE UPDATE ON public.apontamentos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.clientes (nome, cidade, ativo) VALUES ('LEO MADEIRA BRASILIA', 'Brasília', true);