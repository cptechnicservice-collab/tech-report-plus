CREATE TABLE public.recebimentos_avulsos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 cliente_id uuid NOT NULL REFERENCES public.clientes(id),
 valor numeric NOT NULL CHECK (valor > 0 AND valor <> 'NaN'::numeric AND valor <> 'Infinity'::numeric),
 data_recebimento date NOT NULL DEFAULT CURRENT_DATE,
 forma_pagamento text,
 observacao text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recebimentos_avulsos TO authenticated;
GRANT ALL ON public.recebimentos_avulsos TO service_role;
ALTER TABLE public.recebimentos_avulsos ENABLE ROW LEVEL SECURITY;
CREATE POLICY recebimentos_avulsos_select_own ON public.recebimentos_avulsos FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY recebimentos_avulsos_insert_own ON public.recebimentos_avulsos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.clientes WHERE clientes.id = recebimentos_avulsos.cliente_id AND clientes.user_id = auth.uid()));
CREATE POLICY recebimentos_avulsos_update_own ON public.recebimentos_avulsos FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.clientes WHERE clientes.id = recebimentos_avulsos.cliente_id AND clientes.user_id = auth.uid()));
CREATE POLICY recebimentos_avulsos_delete_own ON public.recebimentos_avulsos FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX idx_recebimentos_avulsos_user_data ON public.recebimentos_avulsos(user_id, data_recebimento DESC, id);
CREATE TRIGGER set_recebimentos_avulsos_updated_at BEFORE UPDATE ON public.recebimentos_avulsos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();