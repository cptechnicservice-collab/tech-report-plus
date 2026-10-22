import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { readCached, writeCached } from "./offline.cache";
import { enqueue, getQueueItems, requireUserId } from "./offline.queue";
import { isOffline, isNetworkError, timeoutSignal } from "./offline.utils";
import { fetchAllPages } from "./fetch-all-pages";

export type Lembrete = Tables<"lembretes">;
const CACHE_KEY = "lembretes";
export const lembreteSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().trim().min(1, "Escreva o lembrete.").max(300, "Use até 300 caracteres."),
  data_prevista: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.").refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Informe uma data válida.").nullable(),
  concluido: z.boolean(),
});
type LembreteWrite = z.infer<typeof lembreteSchema> & { created_at?: string };
export function ordenarLembretes(items: Lembrete[]) {
  return [...items].sort((a, b) => Number(a.concluido) - Number(b.concluido)
    || (a.data_prevista ?? "9999").localeCompare(b.data_prevista ?? "9999")
    || b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}
const ordenar = ordenarLembretes;

export async function fetchLembretes(): Promise<Lembrete[]> {
  await requireUserId();
  const cached = (await readCached<Lembrete[]>(CACHE_KEY)) ?? [];
  if (isOffline()) return cached;
  try {
    const rows = await fetchAllPages(() => supabase.from("lembretes").select("*")
      .order("data_prevista", { ascending: false }).order("id", { ascending: false }).abortSignal(timeoutSignal()));
    // Preserve local edits/deletes while the queue is waiting to sync.
    const pending = (await getQueueItems()).filter((item) => item.entity === "lembretes");
    const ids = new Set(pending.map((item) => item.recordId));
    const local = cached.filter((item) => pending.some((op) => op.recordId === item.id && op.action === "upsert"));
    const result = ordenar([...rows.filter((item) => !ids.has(item.id)), ...local]);
    await writeCached(CACHE_KEY, result);
    return result;
  } catch (error) {
    const fallback = await readCached<Lembrete[]>(CACHE_KEY);
    if (fallback) return fallback;
    throw error;
  }
}
export const lembretesQuery = () => queryOptions({ queryKey: [CACHE_KEY], queryFn: fetchLembretes, networkMode: "always", staleTime: 180_000 });

export async function saveLembreteOffline(input: LembreteWrite) {
  const payload = lembreteSchema.parse(input);
  const userId = await requireUserId();
  const cached = (await readCached<Lembrete[]>(CACHE_KEY)) ?? [];
  const now = new Date().toISOString();
  const existing = cached.find((item) => item.id === payload.id);
  const record: Lembrete = { ...payload, user_id: userId, created_at: existing?.created_at ?? input.created_at ?? now, updated_at: now };
  let queued = true;
  // An existing pending operation must coalesce in the queue, not race an online write.
  const pending = (await getQueueItems()).some((item) => item.entity === "lembretes" && item.recordId === record.id);
  if (!isOffline() && !pending) {
    try {
      const { error } = await supabase.from("lembretes").upsert(record, { onConflict: "id" }).abortSignal(timeoutSignal());
      if (error) throw error;
      queued = false;
    } catch (error) { if (!isNetworkError(error)) throw error; }
  }
  if (queued) await enqueue({ entity: "lembretes", action: "upsert", recordId: record.id, payload: record, userId });
  await writeCached(CACHE_KEY, ordenar([record, ...cached.filter((item) => item.id !== record.id)]));
  return { record, queued };
}

export async function deleteLembreteOffline(id: string) {
  const userId = await requireUserId();
  const cached = (await readCached<Lembrete[]>(CACHE_KEY)) ?? [];
  const pending = (await getQueueItems()).some((item) => item.entity === "lembretes" && item.recordId === id);
  let queued = true;
  if (!isOffline() && !pending) {
    try {
      const { error } = await supabase.from("lembretes").delete().eq("id", id).abortSignal(timeoutSignal());
      if (error) throw error;
      queued = false;
    } catch (error) { if (!isNetworkError(error)) throw error; }
  }
  if (queued) await enqueue({ entity: "lembretes", action: "delete", recordId: id, userId });
  await writeCached(CACHE_KEY, cached.filter((item) => item.id !== id));
  return { queued };
}