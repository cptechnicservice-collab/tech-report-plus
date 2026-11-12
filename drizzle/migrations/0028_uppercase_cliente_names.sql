CREATE OR REPLACE FUNCTION public.normalize_cliente_nome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.nome := upper(NEW.nome);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.normalize_cliente_nome() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER normalize_cliente_nome_before_write
BEFORE INSERT OR UPDATE OF nome ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.normalize_cliente_nome();