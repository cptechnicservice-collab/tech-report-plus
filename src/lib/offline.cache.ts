import type { PersistedClient } from "@tanstack/react-query-persist-client";
import { database, scopedKey, emitChange, CACHE_CLIENTES, CACHE_APONTAMENTOS, CACHE_APONTAMENTO_PECAS, CACHE_VALORES, CACHE_AGENDAMENTOS, CACHE_PECAS, CACHE_RELATORIOS, CACHE_EMPRESA, CACHE_ORCAMENTOS } from "./offline.storage";
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
    if (typeof indexedDB !== "undefined")
      await (await database()).delete("cache", await scopedKey("react-query"));
  },
};
export async function clearOfflineUserData() {
  if (typeof indexedDB === "undefined") return;
  const db = await database();
  await db.clear("cache");
  await db.clear("queue");
  emitChange();
}
export const offlineCacheKeys = {
  clientes: CACHE_CLIENTES,
  apontamentos: CACHE_APONTAMENTOS,
  apontamentoPecas: CACHE_APONTAMENTO_PECAS,
  valores: CACHE_VALORES,
  agendamentos: CACHE_AGENDAMENTOS,
  pecas: CACHE_PECAS,
  relatorios: CACHE_RELATORIOS,
  empresa: CACHE_EMPRESA,
  orcamentos: CACHE_ORCAMENTOS,
};
