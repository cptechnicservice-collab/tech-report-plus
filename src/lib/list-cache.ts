import { readCached, writeCached } from "@/lib/offline.cache";
import { getQueueItems } from "@/lib/offline.queue";
import type { Entity } from "@/lib/offline.types";

/** Merge projections without replacing complete offline snapshots or pending local writes. */
export async function mergeListCache<T extends { id: string }>(key: string, entity: Entity, rows: T[]): Promise<T[]> {
  const cached = await readCached<T[]>(key) ?? [];
  const pending = (await getQueueItems()).filter((op) => op.entity === entity);
  const pendingIds = new Set(pending.map((op) => op.recordId));
  const byId = new Map(cached.map((row) => [row.id, row]));
  const merged = rows.filter((row) => !pendingIds.has(row.id)).map((row) => ({ ...byId.get(row.id), ...row }));
  merged.push(...cached.filter((row) => pending.some((op) => op.recordId === row.id && op.action === "upsert")));
  await writeCached(key, merged);
  return merged;
}

export async function cacheCompleteRecord<T extends { id: string }>(key: string, record: T) {
  const cached = await readCached<T[]>(key) ?? [];
  await writeCached(key, [record, ...cached.filter((row) => row.id !== record.id)]);
}

export function measureList(name: string, rows: unknown, start: number) {
  console.debug("[performance] list", { name, bytes: new TextEncoder().encode(JSON.stringify(rows)).length, ms: Math.round(performance.now() - start) });
}