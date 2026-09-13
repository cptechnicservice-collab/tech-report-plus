CREATE TABLE public.agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  data date NOT NULL,
  horario time without time zone,
  maquina_servico text,
  observacoes text,
  concluido boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamentos TO authenticated;
GRANT ALL ON public.agendamentos TO service_role;

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agendamentos_select_own"
ON public.agendamentos FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "agendamentos_insert_own"
ON public.agendamentos FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "agendamentos_update_own"
ON public.agendamentos FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "agendamentos_delete_own"
ON public.agendamentos FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX agendamentos_user_data_idx ON public.agendamentos (user_id, data, horario);
CREATE INDEX agendamentos_cliente_idx ON public.agendamentos (cliente_id);

CREATE TRIGGER agendamentos_updated_at
BEFORE UPDATE ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();