import { openDB, type DBSchema } from "idb";
import type { PersistedClient } from "@tanstack/react-query-persist-client";

import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { ApontamentoComCliente, Cliente } from "@/lib/apontamentos";

type Entity = "clientes" | "apontamentos";
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
};

interface OfflineDB extends DBSchema {
  cache: { key: string; value: unknown };
  queue: { key: number; value: QueueItem; indexes: { entity: Entity } };
}

const DB_NAME = "cp-technic-horas";
const CACHE_CLIENTES = "clientes";
const CACHE_APONTAMENTOS = "apontamentos";
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

function emitChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OFFLINE_EVENT));
}

export async function readCached<T>(key: string): Promise<T | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  return (await (await database()).get("cache", key)) as T | undefined;
}

export async function writeCached<T>(key: string, value: T) {
  if (typeof indexedDB === "undefined") return;
  await (await database()).put("cache", value, key);
}

export const queryPersister = {
  persistClient: (client: PersistedClient) => writeCached("react-query", client),
  restoreClient: () => readCached<PersistedClient>("react-query"),
  removeClient: async () => {
    if (typeof indexedDB !== "undefined") await (await database()).delete("cache", "react-query");
  },
};

export async function pendingCount() {
  if (typeof indexedDB === "undefined") return 0;
  return (await database()).count("queue");
}

export async function getOfflineQueueStatus() {
  if (typeof indexedDB === "undefined") return { pending: 0, failed: 0, firstError: undefined };
  const items = await (await database()).getAll("queue");
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

export async function saveClienteOffline(
  payload: Omit<Cliente, "created_at" | "updated_at"> & Partial<Pick<Cliente, "created_at" | "updated_at">>,
) {
  const now = new Date().toISOString();
  const cliente: Cliente = { created_at: now, updated_at: now, ...payload };
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
  await enqueue({ entity: "clientes", action: "upsert", recordId: cliente.id, payload });
  await writeCached(CACHE_CLIENTES, [...cached.filter((item) => item.id !== cliente.id), cliente]);
  return { cliente, queued: true };
}

type ApontamentoWrite = Omit<ApontamentoComCliente, "clientes" | "created_at" | "updated_at"> &
  Partial<Pick<ApontamentoComCliente, "created_at" | "updated_at">>;

export async function saveApontamentoOffline(payload: ApontamentoWrite) {
  const now = new Date().toISOString();
  const clientes = (await readCached<Cliente[]>(CACHE_CLIENTES)) ?? [];
  const record: ApontamentoComCliente = {
    created_at: now,
    updated_at: now,
    ...payload,
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
  await enqueue({ entity: "apontamentos", action: "upsert", recordId: record.id, payload: dbPayload });
  await writeCached(CACHE_APONTAMENTOS, nextCache);
  return { record, queued: true };
}

export async function deleteApontamentoOffline(id: string) {
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
  await enqueue({ entity: "apontamentos", action: "delete", recordId: id });
  await writeCached(CACHE_APONTAMENTOS, cached.filter((item) => item.id !== id));
  return { queued: true };
}

export async function getPendingApontamentoIds() {
  if (typeof indexedDB === "undefined") return new Set<string>();
  const items = await (await database()).getAllFromIndex("queue", "entity", "apontamentos");
  return new Set(items.map((item) => item.recordId));
}

export async function syncOfflineQueue() {
  if (isOffline() || typeof indexedDB === "undefined") return;
  const db = await database();
  const items = await db.getAll("queue");
  items.sort((a, b) => {
    const priority = (item: QueueItem) => (item.entity === "clientes" ? 0 : 1);
    return priority(a) - priority(b) || a.createdAt - b.createdAt;
  });
  for (const item of items) {
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
      } else {
        result = await supabase
          .from("apontamentos")
          .upsert((item.payload ?? {}) as TablesInsert<"apontamentos">, { onConflict: "id" })
          .abortSignal(timeoutSignal());
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
};