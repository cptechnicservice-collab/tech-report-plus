ALTER TABLE public.agendamentos
ADD COLUMN data_fim date;

UPDATE public.agendamentos
SET data_fim = data
WHERE data_fim IS NULL;

ALTER TABLE public.agendamentos
ADD CONSTRAINT agendamentos_periodo_valido
CHECK (data_fim IS NULL OR data_fim >= data);

CREATE INDEX agendamentos_user_periodo_idx
ON public.agendamentos (user_id, data, data_fim);