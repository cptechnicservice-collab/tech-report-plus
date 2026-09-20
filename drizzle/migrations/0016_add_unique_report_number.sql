ALTER TABLE public.relatorios_salvos
ADD COLUMN numero_relatorio TEXT;

UPDATE public.relatorios_salvos
SET numero_relatorio = 'RT-' || to_char(created_at, 'YYYY') || '-' || upper(substr(replace(id::text, '-', ''), 1, 12))
WHERE numero_relatorio IS NULL;

CREATE UNIQUE INDEX relatorios_salvos_numero_relatorio_unique_idx
ON public.relatorios_salvos (numero_relatorio)
WHERE numero_relatorio IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_relatorio_numero()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.numero_relatorio IS NULL OR btrim(NEW.numero_relatorio) = '' THEN
    NEW.numero_relatorio := 'RT-' || to_char(COALESCE(NEW.created_at, now()), 'YYYY') || '-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 12));
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_relatorio_numero() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_relatorio_numero() TO service_role;

CREATE TRIGGER relatorios_salvos_numero
BEFORE INSERT ON public.relatorios_salvos
FOR EACH ROW EXECUTE FUNCTION public.set_relatorio_numero();