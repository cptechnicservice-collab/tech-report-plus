CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.clientes ADD COLUMN user_id uuid;
ALTER TABLE public.apontamentos ADD COLUMN user_id uuid;
ALTER TABLE public.valores_vigencia ADD COLUMN user_id uuid;

CREATE INDEX clientes_user_id_idx ON public.clientes (user_id);
CREATE INDEX apontamentos_user_id_idx ON public.apontamentos (user_id);
CREATE INDEX valores_vigencia_user_id_idx ON public.valores_vigencia (user_id);

REVOKE ALL ON public.clientes FROM anon;
REVOKE ALL ON public.apontamentos FROM anon;
REVOKE ALL ON public.valores_vigencia FROM anon;

DROP POLICY "clientes_public_all" ON public.clientes;
DROP POLICY "apontamentos_public_all" ON public.apontamentos;
DROP POLICY "valores_vigencia_public_all" ON public.valores_vigencia;

CREATE POLICY "clientes_select_own"
ON public.clientes FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "clientes_insert_own"
ON public.clientes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "clientes_update_own"
ON public.clientes FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "clientes_delete_own"
ON public.clientes FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "apontamentos_select_own"
ON public.apontamentos FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "apontamentos_insert_own"
ON public.apontamentos FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "apontamentos_update_own"
ON public.apontamentos FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "apontamentos_delete_own"
ON public.apontamentos FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "valores_vigencia_select_own"
ON public.valores_vigencia FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "valores_vigencia_insert_own"
ON public.valores_vigencia FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "valores_vigencia_update_own"
ON public.valores_vigencia FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "valores_vigencia_delete_own"
ON public.valores_vigencia FOR DELETE TO authenticated
USING (user_id = auth.uid());