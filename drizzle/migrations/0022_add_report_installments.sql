ALTER TABLE public.relatorios_salvos ADD COLUMN IF NOT EXISTS parcelas jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.relatorios_salvos ADD COLUMN IF NOT EXISTS data_pagamento_prevista date;
ALTER TABLE public.relatorios_salvos ADD CONSTRAINT relatorios_salvos_parcelas_array CHECK (jsonb_typeof(parcelas) = 'array');