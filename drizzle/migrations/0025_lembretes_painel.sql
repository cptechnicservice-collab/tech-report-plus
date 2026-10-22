CREATE TABLE public.lembretes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL CHECK (char_length(btrim(titulo)) BETWEEN 1 AND 300),
  data_prevista date,
  concluido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lembretes TO authenticated;
GRANT ALL ON public.lembretes TO service_role;
ALTER TABLE public.lembretes ENABLE ROW LEVEL SECURITY;
CREATE POLICY lembretes_select_own ON public.lembretes FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY lembretes_insert_own ON public.lembretes FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY lembretes_update_own ON public.lembretes FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY lembretes_delete_own ON public.lembretes FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE INDEX lembretes_user_data_idx ON public.lembretes (user_id, data_prevista, id);
CREATE TRIGGER lembretes_updated_at BEFORE UPDATE ON public.lembretes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();