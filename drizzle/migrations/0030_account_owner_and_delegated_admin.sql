CREATE TABLE public.app_owner (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_owner TO authenticated;
GRANT ALL ON public.app_owner TO service_role;
ALTER TABLE public.app_owner ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read_self ON public.app_owner FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Additive backfill: preserve the existing administrator as owner, without fixed IDs.
INSERT INTO public.app_owner (user_id)
SELECT r.user_id FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id
WHERE r.role = 'admin' ORDER BY u.created_at, r.user_id LIMIT 1;

CREATE FUNCTION public.account_role_for(target_user_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.app_owner WHERE user_id = target_user_id) THEN 'owner'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = target_user_id AND role = 'admin') THEN 'admin'
    ELSE 'technician' END;
$$;
REVOKE ALL ON FUNCTION public.account_role_for(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_access_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.account_role_for(auth.uid()) = 'owner' OR (
      public.account_role_for(auth.uid()) = 'admin' AND EXISTS (
        SELECT 1 FROM public.app_access WHERE user_id = auth.uid() AND status = 'approved'
      )
    )
  );
$$;
REVOKE ALL ON FUNCTION public.is_access_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_access_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_app_access() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.account_role_for(auth.uid()) = 'owner' OR EXISTS (
      SELECT 1 FROM public.app_access WHERE user_id = auth.uid() AND status = 'approved'
    )
  );
$$;
REVOKE ALL ON FUNCTION public.has_app_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_app_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_app_access() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller uuid := auth.uid(); account_role text;
BEGIN
  IF caller IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = caller) THEN
    RAISE EXCEPTION 'Entre na sua conta para continuar.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_owner) THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(112933, 1);
    IF NOT EXISTS (SELECT 1 FROM public.app_owner) THEN
      INSERT INTO public.app_owner(user_id) VALUES (caller) ON CONFLICT (singleton) DO NOTHING;
    END IF;
  END IF;
  account_role := public.account_role_for(caller);
  RETURN jsonb_build_object(
    'role', account_role, 'admin', public.is_access_admin(),
    'status', CASE WHEN account_role = 'owner' THEN 'approved'
      ELSE COALESCE((SELECT status FROM public.app_access WHERE user_id = caller), 'pending') END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_app_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_app_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_app_users() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_access_admin() THEN
    RAISE EXCEPTION 'Você não tem permissão para gerenciar contas.' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', u.id, 'email', u.email, 'created_at', u.created_at,
    'role', public.account_role_for(u.id),
    'status', CASE WHEN public.account_role_for(u.id) = 'owner' THEN 'approved'
      ELSE COALESCE(a.status, 'pending') END
  ) ORDER BY u.created_at DESC, u.id), '[]'::jsonb)
  FROM auth.users u LEFT JOIN public.app_access a ON a.user_id = u.id);
END;
$$;
REVOKE ALL ON FUNCTION public.list_app_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_app_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_app_access(target_user_id uuid, new_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller_role text; target_role text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(112933, 1);
  IF NOT public.is_access_admin() THEN
    RAISE EXCEPTION 'Você não tem permissão para gerenciar contas.' USING ERRCODE = '42501';
  END IF;
  IF new_status IS NULL OR new_status NOT IN ('approved', 'blocked') THEN
    RAISE EXCEPTION 'Situação inválida.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Conta não encontrada.' USING ERRCODE = '22023';
  END IF;
  caller_role := public.account_role_for(auth.uid());
  target_role := public.account_role_for(target_user_id);
  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'O proprietário não pode ser bloqueado nem ter seu acesso alterado.' USING ERRCODE = '42501';
  END IF;
  IF caller_role = 'admin' AND target_role <> 'technician' THEN
    RAISE EXCEPTION 'Admins só podem aprovar ou bloquear técnicos.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.app_access(user_id, status, updated_by)
  VALUES(target_user_id, new_status, auth.uid())
  ON CONFLICT(user_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now(), updated_by = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.set_app_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_app_access(uuid, text) TO authenticated;

CREATE FUNCTION public.set_account_role(target_user_id uuid, new_role text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(112933, 1);
  IF auth.uid() IS NULL OR public.account_role_for(auth.uid()) <> 'owner' THEN
    RAISE EXCEPTION 'Somente o proprietário pode alterar papéis.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Conta não encontrada.' USING ERRCODE = '22023';
  END IF;
  IF public.account_role_for(target_user_id) = 'owner' THEN
    RAISE EXCEPTION 'O proprietário não pode ser rebaixado.' USING ERRCODE = '42501';
  END IF;
  IF new_role IS NULL OR new_role NOT IN ('admin', 'technician') THEN
    RAISE EXCEPTION 'Papel inválido.' USING ERRCODE = '22023';
  END IF;
  IF new_role = 'admin' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES(target_user_id, 'admin') ON CONFLICT(user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = target_user_id AND role = 'admin';
    INSERT INTO public.user_roles(user_id, role) VALUES(target_user_id, 'user') ON CONFLICT(user_id, role) DO NOTHING;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_account_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_account_role(uuid, text) TO authenticated;
COMMENT ON TABLE public.app_owner IS 'Singleton owner role. Authenticated clients can only read their own ownership; owner assignment is performed atomically by get_app_access. Existing per-user data policies are unchanged.';