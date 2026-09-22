ALTER TABLE public.relatorios_salvos
ADD COLUMN desconto NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.relatorios_salvos
ADD CONSTRAINT relatorios_salvos_desconto_nonnegative CHECK (desconto >= 0);