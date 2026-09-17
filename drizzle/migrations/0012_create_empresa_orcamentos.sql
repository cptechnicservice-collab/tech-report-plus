CREATE TABLE public.dados_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  nome_fantasia text NOT NULL DEFAULT 'CP-Technic HOMAG',
  cnpj text NOT NULL DEFAULT '46.696.388/0001-08',
  email text NOT NULL DEFAULT 'clarelcapavan@gmail.com',
  contato text NOT NULL DEFAULT 'Clarel Pavan',
  telefone text,
  logo_data_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dados_empresa TO authenticated;
GRANT ALL ON public.dados_empresa TO service_role;

ALTER TABLE public.dados_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY dados_empresa_select_own ON public.dados_empresa FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY dados_empresa_insert_own ON public.dados_empresa FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY dados_empresa_update_own ON public.dados_empresa FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY dados_empresa_delete_own ON public.dados_empresa FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER dados_empresa_updated_at BEFORE UPDATE ON public.dados_empresa FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  numero text NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_snapshot jsonb NOT NULL,
  data date NOT NULL,
  validade_dias integer NOT NULL DEFAULT 15 CHECK (validade_dias >= 0),
  desconto_tipo text NOT NULL DEFAULT 'valor' CHECK (desconto_tipo IN ('valor', 'percentual')),
  desconto_valor numeric NOT NULL DEFAULT 0 CHECK (desconto_valor >= 0),
  formas_pagamento jsonb NOT NULL DEFAULT '[]'::jsonb,
  condicoes_pagamento text,
  observacoes text,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'recusado')),
  total_produtos numeric NOT NULL DEFAULT 0 CHECK (total_produtos >= 0),
  total_servicos numeric NOT NULL DEFAULT 0 CHECK (total_servicos >= 0),
  subtotal numeric NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  total numeric NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, numero)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos TO authenticated;
GRANT ALL ON public.orcamentos TO service_role;

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY orcamentos_select_own ON public.orcamentos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY orcamentos_insert_own ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY orcamentos_update_own ON public.orcamentos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY orcamentos_delete_own ON public.orcamentos FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX orcamentos_user_data_idx ON public.orcamentos (user_id, data DESC);
CREATE INDEX orcamentos_user_status_idx ON public.orcamentos (user_id, status);
CREATE TRIGGER orcamentos_updated_at BEFORE UPDATE ON public.orcamentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.orcamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  peca_id uuid REFERENCES public.pecas(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'produto' CHECK (tipo IN ('produto', 'servico')),
  nome text NOT NULL,
  codigo text,
  quantidade numeric NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  unidade text NOT NULL DEFAULT 'un' CHECK (unidade IN ('un', 'h', 'km', 'pç', 'cj')),
  valor_unitario numeric NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  foto_data_url text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_itens TO authenticated;
GRANT ALL ON public.orcamento_itens TO service_role;

ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY orcamento_itens_select_own ON public.orcamento_itens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY orcamento_itens_insert_own ON public.orcamento_itens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY orcamento_itens_update_own ON public.orcamento_itens FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY orcamento_itens_delete_own ON public.orcamento_itens FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX orcamento_itens_orcamento_ordem_idx ON public.orcamento_itens (orcamento_id, ordem);
CREATE TRIGGER orcamento_itens_updated_at BEFORE UPDATE ON public.orcamento_itens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();