import type { DBSchema } from "idb";
export type OfflineEntity =
  | "clientes"
  | "apontamentos"
  | "apontamento_pecas"
  | "valores_vigencia"
  | "agendamentos"
  | "pecas"
  | "relatorios_salvos"
  | "dados_empresa"
  | "orcamentos"
  | "orcamento_itens";
export type Entity = OfflineEntity;
export type QueueAction = "upsert" | "delete";

export type QueueItem = {
  queueId?: number;
  entity: Entity;
  action: QueueAction;
  recordId: string;
  payload?: Record<string, unknown>;
  createdAt: number;
  attempts?: number;
  lastError?: string;
  nextAttemptAt?: number;
  userId: string;
};

export interface OfflineDB extends DBSchema {
  cache: { key: string; value: unknown };
  queue: { key: number; value: QueueItem; indexes: { entity: Entity } };
}
