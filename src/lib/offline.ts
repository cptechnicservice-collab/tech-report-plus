import { openDB, type DBSchema } from "idb";
import type { PersistedClient } from "@tanstack/react-query-persist-client";

import { supabase } from "@/integrations/supabase/client";
import type { Json, TablesInsert } from "@/integrations/supabase/types";
import type { ApontamentoComCliente, Cliente } from "@/lib/apontamentos";
import type { AgendamentoComCliente } from "@/lib/agenda";
import type { ValorVigencia } from "@/lib/financeiro";
import type { Peca } from "@/lib/pecas";
import type { RelatorioSalvo } from "@/lib/relatorios";
import type { DadosEmpresa } from "@/lib/empresa";
import type { Orcamento, OrcamentoItem } from "@/lib/orcamentos";

type Entity = "clientes" | "apontamentos" | "valores_vigencia" | "agendamentos" | "pecas" | "relatorios_salvos" | "dados_empresa" | "orcamentos" | "orcamento_itens";
type QueueAction = "upsert" | "delete";

type QueueItem = {
  queueId?: number;
  entity: Entity;
  action: QueueAction;
  recordId: string;
  payload?: Record<string, unknown>;
  createdAt: number;
  attempts?: number;
  lastError?: string;
  userId: string;
};

interface OfflineDB extends DBSchema {
  cache: { key: string; value: unknown };
  queue: { key: number; value: QueueItem; indexes: { entity: Entity } };
}

const DB_NAME = "cp-technic-horas";
const CACHE_CLIENTES = "clientes";
const CACHE_APONTAMENTOS = "apontamentos";
const CACHE_VALORES = "valores-vigencia";
const CACHE_AGENDAMENTOS = "agendamentos";
const CACHE_PECAS = "pecas";
const CACHE_RELATORIOS = "relatorios-salvos";
const CACHE_EMPRESA = "dados-empresa";
const CACHE_ORCAMENTOS = "orcamentos";
const OFFLINE_EVENT = "cp-offline-change";

function database() {
  return openDB<OfflineDB>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore("cache");
      const queue = db.createObjectStore("queue", { keyPath: "queueId", autoIncrement: true });
      queue.createIndex("entity", "entity");
    },
  });
}

async function activeUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function scopedKey(key: string) {
  const userId = await activeUserId();
  return userId ? `${userId}:${key}` : `signed-out:${key}`;
}

function emitChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OFFLINE_EVENT));
}

export async function readCached<T>(key: string): Promise<T | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  return (await (await database()).get("cache", await scopedKey(key))) as T | undefined;
}

export async function writeCached<T>(key: string, value: T) {
  if (typeof indexedDB === "undefined") return;
  await (await database()).put("cache", value, await scopedKey(key));
}

export const queryPersister = {
  persistClient: (client: PersistedClient) => writeCached("react-query", client),
  restoreClient: () => readCached<PersistedClient>("react-query"),
  removeClient: async () => {
    if (typeof indexedDB !== "undefined") await (await database()).delete("cache", await scopedKey("react-query"));
  },
};

export async function pendingCount() {
  if (typeof indexedDB === "undefined") return 0;
  const userId = await activeUserId();
  if (!userId) return 0;
  return (await (await database()).getAll("queue")).filter((item) => item.userId === userId).length;
}

export async function getOfflineQueueStatus() {
  if (typeof indexedDB === "undefined") return { pending: 0, failed: 0, firstError: undefined };
  const userId = await activeUserId();
  if (!userId) return { pending: 0, failed: 0, firstError: undefined };
  const items = (await (await database()).getAll("queue")).filter((item) => item.userId === userId);
  const failedItems = items.filter((item) => item.lastError);
  return {
    pending: items.length,
    failed: failedItems.length,
    firstError: failedItems[0]?.lastError,
  };
}

export function subscribeOfflineStatus(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(OFFLINE_EVENT, listener);
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener(OFFLINE_EVENT, listener);
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

async function enqueue(item: Omit<QueueItem, "queueId" | "createdAt">) {
  const db = await database();
  const existing = await db.getAll("queue");
  const prior = existing.find((queued) => queued.entity === item.entity && queued.recordId === item.recordId);
  if (prior?.queueId != null) await db.delete("queue", prior.queueId);
  await db.add("queue", { ...item, createdAt: Date.now() });
  emitChange();
}

async function requireUserId() {
  const userId = await activeUserId();
  if (!userId) throw new Error("Entre novamente para salvar seus dados.");
  return userId;
}

export async function clearOfflineUserData() {
  if (typeof indexedDB === "undefined") return;
  const db = await database();
  await db.clear("cache");
  await db.clear("queue");
  emitChange();
}

function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

export function isNetworkError(error: unknown) {
  if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) return true;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) return true;
  if (typeof error === "object" && error !== null && "status" in error && Number(error.status) === 0) return true;
  return /failed to fetch|load failed|networkerror/i.test(errorMessage(error));
}

function timeoutSignal() {
  return AbortSignal.timeout(10_000);
}

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
        await writeCached(CACHE_CLIENTES, [...cached.filter((item) => item.id !== cliente.id), cliente]);
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

type ApontamentoWrite = Omit<ApontamentoComCliente, "clientes" | "created_at" | "updated_at" | "user_id"> &
  Partial<Pick<ApontamentoComCliente, "created_at" | "updated_at" | "user_id">>;

export async function saveApontamentoOffline(payload: ApontamentoWrite) {
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
  await enqueue({ entity: "apontamentos", action: "upsert", recordId: record.id, payload: dbPayload, userId });
  await writeCached(CACHE_APONTAMENTOS, nextCache);
  return { record, queued: true };
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

  await enqueue({ entity: "valores_vigencia", action: "upsert", recordId: record.id, payload: dbPayload, userId });
  await writeCached(CACHE_VALORES, nextCache);
  return { record, queued: true };
}

type AgendamentoWrite = Omit<AgendamentoComCliente, "clientes" | "created_at" | "updated_at" | "user_id"> &
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

  await enqueue({ entity: "agendamentos", action: "upsert", recordId: record.id, payload: dbPayload, userId });
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
        await writeCached(CACHE_AGENDAMENTOS, cached.filter((item) => item.id !== id));
        return { queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  await enqueue({ entity: "agendamentos", action: "delete", recordId: id, userId });
  await writeCached(CACHE_AGENDAMENTOS, cached.filter((item) => item.id !== id));
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

  await enqueue({ entity: "pecas", action: "upsert", recordId: record.id, payload: dbPayload, userId });
  await writeCached(CACHE_PECAS, nextCache);
  return { record, queued: true };
}

export async function deletePecaOffline(id: string) {
  const userId = await requireUserId();
  const cached = (await readCached<Peca[]>(CACHE_PECAS)) ?? [];
  if (!isOffline()) {
    try {
      const { error } = await supabase.from("pecas").delete().eq("id", id).abortSignal(timeoutSignal());
      if (error) {
        if (!isNetworkError(error)) throw error;
      } else {
        await writeCached(CACHE_PECAS, cached.filter((item) => item.id !== id));
        return { queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  await enqueue({ entity: "pecas", action: "delete", recordId: id, userId });
  await writeCached(CACHE_PECAS, cached.filter((item) => item.id !== id));
  return { queued: true };
}

type EmpresaWrite = Omit<DadosEmpresa, "created_at" | "updated_at" | "user_id"> &
  Partial<Pick<DadosEmpresa, "created_at" | "updated_at" | "user_id">>;

export async function saveEmpresaOffline(payload: EmpresaWrite) {
  const userId = await requireUserId();
  const dbPayload: TablesInsert<"dados_empresa"> = { ...payload, user_id: userId };
  const now = new Date().toISOString();
  const record: DadosEmpresa = { created_at: payload.created_at ?? now, updated_at: now, ...payload, user_id: userId };
  if (!isOffline()) {
    try {
      const { error } = await supabase.from("dados_empresa").upsert(dbPayload, { onConflict: "user_id" }).abortSignal(timeoutSignal());
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
  await enqueue({ entity: "dados_empresa", action: "upsert", recordId: record.id, payload: dbPayload, userId });
  await writeCached(CACHE_EMPRESA, record);
  return { record, queued: true };
}

type OrcamentoWrite = Omit<Orcamento, "created_at" | "updated_at" | "user_id" | "itens"> &
  Partial<Pick<Orcamento, "created_at" | "updated_at" | "user_id">> & { itens: Array<Omit<OrcamentoItem, "created_at" | "updated_at" | "user_id">> };

function orcamentoPayload(payload: OrcamentoWrite, userId: string): TablesInsert<"orcamentos"> {
  return {
    id: payload.id, user_id: userId, numero: payload.numero, cliente_id: payload.cliente_id,
    cliente_snapshot: payload.cliente_snapshot as unknown as Json, data: payload.data,
    validade_dias: payload.validade_dias, desconto_tipo: payload.desconto_tipo,
    desconto_valor: payload.desconto_valor, formas_pagamento: payload.formas_pagamento as unknown as Json,
    condicoes_pagamento: payload.condicoes_pagamento, observacoes: payload.observacoes,
    status: payload.status, total_produtos: payload.total_produtos, total_servicos: payload.total_servicos,
    subtotal: payload.subtotal, total: payload.total,
  };
}

export async function saveOrcamentoOffline(payload: OrcamentoWrite) {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const dbPayload = orcamentoPayload(payload, userId);
  const itemPayloads: TablesInsert<"orcamento_itens">[] = payload.itens.map((item, index) => ({
    ...item, user_id: userId, orcamento_id: payload.id, ordem: index,
  }));
  const record: Orcamento = {
    ...payload, user_id: userId, created_at: payload.created_at ?? now, updated_at: now,
    itens: payload.itens.map((item, index) => ({ ...item, user_id: userId, ordem: index, created_at: now, updated_at: now })),
  };
  const cached = (await readCached<Orcamento[]>(CACHE_ORCAMENTOS)) ?? [];
  const nextCache = [record, ...cached.filter((item) => item.id !== record.id)].sort((a, b) => `${b.data}${b.created_at}`.localeCompare(`${a.data}${a.created_at}`));
  if (!isOffline()) {
    try {
      const parent = await supabase.from("orcamentos").upsert(dbPayload, { onConflict: "id" }).abortSignal(timeoutSignal());
      if (parent.error) throw parent.error;
      const removed = await supabase.from("orcamento_itens").delete().eq("orcamento_id", payload.id).abortSignal(timeoutSignal());
      if (removed.error) throw removed.error;
      if (itemPayloads.length > 0) {
        const inserted = await supabase.from("orcamento_itens").upsert(itemPayloads, { onConflict: "id" }).abortSignal(timeoutSignal());
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
    if (!nextItemIds.has(oldItem.id)) await enqueue({ entity: "orcamento_itens", action: "delete", recordId: oldItem.id, userId });
  }
  await enqueue({ entity: "orcamentos", action: "upsert", recordId: record.id, payload: dbPayload, userId });
  for (const item of itemPayloads) await enqueue({ entity: "orcamento_itens", action: "upsert", recordId: item.id ?? crypto.randomUUID(), payload: item, userId });
  await writeCached(CACHE_ORCAMENTOS, nextCache);
  return { record, queued: true };
}

export async function deleteOrcamentoOffline(id: string) {
  const userId = await requireUserId();
  const cached = (await readCached<Orcamento[]>(CACHE_ORCAMENTOS)) ?? [];
  if (!isOffline()) {
    try {
      const { error } = await supabase.from("orcamentos").delete().eq("id", id).abortSignal(timeoutSignal());
      if (error) {
        if (!isNetworkError(error)) throw error;
      } else {
        await writeCached(CACHE_ORCAMENTOS, cached.filter((item) => item.id !== id));
        return { queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  await enqueue({ entity: "orcamentos", action: "delete", recordId: id, userId });
  await writeCached(CACHE_ORCAMENTOS, cached.filter((item) => item.id !== id));
  return { queued: true };
}

type RelatorioWrite = Omit<RelatorioSalvo, "created_at" | "updated_at" | "user_id" | "pagamento_status" | "valor_recebido" | "data_recebimento" | "forma_pagamento" | "observacao_relatorio" | "despesas_snapshot" | "total_despesas"> &
  Partial<Pick<RelatorioSalvo, "created_at" | "updated_at" | "user_id" | "pagamento_status" | "valor_recebido" | "data_recebimento" | "forma_pagamento" | "observacao_relatorio" | "despesas_snapshot" | "total_despesas">>;

function relatorioPayload(payload: RelatorioWrite, userId: string): TablesInsert<"relatorios_salvos"> {
  return {
    id: payload.id,
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
    pagamento_status: payload.pagamento_status ?? "pendente",
    valor_recebido: payload.valor_recebido ?? 0,
    data_recebimento: payload.data_recebimento ?? null,
    forma_pagamento: payload.forma_pagamento ?? null,
  };
}

export async function saveRelatorioOffline(payload: RelatorioWrite) {
  const userId = await requireUserId();
  const dbPayload = relatorioPayload(payload, userId);
  const now = new Date().toISOString();
  const record: RelatorioSalvo = {
    ...payload,
    pagamento_status: payload.pagamento_status ?? "pendente",
    valor_recebido: payload.valor_recebido ?? 0,
    data_recebimento: payload.data_recebimento ?? null,
    forma_pagamento: payload.forma_pagamento ?? null,
    observacao_relatorio: payload.observacao_relatorio ?? "",
    despesas_snapshot: payload.despesas_snapshot ?? [],
    total_despesas: payload.total_despesas ?? 0,
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
      const { error } = await supabase.from("relatorios_salvos").upsert(dbPayload, { onConflict: "id" }).abortSignal(timeoutSignal());
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
  await enqueue({ entity: "relatorios_salvos", action: "upsert", recordId: record.id, payload: dbPayload, userId });
  await writeCached(CACHE_RELATORIOS, nextCache);
  return { record, queued: true };
}

export async function deleteRelatorioOffline(id: string) {
  const userId = await requireUserId();
  const cached = (await readCached<RelatorioSalvo[]>(CACHE_RELATORIOS)) ?? [];
  if (!isOffline()) {
    try {
      const { error } = await supabase.from("relatorios_salvos").delete().eq("id", id).abortSignal(timeoutSignal());
      if (error) {
        if (!isNetworkError(error)) throw error;
      } else {
        await writeCached(CACHE_RELATORIOS, cached.filter((item) => item.id !== id));
        return { queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  await enqueue({ entity: "relatorios_salvos", action: "delete", recordId: id, userId });
  await writeCached(CACHE_RELATORIOS, cached.filter((item) => item.id !== id));
  return { queued: true };
}

export async function deleteApontamentoOffline(id: string) {
  const userId = await requireUserId();
  const cached = (await readCached<ApontamentoComCliente[]>(CACHE_APONTAMENTOS)) ?? [];
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
        await writeCached(CACHE_APONTAMENTOS, cached.filter((item) => item.id !== id));
        return { queued: false };
      }
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }
  await enqueue({ entity: "apontamentos", action: "delete", recordId: id, userId });
  await writeCached(CACHE_APONTAMENTOS, cached.filter((item) => item.id !== id));
  return { queued: true };
}

export async function getPendingApontamentoIds() {
  if (typeof indexedDB === "undefined") return new Set<string>();
  const userId = await activeUserId();
  if (!userId) return new Set<string>();
  const items = (await (await database()).getAllFromIndex("queue", "entity", "apontamentos"))
    .filter((item) => item.userId === userId);
  return new Set(items.map((item) => item.recordId));
}

export async function syncOfflineQueue() {
  if (isOffline() || typeof indexedDB === "undefined") return;
  const userId = await activeUserId();
  if (!userId) return;
  const db = await database();
  const items = await db.getAll("queue");
  items.sort((a, b) => {
    const priority = (item: QueueItem) => item.entity === "valores_vigencia" || item.entity === "dados_empresa" ? 0 : item.entity === "clientes" ? 1 : item.entity === "orcamentos" ? 2 : item.entity === "orcamento_itens" ? 3 : 4;
    return priority(a) - priority(b) || a.createdAt - b.createdAt;
  });
  for (const item of items) {
    if (item.userId !== userId) continue;
    try {
      let result;
      if (item.action === "delete") {
        result = await supabase
          .from(item.entity)
          .delete()
          .eq("id", item.recordId)
          .abortSignal(timeoutSignal());
      } else if (item.entity === "clientes") {
        result = await supabase
          .from("clientes")
          .upsert((item.payload ?? {}) as TablesInsert<"clientes">, { onConflict: "id" })
          .abortSignal(timeoutSignal());
      } else if (item.entity === "apontamentos") {
        result = await supabase
          .from("apontamentos")
          .upsert((item.payload ?? {}) as TablesInsert<"apontamentos">, { onConflict: "id" })
          .abortSignal(timeoutSignal());
      } else if (item.entity === "valores_vigencia") {
        result = await supabase
          .from("valores_vigencia")
          .upsert((item.payload ?? {}) as TablesInsert<"valores_vigencia">, { onConflict: "id" })
          .abortSignal(timeoutSignal());
      } else if (item.entity === "agendamentos") {
        result = await supabase
          .from("agendamentos")
          .upsert((item.payload ?? {}) as TablesInsert<"agendamentos">, { onConflict: "id" })
          .abortSignal(timeoutSignal());
      } else if (item.entity === "pecas") {
        result = await supabase
          .from("pecas")
          .upsert((item.payload ?? {}) as TablesInsert<"pecas">, { onConflict: "id" })
          .abortSignal(timeoutSignal());
      } else if (item.entity === "relatorios_salvos") {
        result = await supabase
          .from("relatorios_salvos")
          .upsert((item.payload ?? {}) as TablesInsert<"relatorios_salvos">, { onConflict: "id" })
          .abortSignal(timeoutSignal());
      } else if (item.entity === "dados_empresa") {
        result = await supabase.from("dados_empresa").upsert((item.payload ?? {}) as TablesInsert<"dados_empresa">, { onConflict: "user_id" }).abortSignal(timeoutSignal());
      } else if (item.entity === "orcamentos") {
        result = await supabase.from("orcamentos").upsert((item.payload ?? {}) as TablesInsert<"orcamentos">, { onConflict: "id" }).abortSignal(timeoutSignal());
      } else {
        result = await supabase.from("orcamento_itens").upsert((item.payload ?? {}) as TablesInsert<"orcamento_itens">, { onConflict: "id" }).abortSignal(timeoutSignal());
      }
      if (result.error) throw result.error;
      if (item.queueId != null) await db.delete("queue", item.queueId);
    } catch (error) {
      if (isNetworkError(error)) break;
      if (item.queueId != null) {
        await db.put("queue", {
          ...item,
          attempts: (item.attempts ?? 0) + 1,
          lastError: errorMessage(error),
        });
      }
    }
  }
  emitChange();
}

export const offlineCacheKeys = {
  clientes: CACHE_CLIENTES,
  apontamentos: CACHE_APONTAMENTOS,
  valores: CACHE_VALORES,
  agendamentos: CACHE_AGENDAMENTOS,
  pecas: CACHE_PECAS,
  relatorios: CACHE_RELATORIOS,
  empresa: CACHE_EMPRESA,
  orcamentos: CACHE_ORCAMENTOS,
};