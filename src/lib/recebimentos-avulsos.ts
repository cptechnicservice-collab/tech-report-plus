import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { readCached, writeCached } from "./offline.cache";
import { enqueue, getQueueItems, requireUserId } from "./offline.queue";
import { isOffline, isNetworkError, timeoutSignal } from "./offline.utils";
import { fetchAllPages } from "./fetch-all-pages";

export type RecebimentoAvulso = Tables<"recebimentos_avulsos">;
const CACHE_KEY = "recebimentos-avulsos";
export const recebimentoAvulsoSchema = z.object({
  id: z.string().uuid(),
  cliente_id: z.string().uuid("Selecione um cliente."),
  valor: z.number({ invalid_type_error: "Informe um valor válido." }).finite("Informe um valor válido.").positive("O valor deve ser maior que zero."),
  data_recebimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.").refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Informe uma data válida."),
  forma_pagamento: z.string().nullable(),
  observacao: z.string().nullable(),
});
type ReceiptWrite = z.infer<typeof recebimentoAvulsoSchema> & { created_at?: string };

export function filtrarRecebimentosAvulsos(items: RecebimentoAvulso[], filtro: { clienteId?: string | undefined; periodo?: string | undefined; inicio?: string | undefined; fim?: string | undefined } = {}) {
  return items.filter((item) => (!filtro.clienteId || item.cliente_id === filtro.clienteId)
    && (!filtro.periodo || item.data_recebimento.startsWith(filtro.periodo))
    && (!filtro.inicio || item.data_recebimento >= filtro.inicio)
    && (!filtro.fim || item.data_recebimento <= filtro.fim));
}
export function totalRecebimentosAvulsos(items: RecebimentoAvulso[], filtro: Parameters<typeof filtrarRecebimentosAvulsos>[1] = {}) {
  return filtrarRecebimentosAvulsos(items, filtro).reduce((sum, item) => sum + (Number.isFinite(item.valor) && item.valor > 0 ? item.valor : 0), 0);
}
const ordenar = (items: RecebimentoAvulso[]) => items.sort((a, b) => b.data_recebimento.localeCompare(a.data_recebimento) || b.id.localeCompare(a.id));

export async function fetchRecebimentosAvulsos(): Promise<RecebimentoAvulso[]> {
  await requireUserId();
  const cached = (await readCached<RecebimentoAvulso[]>(CACHE_KEY)) ?? [];
  if (isOffline()) return cached;
  try {
    const rows = await fetchAllPages(() => supabase.from("recebimentos_avulsos").select("*")
      .order("data_recebimento", { ascending: false }).order("id", { ascending: false }).abortSignal(timeoutSignal()));
    // Preserve local edits/deletes while the queue is waiting to sync.
    const pending = (await getQueueItems()).filter((item) => item.entity === "recebimentos_avulsos");
    const ids = new Set(pending.map((item) => item.recordId));
    const local = cached.filter((item) => pending.some((op) => op.recordId === item.id && op.action === "upsert"));
    const result = ordenar([...rows.filter((item) => !ids.has(item.id)), ...local]);
    await writeCached(CACHE_KEY, result);
    return result;
  } catch (error) {
    const fallback = await readCached<RecebimentoAvulso[]>(CACHE_KEY);
    if (fallback) return fallback;
    throw error;
  }
}
export const recebimentosAvulsosQuery = () => queryOptions({ queryKey: [CACHE_KEY], queryFn: fetchRecebimentosAvulsos, networkMode: "always", staleTime: 180_000 });

export async function saveRecebimentoAvulsoOffline(input: ReceiptWrite) {
  const payload = recebimentoAvulsoSchema.parse(input);
  const userId = await requireUserId();
  const cached = (await readCached<RecebimentoAvulso[]>(CACHE_KEY)) ?? [];
  const now = new Date().toISOString();
  const existing = cached.find((item) => item.id === payload.id);
  const record: RecebimentoAvulso = { ...payload, user_id: userId, created_at: existing?.created_at ?? input.created_at ?? now, updated_at: now };
  let queued = true;
  // An existing pending operation must coalesce in the queue, not race an online write.
  const pending = (await getQueueItems()).some((item) => item.entity === "recebimentos_avulsos" && item.recordId === record.id);
  if (!isOffline() && !pending) {
    try {
      const { error } = await supabase.from("recebimentos_avulsos").upsert(record, { onConflict: "id" }).abortSignal(timeoutSignal());
      if (error) throw error;
      queued = false;
    } catch (error) { if (!isNetworkError(error)) throw error; }
  }
  if (queued) await enqueue({ entity: "recebimentos_avulsos", action: "upsert", recordId: record.id, payload: record, userId });
  await writeCached(CACHE_KEY, ordenar([record, ...cached.filter((item) => item.id !== record.id)]));
  return { record, queued };
}

export async function deleteRecebimentoAvulsoOffline(id: string) {
  const userId = await requireUserId();
  const cached = (await readCached<RecebimentoAvulso[]>(CACHE_KEY)) ?? [];
  const pending = (await getQueueItems()).some((item) => item.entity === "recebimentos_avulsos" && item.recordId === id);
  let queued = true;
  if (!isOffline() && !pending) {
    try {
      const { error } = await supabase.from("recebimentos_avulsos").delete().eq("id", id).abortSignal(timeoutSignal());
      if (error) throw error;
      queued = false;
    } catch (error) { if (!isNetworkError(error)) throw error; }
  }
  if (queued) await enqueue({ entity: "recebimentos_avulsos", action: "delete", recordId: id, userId });
  await writeCached(CACHE_KEY, cached.filter((item) => item.id !== id));
  return { queued };
}