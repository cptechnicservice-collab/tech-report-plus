import { supabase } from "@/integrations/supabase/client";
import type { Json, TablesInsert } from "@/integrations/supabase/types";
import type { ApontamentoComCliente, Cliente } from "@/lib/apontamentos";
import type { AgendamentoComCliente } from "@/lib/agenda";
import type { ValorVigencia } from "@/lib/financeiro";
import type { Peca } from "@/lib/pecas";
import type { RelatorioSalvo } from "@/lib/relatorios";
import type { DadosEmpresa } from "@/lib/empresa";
import type { Orcamento, OrcamentoItem } from "@/lib/orcamentos";
import type { ApontamentoPeca } from "@/lib/apontamento-pecas";
import { assertApontamentoValid } from "@/lib/apontamento-validation";
import { database, activeUserId, CACHE_CLIENTES, CACHE_APONTAMENTOS, CACHE_APONTAMENTO_PECAS, CACHE_VALORES, CACHE_AGENDAMENTOS, CACHE_PECAS, CACHE_RELATORIOS, CACHE_EMPRESA, CACHE_ORCAMENTOS } from "./offline.storage";
import { readCached, writeCached } from "./offline.cache";
import { enqueue, requireUserId } from "./offline.queue";
import { isOffline, isNetworkError, timeoutSignal } from "./offline.utils";
type ClienteWrite = Omit<Cliente, "created_at" | "updated_at" | "user_id"> &
  Partial<Pick<Cliente, "created_at" | "updated_at" | "user_id">>;

export async function saveClienteOffline(payload: ClienteWrite) {
  const userId = await requireUserId();
  payload = { ...payload, user_id: userId };
  const now = new Date().toISOString();
  const cliente: Cliente = { created_at: now, updated_at: now, ...payload, user_id: userId };
  const cached = (await readCached<Cliente[]>(CACHE_CLIENTES)) ?? [];
  if (!isOffline()) {
    try {
      const { error } = await supabase
        .from("clientes")
        .upsert(payload, { onConflict: "id" })
        .abortSignal(timeoutSignal());
      if (error) {
        if (!isNetworkError(error)) throw error;
      } else {
        await writeCached(CACHE_CLIENTES, [
          ...cached.filter((item) => item.id !== cliente.id),
          cliente,
        ]);
        return { cliente, queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  await enqueue({ entity: "clientes", action: "upsert", recordId: cliente.id, payload, userId });
  await writeCached(CACHE_CLIENTES, [...cached.filter((item) => item.id !== cliente.id), cliente]);
  return { cliente, queued: true };
}

type ApontamentoWrite = Omit<
  ApontamentoComCliente,
  "clientes" | "created_at" | "updated_at" | "user_id"
> &
  Partial<Pick<ApontamentoComCliente, "created_at" | "updated_at" | "user_id">>;

export async function saveApontamentoOffline(payload: ApontamentoWrite) {
  assertApontamentoValid(payload);
  const userId = await requireUserId();
  payload = { ...payload, user_id: userId };
  const now = new Date().toISOString();
  const clientes = (await readCached<Cliente[]>(CACHE_CLIENTES)) ?? [];
  const record: ApontamentoComCliente = {
    created_at: now,
    updated_at: now,
    ...payload,
    user_id: userId,
    clientes: clientes.find((cliente) => cliente.id === payload.cliente_id) ?? null,
  };
  const cached = (await readCached<ApontamentoComCliente[]>(CACHE_APONTAMENTOS)) ?? [];
  const nextCache = [record, ...cached.filter((item) => item.id !== record.id)].sort((a, b) =>
    `${b.data}${b.created_at}`.localeCompare(`${a.data}${a.created_at}`),
  );

  const dbPayload: TablesInsert<"apontamentos"> = { ...payload };
  if (!isOffline()) {
    try {
      const { error } = await supabase
        .from("apontamentos")
        .upsert(dbPayload, { onConflict: "id" })
        .abortSignal(timeoutSignal());
      if (error) {
        if (!isNetworkError(error)) throw error;
      } else {
        await writeCached(CACHE_APONTAMENTOS, nextCache);
        return { record, queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  await enqueue({
    entity: "apontamentos",
    action: "upsert",
    recordId: record.id,
    payload: dbPayload,
    userId,
  });
  await writeCached(CACHE_APONTAMENTOS, nextCache);
  return { record, queued: true };
}

type ApontamentoPecaWrite = Omit<ApontamentoPeca, "created_at" | "updated_at" | "user_id">;

export async function saveApontamentoPecasOffline(
  apontamentoId: string,
  items: ApontamentoPecaWrite[],
) {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const cached = (await readCached<ApontamentoPeca[]>(CACHE_APONTAMENTO_PECAS)) ?? [];
  const previous = cached.filter((item) => item.apontamento_id === apontamentoId);
  const payloads: TablesInsert<"apontamento_pecas">[] = items.map((item) => ({
    ...item,
    apontamento_id: apontamentoId,
    user_id: userId,
  }));
  const records: ApontamentoPeca[] = items.map((item) => ({
    ...item,
    apontamento_id: apontamentoId,
    user_id: userId,
    created_at: now,
    updated_at: now,
  }));
  const nextCache = [...cached.filter((item) => item.apontamento_id !== apontamentoId), ...records];

  if (!isOffline()) {
    try {
      if (payloads.length > 0) {
        const inserted = await supabase
          .from("apontamento_pecas")
          .upsert(payloads, { onConflict: "id" })
          .abortSignal(timeoutSignal());
        if (inserted.error) throw inserted.error;
      }
      const nextIds = new Set(items.map((item) => item.id));
      for (const oldItem of previous) {
        if (nextIds.has(oldItem.id)) continue;
        const removed = await supabase
          .from("apontamento_pecas")
          .delete()
          .eq("id", oldItem.id)
          .abortSignal(timeoutSignal());
        if (removed.error) throw removed.error;
      }
      await writeCached(CACHE_APONTAMENTO_PECAS, nextCache);
      return { records, queued: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  const nextIds = new Set(items.map((item) => item.id));
  for (const oldItem of previous) {
    if (!nextIds.has(oldItem.id))
      await enqueue({
        entity: "apontamento_pecas",
        action: "delete",
        recordId: oldItem.id,
        userId,
      });
  }
  for (const item of payloads) {
    await enqueue({
      entity: "apontamento_pecas",
      action: "upsert",
      recordId: item.id ?? crypto.randomUUID(),
      payload: item,
      userId,
    });
  }
  await writeCached(CACHE_APONTAMENTO_PECAS, nextCache);
  return { records, queued: true };
}

type ValorWrite = Omit<ValorVigencia, "created_at" | "updated_at" | "user_id"> &
  Partial<Pick<ValorVigencia, "created_at" | "updated_at" | "user_id">>;

export async function saveValorOffline(payload: ValorWrite) {
  const userId = await requireUserId();
  payload = { ...payload, user_id: userId };
  const now = new Date().toISOString();
  const record: ValorVigencia = { created_at: now, updated_at: now, ...payload, user_id: userId };
  const cached = (await readCached<ValorVigencia[]>(CACHE_VALORES)) ?? [];
  const nextCache = [record, ...cached.filter((item) => item.id !== record.id)].sort((a, b) =>
    `${b.vigencia}${b.created_at}`.localeCompare(`${a.vigencia}${a.created_at}`),
  );
  const dbPayload: TablesInsert<"valores_vigencia"> = { ...payload };

  if (!isOffline()) {
    try {
      const { error } = await supabase
        .from("valores_vigencia")
        .upsert(dbPayload, { onConflict: "id" })
        .abortSignal(timeoutSignal());
      if (error) {
        if (!isNetworkError(error)) throw error;
      } else {
        await writeCached(CACHE_VALORES, nextCache);
        return { record, queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  await enqueue({
    entity: "valores_vigencia",
    action: "upsert",
    recordId: record.id,
    payload: dbPayload,
    userId,
  });
  await writeCached(CACHE_VALORES, nextCache);
  return { record, queued: true };
}

type AgendamentoWrite = Omit<
  AgendamentoComCliente,
  "clientes" | "created_at" | "updated_at" | "user_id"
> &
  Partial<Pick<AgendamentoComCliente, "created_at" | "updated_at" | "user_id">>;

export async function saveAgendamentoOffline(payload: AgendamentoWrite) {
  const userId = await requireUserId();
  const dbPayload: TablesInsert<"agendamentos"> = { ...payload, user_id: userId };
  const now = new Date().toISOString();
  const clientes = (await readCached<Cliente[]>(CACHE_CLIENTES)) ?? [];
  const record: AgendamentoComCliente = {
    created_at: now,
    updated_at: now,
    ...payload,
    user_id: userId,
    clientes: clientes.find((cliente) => cliente.id === payload.cliente_id) ?? null,
  };
  const cached = (await readCached<AgendamentoComCliente[]>(CACHE_AGENDAMENTOS)) ?? [];
  const nextCache = [record, ...cached.filter((item) => item.id !== record.id)].sort((a, b) =>
    `${a.data}${a.horario ?? "99:99"}`.localeCompare(`${b.data}${b.horario ?? "99:99"}`),
  );

  if (!isOffline()) {
    try {
      const { error } = await supabase
        .from("agendamentos")
        .upsert(dbPayload, { onConflict: "id" })
        .abortSignal(timeoutSignal());
      if (error) {
        if (!isNetworkError(error)) throw error;
      } else {
        await writeCached(CACHE_AGENDAMENTOS, nextCache);
        return { record, queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  await enqueue({
    entity: "agendamentos",
    action: "upsert",
    recordId: record.id,
    payload: dbPayload,
    userId,
  });
  await writeCached(CACHE_AGENDAMENTOS, nextCache);
  return { record, queued: true };
}

export async function deleteAgendamentoOffline(id: string) {
  const userId = await requireUserId();
  const cached = (await readCached<AgendamentoComCliente[]>(CACHE_AGENDAMENTOS)) ?? [];
  if (!isOffline()) {
    try {
      const { error } = await supabase
        .from("agendamentos")
        .delete()
        .eq("id", id)
        .abortSignal(timeoutSignal());
      if (error) {
        if (!isNetworkError(error)) throw error;
      } else {
        await writeCached(
          CACHE_AGENDAMENTOS,
          cached.filter((item) => item.id !== id),
        );
        return { queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  await enqueue({ entity: "agendamentos", action: "delete", recordId: id, userId });
  await writeCached(
    CACHE_AGENDAMENTOS,
    cached.filter((item) => item.id !== id),
  );
  return { queued: true };
}

type PecaWrite = Omit<Peca, "created_at" | "updated_at" | "user_id"> &
  Partial<Pick<Peca, "created_at" | "updated_at" | "user_id">>;

export async function savePecaOffline(payload: PecaWrite) {
  const userId = await requireUserId();
  const dbPayload: TablesInsert<"pecas"> = { ...payload, user_id: userId };
  const now = new Date().toISOString();
  const record: Peca = { created_at: now, updated_at: now, ...payload, user_id: userId };
  const cached = (await readCached<Peca[]>(CACHE_PECAS)) ?? [];
  const nextCache = [record, ...cached.filter((item) => item.id !== record.id)].sort((a, b) =>
    a.descricao.localeCompare(b.descricao, "pt-BR"),
  );

  if (!isOffline()) {
    try {
      const { error } = await supabase
        .from("pecas")
        .upsert(dbPayload, { onConflict: "id" })
        .abortSignal(timeoutSignal());
      if (error) {
        if (!isNetworkError(error)) throw error;
      } else {
        await writeCached(CACHE_PECAS, nextCache);
        return { record, queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  await enqueue({
    entity: "pecas",
    action: "upsert",
    recordId: record.id,
    payload: dbPayload,
    userId,
  });
  await writeCached(CACHE_PECAS, nextCache);
  return { record, queued: true };
}

export async function deletePecaOffline(id: string) {
  const userId = await requireUserId();
  const cached = (await readCached<Peca[]>(CACHE_PECAS)) ?? [];
  if (!isOffline()) {
    try {
      const { error } = await supabase
        .from("pecas")
        .delete()
        .eq("id", id)
        .abortSignal(timeoutSignal());
      if (error) {
        if (!isNetworkError(error)) throw error;
      } else {
        await writeCached(
          CACHE_PECAS,
          cached.filter((item) => item.id !== id),
        );
        return { queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  await enqueue({ entity: "pecas", action: "delete", recordId: id, userId });
  await writeCached(
    CACHE_PECAS,
    cached.filter((item) => item.id !== id),
  );
  return { queued: true };
}

type EmpresaWrite = Omit<DadosEmpresa, "created_at" | "updated_at" | "user_id"> &
  Partial<Pick<DadosEmpresa, "created_at" | "updated_at" | "user_id">>;

export async function saveEmpresaOffline(payload: EmpresaWrite) {
  const userId = await requireUserId();
  const dbPayload: TablesInsert<"dados_empresa"> = { ...payload, user_id: userId };
  const now = new Date().toISOString();
  const record: DadosEmpresa = {
    created_at: payload.created_at ?? now,
    updated_at: now,
    ...payload,
    user_id: userId,
  };
  if (!isOffline()) {
    try {
      const { error } = await supabase
        .from("dados_empresa")
        .upsert(dbPayload, { onConflict: "user_id" })
        .abortSignal(timeoutSignal());
      if (error) {
        if (!isNetworkError(error)) throw error;
      } else {
        await writeCached(CACHE_EMPRESA, record);
        return { record, queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  await enqueue({
    entity: "dados_empresa",
    action: "upsert",
    recordId: record.id,
    payload: dbPayload,
    userId,
  });
  await writeCached(CACHE_EMPRESA, record);
  return { record, queued: true };
}

type OrcamentoWrite = Omit<Orcamento, "created_at" | "updated_at" | "user_id" | "itens"> &
  Partial<Pick<Orcamento, "created_at" | "updated_at" | "user_id">> & {
    itens: Array<Omit<OrcamentoItem, "created_at" | "updated_at" | "user_id">>;
  };

function orcamentoPayload(payload: OrcamentoWrite, userId: string): TablesInsert<"orcamentos"> {
  return {
    id: payload.id,
    user_id: userId,
    numero: payload.numero,
    cliente_id: payload.cliente_id,
    cliente_snapshot: payload.cliente_snapshot as unknown as Json,
    data: payload.data,
    validade_dias: payload.validade_dias,
    desconto_tipo: payload.desconto_tipo,
    desconto_valor: payload.desconto_valor,
    formas_pagamento: payload.formas_pagamento as unknown as Json,
    condicoes_pagamento: payload.condicoes_pagamento,
    observacoes: payload.observacoes,
    status: payload.status,
    total_produtos: payload.total_produtos,
    total_servicos: payload.total_servicos,
    subtotal: payload.subtotal,
    total: payload.total,
  };
}

export async function saveOrcamentoOffline(payload: OrcamentoWrite) {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const dbPayload = orcamentoPayload(payload, userId);
  const itemPayloads: TablesInsert<"orcamento_itens">[] = payload.itens.map((item, index) => ({
    ...item,
    user_id: userId,
    orcamento_id: payload.id,
    ordem: index,
  }));
  const record: Orcamento = {
    ...payload,
    user_id: userId,
    created_at: payload.created_at ?? now,
    updated_at: now,
    itens: payload.itens.map((item, index) => ({
      ...item,
      user_id: userId,
      ordem: index,
      created_at: now,
      updated_at: now,
    })),
  };
  const cached = (await readCached<Orcamento[]>(CACHE_ORCAMENTOS)) ?? [];
  const nextCache = [record, ...cached.filter((item) => item.id !== record.id)].sort((a, b) =>
    `${b.data}${b.created_at}`.localeCompare(`${a.data}${a.created_at}`),
  );
  if (!isOffline()) {
    try {
      const parent = await supabase
        .from("orcamentos")
        .upsert(dbPayload, { onConflict: "id" })
        .abortSignal(timeoutSignal());
      if (parent.error) throw parent.error;
      const removed = await supabase
        .from("orcamento_itens")
        .delete()
        .eq("orcamento_id", payload.id)
        .abortSignal(timeoutSignal());
      if (removed.error) throw removed.error;
      if (itemPayloads.length > 0) {
        const inserted = await supabase
          .from("orcamento_itens")
          .upsert(itemPayloads, { onConflict: "id" })
          .abortSignal(timeoutSignal());
        if (inserted.error) throw inserted.error;
      }
      await writeCached(CACHE_ORCAMENTOS, nextCache);
      return { record, queued: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  const previous = cached.find((item) => item.id === record.id);
  const nextItemIds = new Set(itemPayloads.map((item) => item.id));
  for (const oldItem of previous?.itens ?? []) {
    if (!nextItemIds.has(oldItem.id))
      await enqueue({ entity: "orcamento_itens", action: "delete", recordId: oldItem.id, userId });
  }
  await enqueue({
    entity: "orcamentos",
    action: "upsert",
    recordId: record.id,
    payload: dbPayload,
    userId,
  });
  for (const item of itemPayloads)
    await enqueue({
      entity: "orcamento_itens",
      action: "upsert",
      recordId: item.id ?? crypto.randomUUID(),
      payload: item,
      userId,
    });
  await writeCached(CACHE_ORCAMENTOS, nextCache);
  return { record, queued: true };
}

export async function deleteOrcamentoOffline(id: string) {
  const userId = await requireUserId();
  const cached = (await readCached<Orcamento[]>(CACHE_ORCAMENTOS)) ?? [];
  if (!isOffline()) {
    try {
      const { error } = await supabase
        .from("orcamentos")
        .delete()
        .eq("id", id)
        .abortSignal(timeoutSignal());
      if (error) {
        if (!isNetworkError(error)) throw error;
      } else {
        await writeCached(
          CACHE_ORCAMENTOS,
          cached.filter((item) => item.id !== id),
        );
        return { queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  await enqueue({ entity: "orcamentos", action: "delete", recordId: id, userId });
  await writeCached(
    CACHE_ORCAMENTOS,
    cached.filter((item) => item.id !== id),
  );
  return { queued: true };
}

type RelatorioWrite = Omit<
  RelatorioSalvo,
  | "created_at"
  | "updated_at"
  | "user_id"
  | "status_relatorio"
  | "pagamento_status"
  | "valor_recebido"
  | "data_recebimento"
  | "forma_pagamento"
  | "observacao_relatorio"
  | "despesas_snapshot"
  | "total_despesas"
  | "desconto"
  | "source_orcamento_id"
  | "parcelas"
  | "data_pagamento_prevista"
> &
  Partial<
    Pick<
      RelatorioSalvo,
      | "created_at"
      | "updated_at"
      | "user_id"
      | "status_relatorio"
      | "pagamento_status"
      | "valor_recebido"
      | "data_recebimento"
      | "forma_pagamento"
      | "observacao_relatorio"
      | "despesas_snapshot"
      | "total_despesas"
      | "desconto"
      | "source_orcamento_id"
      | "parcelas"
      | "data_pagamento_prevista"
    >
  >;

function relatorioPayload(
  payload: RelatorioWrite,
  userId: string,
): TablesInsert<"relatorios_salvos"> {
  return {
    id: payload.id,
    numero_relatorio: payload.numero_relatorio,
    user_id: userId,
    cliente_id: payload.cliente_id,
    cliente_nome: payload.cliente_nome,
    inicio: payload.inicio,
    fim: payload.fim,
    total_servicos: payload.total_servicos,
    total_pecas: payload.total_pecas,
    total_geral: payload.total_geral,
    cliente_snapshot: payload.cliente_snapshot as unknown as Json,
    apontamentos_snapshot: payload.apontamentos_snapshot as unknown as Json,
    valores_snapshot: payload.valores_snapshot as unknown as Json,
    pecas_snapshot: payload.pecas_snapshot as unknown as Json,
    financeiro_snapshot: payload.financeiro_snapshot as unknown as Json,
    observacao_relatorio: payload.observacao_relatorio ?? "",
    despesas_snapshot: (payload.despesas_snapshot ?? []) as unknown as Json,
    total_despesas: payload.total_despesas ?? 0,
    desconto: payload.desconto ?? 0,
    status_relatorio: payload.status_relatorio ?? "pendente",
    pagamento_status: payload.pagamento_status ?? "pendente",
    valor_recebido: payload.valor_recebido ?? 0,
    data_recebimento: payload.data_recebimento ?? null,
    forma_pagamento: payload.forma_pagamento ?? null,
    source_orcamento_id: payload.source_orcamento_id ?? null,
    parcelas: (payload.parcelas ?? []) as unknown as Json,
    data_pagamento_prevista: payload.data_pagamento_prevista ?? null,
  };
}

export async function saveRelatorioOffline(payload: RelatorioWrite) {
  const userId = await requireUserId();
  const dbPayload = relatorioPayload(payload, userId);
  const now = new Date().toISOString();
  const record: RelatorioSalvo = {
    ...payload,
    status_relatorio: payload.status_relatorio ?? "pendente",
    pagamento_status: payload.pagamento_status ?? "pendente",
    valor_recebido: payload.valor_recebido ?? 0,
    data_recebimento: payload.data_recebimento ?? null,
    forma_pagamento: payload.forma_pagamento ?? null,
    source_orcamento_id: payload.source_orcamento_id ?? null,
    parcelas: payload.parcelas ?? [],
    data_pagamento_prevista: payload.data_pagamento_prevista ?? null,
    observacao_relatorio: payload.observacao_relatorio ?? "",
    despesas_snapshot: payload.despesas_snapshot ?? [],
    total_despesas: payload.total_despesas ?? 0,
    desconto: payload.desconto ?? 0,
    created_at: payload.created_at ?? now,
    updated_at: now,
    user_id: userId,
  };
  const cached = (await readCached<RelatorioSalvo[]>(CACHE_RELATORIOS)) ?? [];
  const nextCache = [record, ...cached.filter((item) => item.id !== record.id)].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  if (!isOffline()) {
    try {
      const { error } = await supabase
        .from("relatorios_salvos")
        .upsert(dbPayload, { onConflict: "id" })
        .abortSignal(timeoutSignal());
      if (error) {
        if (!isNetworkError(error)) throw error;
      } else {
        await writeCached(CACHE_RELATORIOS, nextCache);
        return { record, queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  await enqueue({
    entity: "relatorios_salvos",
    action: "upsert",
    recordId: record.id,
    payload: dbPayload,
    userId,
  });
  await writeCached(CACHE_RELATORIOS, nextCache);
  return { record, queued: true };
}

export async function deleteRelatorioOffline(id: string) {
  const userId = await requireUserId();
  const cached = (await readCached<RelatorioSalvo[]>(CACHE_RELATORIOS)) ?? [];
  if (!isOffline()) {
    try {
      const { error } = await supabase
        .from("relatorios_salvos")
        .delete()
        .eq("id", id)
        .abortSignal(timeoutSignal());
      if (error) {
        if (!isNetworkError(error)) throw error;
      } else {
        await writeCached(
          CACHE_RELATORIOS,
          cached.filter((item) => item.id !== id),
        );
        return { queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  await enqueue({ entity: "relatorios_salvos", action: "delete", recordId: id, userId });
  await writeCached(
    CACHE_RELATORIOS,
    cached.filter((item) => item.id !== id),
  );
  return { queued: true };
}

export async function deleteApontamentoOffline(id: string) {
  const userId = await requireUserId();
  const cached = (await readCached<ApontamentoComCliente[]>(CACHE_APONTAMENTOS)) ?? [];
  const cachedParts = (await readCached<ApontamentoPeca[]>(CACHE_APONTAMENTO_PECAS)) ?? [];
  if (!isOffline()) {
    try {
      const { error } = await supabase
        .from("apontamentos")
        .delete()
        .eq("id", id)
        .abortSignal(timeoutSignal());
      if (error) {
        if (!isNetworkError(error)) throw error;
      } else {
        await writeCached(
          CACHE_APONTAMENTOS,
          cached.filter((item) => item.id !== id),
        );
        await writeCached(
          CACHE_APONTAMENTO_PECAS,
          cachedParts.filter((item) => item.apontamento_id !== id),
        );
        return { queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  if (typeof indexedDB !== "undefined") {
    const db = await database();
    const queued = await db.getAll("queue");
    for (const item of queued) {
      if (
        item.entity === "apontamento_pecas" &&
        item.payload?.["apontamento_id"] === id &&
        item.queueId != null
      ) {
        await db.delete("queue", item.queueId);
      }
    }
  }
  await enqueue({ entity: "apontamentos", action: "delete", recordId: id, userId });
  await writeCached(
    CACHE_APONTAMENTOS,
    cached.filter((item) => item.id !== id),
  );
  await writeCached(
    CACHE_APONTAMENTO_PECAS,
    cachedParts.filter((item) => item.apontamento_id !== id),
  );
  return { queued: true };
}
