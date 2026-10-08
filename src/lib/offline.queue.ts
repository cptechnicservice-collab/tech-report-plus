import type { Entity, QueueItem } from "./offline.types";
import { database, activeUserId, emitChange, OFFLINE_EVENT, LAST_SYNC_KEY } from "./offline.storage";
export async function pendingCount() {
  if (typeof indexedDB === "undefined") return 0;
  const userId = await activeUserId();
  if (!userId) return 0;
  return (await (await database()).getAll("queue")).filter((item) => item.userId === userId).length;
}

export async function getQueueItems(): Promise<QueueItem[]> {
  if (typeof indexedDB === "undefined") return [];
  const userId = await activeUserId();
  if (!userId) return [];
  const db = await database();
  const items = await db.getAll("queue");
  return items.filter((item) => item.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

export async function isRecordPending(entity: Entity, recordId: string): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  const userId = await activeUserId();
  if (!userId) return false;
  const db = await database();
  const items = await db.getAllFromIndex("queue", "entity", entity);
  return items.some((item) => item.recordId === recordId && item.userId === userId);
}

export async function getOfflineQueueStatus() {
  if (typeof indexedDB === "undefined")
    return {
      authenticated: false,
      pending: 0,
      failed: 0,
      attention: 0,
      firstError: undefined,
      lastSuccessfulSync: undefined,
      byEntity: {} as Record<Entity, number>,
    };
  const userId = await activeUserId();
  if (!userId)
    return {
      authenticated: false,
      pending: 0,
      failed: 0,
      attention: 0,
      firstError: undefined,
      lastSuccessfulSync: undefined,
      byEntity: {} as Record<Entity, number>,
    };
  const items = (await (await database()).getAll("queue")).filter((item) => item.userId === userId);
  const failedItems = items.filter((item) => item.lastError);

  const byEntity = items.reduce(
    (acc, item) => {
      acc[item.entity] = (acc[item.entity] || 0) + 1;
      return acc;
    },
    {} as Record<Entity, number>,
  );

  return {
    authenticated: true,
    pending: items.length,
    failed: failedItems.length,
    attention: items.filter((item) => (item.attempts ?? 0) >= 3).length,
    firstError: failedItems[0]?.lastError,
    lastSuccessfulSync:
      typeof localStorage === "undefined"
        ? undefined
        : (localStorage.getItem(`${LAST_SYNC_KEY}:${userId}`) ?? undefined),
    byEntity,
  };
}

export async function retryQueueItem(queueId: number) {
  const userId = await activeUserId();
  if (!userId) return false;
  const db = await database();
  const item = await db.get("queue", queueId);
  if (!item || item.userId !== userId) return false;
  const { lastError: _lastError, nextAttemptAt: _nextAttemptAt, ...retryableItem } = item;
  await db.put("queue", { ...retryableItem, attempts: 0 });
  emitChange();
  return true;
}

export async function discardQueueItem(queueId: number) {
  const userId = await activeUserId();
  if (!userId) return false;
  const db = await database();
  const item = await db.get("queue", queueId);
  if (!item || item.userId !== userId) return false;
  await db.delete("queue", queueId);
  emitChange();
  return true;
}

export async function getPendingRecordIds(entity: Entity) {
  if (typeof indexedDB === "undefined") return new Set<string>();
  const userId = await activeUserId();
  if (!userId) return new Set<string>();
  const items = (await (await database()).getAllFromIndex("queue", "entity", entity)).filter(
    (item) => item.userId === userId,
  );
  return new Set(items.map((item) => item.recordId));
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

export async function enqueue(item: Omit<QueueItem, "queueId" | "createdAt">) {
  const db = await database();
  const existing = await db.getAll("queue");
  const prior = existing.find(
    (queued) => queued.entity === item.entity && queued.recordId === item.recordId,
  );
  if (prior?.queueId != null) await db.delete("queue", prior.queueId);
  await db.add("queue", { ...item, createdAt: Date.now() });
  emitChange();
}

export async function requireUserId() {
  const userId = await activeUserId();
  if (!userId) throw new Error("Entre novamente para salvar seus dados.");
  return userId;
}
export async function getPendingApontamentoIds() {
  if (typeof indexedDB === "undefined") return new Set<string>();
  const userId = await activeUserId();
  if (!userId) return new Set<string>();
  const items = (
    await (await database()).getAllFromIndex("queue", "entity", "apontamentos")
  ).filter((item) => item.userId === userId);
  return new Set(items.map((item) => item.recordId));
}
