ALTER TABLE public.relatorios_salvos
ADD COLUMN financeiro_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;