ALTER TABLE public.pecas
ADD COLUMN foto_data_url text;

COMMENT ON COLUMN public.pecas.foto_data_url IS 'Foto opcional da peça, reduzida no dispositivo para uso online e offline.';