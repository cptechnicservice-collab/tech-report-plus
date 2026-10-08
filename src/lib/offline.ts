// Public compatibility facade; generic modules never import this facade.
export type { OfflineEntity, Entity, QueueAction, QueueItem } from "./offline.types";
export { readCached, writeCached, queryPersister, clearOfflineUserData, offlineCacheKeys } from "./offline.cache";
export { pendingCount, getQueueItems, isRecordPending, getOfflineQueueStatus, retryQueueItem, discardQueueItem, getPendingRecordIds, subscribeOfflineStatus, getPendingApontamentoIds } from "./offline.queue";
export { syncOfflineQueue } from "./offline.sync";
export { isNetworkError } from "./offline.utils";
export * from "./offline.records";
