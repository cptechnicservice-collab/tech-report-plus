import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { Entity, QueueItem } from "./offline.types";
import { database, activeUserId, emitChange, LAST_SYNC_KEY } from "./offline.storage";
import { isOffline, isNetworkError, errorMessage, timeoutSignal } from "./offline.utils";
const RETRY_DELAYS = [5_000, 15_000, 60_000, 300_000, 900_000] as const;
let syncInProgress: Promise<string[]> | null = null;
const ENTITY_TO_QUERY_KEY: Record<Entity, string> = {
  clientes: "clientes",
  apontamentos: "apontamentos",
  apontamento_pecas: "apontamentos",
  valores_vigencia: "valores",
  agendamentos: "agendamentos",
  pecas: "pecas",
  relatorios_salvos: "relatorios-salvos",
  dados_empresa: "dados-empresa",
  orcamentos: "orcamentos",
  orcamento_itens: "orcamentos",
};
async function runOfflineQueue(force: boolean): Promise<string[]> {
  const syncedQueryKeys = new Set<string>();
  if (isOffline() || typeof indexedDB === "undefined") return [];
  const userId = await activeUserId();
  if (!userId) return [];
  const db = await database();
  const allItems = await db.getAll("queue");
  const items = allItems.filter((i) => i.userId === userId);
  if (items.length === 0) return [];

  items.sort((a, b) => {
    const priority = (item: QueueItem) =>
      item.entity === "valores_vigencia" || item.entity === "dados_empresa"
        ? 0
        : item.entity === "clientes"
          ? 1
          : item.entity === "orcamentos" || item.entity === "apontamentos"
            ? 2
            : item.entity === "orcamento_itens" || item.entity === "apontamento_pecas"
              ? 3
              : 4;
    return priority(a) - priority(b) || a.createdAt - b.createdAt;
  });

  for (const item of items) {
    if (!force && item.nextAttemptAt && item.nextAttemptAt > Date.now()) continue;
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
      } else if (item.entity === "apontamento_pecas") {
        result = await supabase
          .from("apontamento_pecas")
          .upsert((item.payload ?? {}) as TablesInsert<"apontamento_pecas">, { onConflict: "id" })
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
        result = await supabase
          .from("dados_empresa")
          .upsert((item.payload ?? {}) as TablesInsert<"dados_empresa">, { onConflict: "user_id" })
          .abortSignal(timeoutSignal());
      } else if (item.entity === "orcamentos") {
        result = await supabase
          .from("orcamentos")
          .upsert((item.payload ?? {}) as TablesInsert<"orcamentos">, { onConflict: "id" })
          .abortSignal(timeoutSignal());
      } else {
        result = await supabase
          .from("orcamento_itens")
          .upsert((item.payload ?? {}) as TablesInsert<"orcamento_itens">, { onConflict: "id" })
          .abortSignal(timeoutSignal());
      }
      if (result.error) throw result.error;
      if (item.queueId != null) {
        await db.delete("queue", item.queueId);
        const queryKey = ENTITY_TO_QUERY_KEY[item.entity as Entity];
        if (queryKey) syncedQueryKeys.add(queryKey);
      }
    } catch (error) {
      if (isNetworkError(error)) break;
      if (item.queueId != null) {
        const attempts = (item.attempts ?? 0) + 1;
        const delay = RETRY_DELAYS[Math.min(attempts - 1, RETRY_DELAYS.length - 1)] ?? 900_000;
        await db.put("queue", {
          ...item,
          attempts,
          lastError: errorMessage(error),
          nextAttemptAt: Date.now() + delay,
        });
      }
    }
  }
  const remaining = (await db.getAll("queue")).filter((item) => item.userId === userId);
  if (remaining.length === 0 && typeof localStorage !== "undefined") {
    localStorage.setItem(`${LAST_SYNC_KEY}:${userId}`, new Date().toISOString());
  }
  emitChange();
  return Array.from(syncedQueryKeys);
}

export async function syncOfflineQueue(options?: { force?: boolean }): Promise<string[]> {
  if (syncInProgress) return syncInProgress;
  syncInProgress = runOfflineQueue(options?.force ?? false).finally(() => {
    syncInProgress = null;
  });
  return syncInProgress;
}
