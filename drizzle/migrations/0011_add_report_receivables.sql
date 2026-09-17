ALTER TABLE public.relatorios_salvos
  ADD COLUMN pagamento_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN valor_recebido numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN data_recebimento date,
  ADD COLUMN forma_pagamento text;

ALTER TABLE public.relatorios_salvos
  ADD CONSTRAINT relatorios_salvos_pagamento_status_check
    CHECK (pagamento_status IN ('pendente', 'parcial', 'pago')),
  ADD CONSTRAINT relatorios_salvos_valor_recebido_check
    CHECK (valor_recebido >= 0),
  ADD CONSTRAINT relatorios_salvos_forma_pagamento_check
    CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('pix', 'transferencia', 'dinheiro', 'boleto', 'outro')),
  ADD CONSTRAINT relatorios_salvos_recebimento_consistente_check
    CHECK (
      (valor_recebido = 0 AND pagamento_status = 'pendente')
      OR (valor_recebido > 0 AND data_recebimento IS NOT NULL AND forma_pagamento IS NOT NULL AND pagamento_status IN ('parcial', 'pago'))
    );

CREATE INDEX relatorios_salvos_user_pagamento_status_idx
  ON public.relatorios_salvos (user_id, pagamento_status);