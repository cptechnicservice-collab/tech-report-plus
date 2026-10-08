import { openDB } from "idb";
import type { OfflineDB } from "./offline.types";
import { activeAppUserId } from "./auth-session";
export const DB_NAME = "cp-technic-horas";
export const CACHE_CLIENTES = "clientes";
export const CACHE_APONTAMENTOS = "apontamentos";
export const CACHE_APONTAMENTO_PECAS = "apontamento-pecas";
export const CACHE_VALORES = "valores-vigencia";
export const CACHE_AGENDAMENTOS = "agendamentos";
export const CACHE_PECAS = "pecas";
export const CACHE_RELATORIOS = "relatorios-salvos";
export const CACHE_EMPRESA = "dados-empresa";
export const CACHE_ORCAMENTOS = "orcamentos";
export const OFFLINE_EVENT = "cp-offline-change";
export const LAST_SYNC_KEY = "cp-technic-last-successful-sync";
export function database() {
  return openDB<OfflineDB>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore("cache");
      const queue = db.createObjectStore("queue", { keyPath: "queueId", autoIncrement: true });
      queue.createIndex("entity", "entity");
    },
  });
}

export async function activeUserId() {
  return activeAppUserId();
}

export async function scopedKey(key: string) {
  const userId = await activeUserId();
  return userId ? `${userId}:${key}` : `signed-out:${key}`;
}

export function emitChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OFFLINE_EVENT));
}

