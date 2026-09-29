ALTER TABLE public.relatorios_salvos
ADD COLUMN status_relatorio text NOT NULL DEFAULT 'pendente';

ALTER TABLE public.relatorios_salvos
ADD CONSTRAINT relatorios_salvos_status_relatorio_check
CHECK (status_relatorio IN ('pendente', 'aguardando_pagamento', 'concluido'));

CREATE INDEX relatorios_salvos_user_status_relatorio_idx
ON public.relatorios_salvos (user_id, status_relatorio, created_at DESC);