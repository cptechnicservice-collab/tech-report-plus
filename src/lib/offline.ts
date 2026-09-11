import { openDB, type DBSchema } from "idb";

import { supabase } from "@/integrations/supabase/client";
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
  persistClient: (client: unknown) => writeCached("react-query", client),
  restoreClient: () => readCached("react-query"),
  removeClient: async () => {
    if (typeof indexedDB !== "undefined") await (await database()).delete("cache", "react-query");
  },
};

export async function pendingCount() {
  if (typeof indexedDB === "undefined") return 0;
  return (await database()).count("queue");
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

export async function saveClienteOffline(
  payload: Omit<Cliente, "created_at" | "updated_at"> & Partial<Pick<Cliente, "created_at" | "updated_at">>,
) {
  const now = new Date().toISOString();
  const cliente: Cliente = { created_at: now, updated_at: now, ...payload };
  const cached = (await readCached<Cliente[]>(CACHE_CLIENTES)) ?? [];
  await writeCached(CACHE_CLIENTES, [...cached.filter((item) => item.id !== cliente.id), cliente]);

  if (!isOffline()) {
    const { error } = await supabase.from("clientes").upsert(payload, { onConflict: "id" });
    if (!error) return { cliente, queued: false };
  }
  await enqueue({ entity: "clientes", action: "upsert", recordId: cliente.id, payload });
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
  await writeCached(
    CACHE_APONTAMENTOS,
    [record, ...cached.filter((item) => item.id !== record.id)].sort((a, b) =>
      `${b.data}${b.created_at}`.localeCompare(`${a.data}${a.created_at}`),
    ),
  );

  const dbPayload = { ...payload } as Record<string, unknown>;
  if (!isOffline()) {
    const { error } = await supabase.from("apontamentos").upsert(dbPayload, { onConflict: "id" });
    if (!error) return { record, queued: false };
  }
  await enqueue({ entity: "apontamentos", action: "upsert", recordId: record.id, payload: dbPayload });
  return { record, queued: true };
}

export async function deleteApontamentoOffline(id: string) {
  const cached = (await readCached<ApontamentoComCliente[]>(CACHE_APONTAMENTOS)) ?? [];
  await writeCached(CACHE_APONTAMENTOS, cached.filter((item) => item.id !== id));
  if (!isOffline()) {
    const { error } = await supabase.from("apontamentos").delete().eq("id", id);
    if (!error) return { queued: false };
  }
  await enqueue({ entity: "apontamentos", action: "delete", recordId: id });
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
    const result =
      item.action === "delete"
        ? await supabase.from(item.entity).delete().eq("id", item.recordId)
        : await supabase.from(item.entity).upsert(item.payload ?? {}, { onConflict: "id" });
    if (result.error) break;
    if (item.queueId != null) await db.delete("queue", item.queueId);
  }
  emitChange();
}

export const offlineCacheKeys = {
  clientes: CACHE_CLIENTES,
  apontamentos: CACHE_APONTAMENTOS,
};