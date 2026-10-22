import { beforeEach, expect, test, vi } from "vitest";
import type { Lembrete } from "@/lib/lembretes";
const mocks = vi.hoisted(() => ({ readCached: vi.fn(), writeCached: vi.fn(), enqueue: vi.fn(), getQueueItems: vi.fn(), isOffline: vi.fn(), from: vi.fn(), upsert: vi.fn(), range: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/lib/offline.cache", () => ({ readCached: mocks.readCached, writeCached: mocks.writeCached }));
vi.mock("@/lib/offline.queue", () => ({ enqueue: mocks.enqueue, getQueueItems: mocks.getQueueItems, requireUserId: async () => "user-test" }));
vi.mock("@/lib/offline.utils", () => ({ isOffline: mocks.isOffline, isNetworkError: (e: unknown) => e instanceof Error && e.message === "Failed to fetch", timeoutSignal: () => AbortSignal.timeout(1000) }));
import { deleteLembreteOffline, fetchLembretes, lembreteSchema, saveLembreteOffline, ordenarLembretes } from "@/lib/lembretes";


const input = { id: "11111111-1111-4111-8111-111111111111", titulo: "Fazer nota fiscal — Incolar", data_prevista: "2026-10-22", concluido: false };
const receipt: Lembrete = { ...input, user_id: "user-test", created_at: "2026-10-17T12:00:00Z", updated_at: "2026-10-17T12:00:00Z" };
beforeEach(() => { vi.clearAllMocks(); mocks.readCached.mockResolvedValue([]); mocks.getQueueItems.mockResolvedValue([]); mocks.isOffline.mockReturnValue(false); });
test("lembrete permite nota fiscal da Incolar sem data", () => {
  expect(lembreteSchema.parse({ ...input, data_prevista: null }).titulo).toBe("Fazer nota fiscal — Incolar");
  expect(lembreteSchema.safeParse({ ...input, titulo: " " }).success).toBe(false);
  expect(lembreteSchema.safeParse({ ...input, data_prevista: "2026-02-30" }).success).toBe(false);
});
test("concluir e reabrir offline preservam a tarefa e data", async () => {
  mocks.isOffline.mockReturnValue(true); mocks.readCached.mockResolvedValue([receipt]);
  await saveLembreteOffline({ ...input, concluido: true });
  expect(mocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({ entity: "lembretes", payload: expect.objectContaining({ titulo: input.titulo, data_prevista: "2026-10-22", concluido: true, user_id: "user-test" }) }));
  await saveLembreteOffline({ ...input, concluido: false });
  expect(mocks.writeCached).toHaveBeenLastCalledWith("lembretes", [expect.objectContaining({ concluido: false })]);
  expect(mocks.from).not.toHaveBeenCalled();
});
test("pendentes por data vêm antes dos concluídos", () => {
  const items = [{ ...receipt, id: "done", concluido: true, data_prevista: "2026-10-01" }, { ...receipt, id: "undated", data_prevista: null }, { ...receipt, id: "next", data_prevista: "2026-10-23" }, receipt];
  expect(ordenarLembretes(items).map(item => item.id)).toEqual([input.id, "next", "undated", "done"]);
  expect(items[0]?.id).toBe("done");
});
test("edição offline preserva id e substitui a descrição no cache", async () => {
  mocks.isOffline.mockReturnValue(true); mocks.readCached.mockResolvedValue([receipt]);
  await saveLembreteOffline({ ...input, titulo: "Revisar máquina" });
  expect(mocks.writeCached).toHaveBeenCalledWith("lembretes", [expect.objectContaining({ id: input.id, titulo: "Revisar máquina", created_at: receipt.created_at })]);
});
test("exclusão offline usa a fila com isolamento por usuário", async () => {
  mocks.isOffline.mockReturnValue(true); mocks.readCached.mockResolvedValue([receipt]);
  await deleteLembreteOffline(input.id);
  expect(mocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({ entity: "lembretes", action: "delete", recordId: input.id, userId: "user-test" }));
  expect(mocks.writeCached).toHaveBeenCalledWith("lembretes", []);
  expect(mocks.from).not.toHaveBeenCalled();
});
test("salvamento online e falha de rede mantêm o mesmo id", async () => {
  mocks.from.mockReturnValue({ upsert: mocks.upsert });
  mocks.upsert.mockReturnValue({ abortSignal: async () => ({ error: null }) });
  expect((await saveLembreteOffline(input)).queued).toBe(false);
  expect(mocks.from).toHaveBeenCalledWith("lembretes");
  expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: input.id, titulo: input.titulo }), { onConflict: "id" });
  mocks.upsert.mockReturnValue({ abortSignal: async () => { throw new Error("Failed to fetch"); } });
  expect((await saveLembreteOffline(input)).queued).toBe(true);
});
test("busca online não ressuscita exclusões nem sobrescreve edições pendentes", async () => {
  const deleted = { ...receipt, id: "deleted" };
  mocks.readCached.mockResolvedValue([{ ...receipt, titulo: "Revisar máquina" }]);
  mocks.getQueueItems.mockResolvedValue([{ entity: "lembretes", action: "upsert", recordId: receipt.id }, { entity: "lembretes", action: "delete", recordId: deleted.id }]);
  const query = { select: () => query, order: () => query, abortSignal: () => query, range: mocks.range };
  mocks.from.mockReturnValue(query); mocks.range.mockResolvedValue({ data: [receipt, deleted], error: null });
  expect(await fetchLembretes()).toEqual([expect.objectContaining({ id: receipt.id, titulo: "Revisar máquina" })]);
});
test("cache está disponível offline sem consulta de rede", async () => {
  mocks.isOffline.mockReturnValue(true); mocks.readCached.mockResolvedValue([receipt]);
  expect(await fetchLembretes()).toEqual([receipt]);
  expect(mocks.from).not.toHaveBeenCalled();
});