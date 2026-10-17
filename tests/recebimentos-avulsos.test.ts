import { beforeEach, expect, test, vi } from "vitest";
import type { RecebimentoAvulso } from "@/lib/recebimentos-avulsos";
const mocks = vi.hoisted(() => ({ readCached: vi.fn(), writeCached: vi.fn(), enqueue: vi.fn(), getQueueItems: vi.fn(), isOffline: vi.fn(), from: vi.fn(), upsert: vi.fn(), range: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/lib/offline.cache", () => ({ readCached: mocks.readCached, writeCached: mocks.writeCached }));
vi.mock("@/lib/offline.queue", () => ({ enqueue: mocks.enqueue, getQueueItems: mocks.getQueueItems, requireUserId: async () => "user-test" }));
vi.mock("@/lib/offline.utils", () => ({ isOffline: mocks.isOffline, isNetworkError: (e: unknown) => e instanceof Error && e.message === "Failed to fetch", timeoutSignal: () => AbortSignal.timeout(1000) }));
import { deleteRecebimentoAvulsoOffline, fetchRecebimentosAvulsos, recebimentoAvulsoSchema, saveRecebimentoAvulsoOffline, totalRecebimentosAvulsos } from "@/lib/recebimentos-avulsos";
import { saldoRelatorio, statusPagamento } from "@/lib/relatorios";

const input = { id: "11111111-1111-4111-8111-111111111111", cliente_id: "22222222-2222-4222-8222-222222222222", valor: 125.5, data_recebimento: "2026-10-17", forma_pagamento: "pix", observacao: "Entrada independente" };
const receipt: RecebimentoAvulso = { ...input, user_id: "user-test", created_at: "2026-10-17T12:00:00Z", updated_at: "2026-10-17T12:00:00Z" };
beforeEach(() => { vi.clearAllMocks(); mocks.readCached.mockResolvedValue([]); mocks.getQueueItems.mockResolvedValue([]); mocks.isOffline.mockReturnValue(false); });

test.each([0, -1, NaN, Infinity])("valor deve ser finito e maior que zero: %s", (valor) => {
  expect(recebimentoAvulsoSchema.safeParse({ ...input, valor }).success).toBe(false);
});
test("cliente e data válidos são obrigatórios", () => {
  expect(recebimentoAvulsoSchema.safeParse({ ...input, cliente_id: "" }).success).toBe(false);
  expect(recebimentoAvulsoSchema.safeParse({ ...input, data_recebimento: "2026-02-30" }).success).toBe(false);
  expect(recebimentoAvulsoSchema.safeParse(input).success).toBe(true);
});
test("totais mensais, anuais e por cliente usam a data do recebimento", () => {
  const items = [receipt, { ...receipt, id: "two", valor: 50, data_recebimento: "2026-11-01" }, { ...receipt, id: "three", cliente_id: "other", valor: 25, data_recebimento: "2025-10-17" }];
  expect(totalRecebimentosAvulsos(items, { periodo: "2026-10" })).toBe(125.5);
  expect(totalRecebimentosAvulsos(items, { periodo: "2026" })).toBe(175.5);
  expect(totalRecebimentosAvulsos(items, { clienteId: input.cliente_id })).toBe(175.5);
});
test("entrada extra não abate o saldo nem muda o status do relatório", async () => {
  const report = { total_geral: 1000, valor_recebido: 200 };
  mocks.isOffline.mockReturnValue(true);
  await saveRecebimentoAvulsoOffline(input);
  expect(saldoRelatorio(report)).toBe(800);
  expect(statusPagamento(report.total_geral, report.valor_recebido)).toBe("parcial");
  expect(mocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({ entity: "recebimentos_avulsos", action: "upsert", payload: expect.objectContaining({ valor: 125.5, user_id: "user-test" }) }));
  expect(mocks.from).not.toHaveBeenCalled();
});
test("edição offline preserva id e substitui o valor no cache", async () => {
  mocks.isOffline.mockReturnValue(true); mocks.readCached.mockResolvedValue([receipt]);
  await saveRecebimentoAvulsoOffline({ ...input, valor: 250 });
  expect(mocks.writeCached).toHaveBeenCalledWith("recebimentos-avulsos", [expect.objectContaining({ id: input.id, valor: 250, created_at: receipt.created_at })]);
});
test("exclusão offline usa a fila sem tocar relatórios", async () => {
  mocks.isOffline.mockReturnValue(true); mocks.readCached.mockResolvedValue([receipt]);
  await deleteRecebimentoAvulsoOffline(input.id);
  expect(mocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({ entity: "recebimentos_avulsos", action: "delete", recordId: input.id, userId: "user-test" }));
  expect(mocks.writeCached).toHaveBeenCalledWith("recebimentos-avulsos", []);
  expect(mocks.from).not.toHaveBeenCalled();
});
test("salvamento online e falha de rede mantêm o mesmo id", async () => {
  mocks.from.mockReturnValue({ upsert: mocks.upsert });
  mocks.upsert.mockReturnValue({ abortSignal: async () => ({ error: null }) });
  expect((await saveRecebimentoAvulsoOffline(input)).queued).toBe(false);
  expect(mocks.from).toHaveBeenCalledWith("recebimentos_avulsos");
  expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: input.id, valor: 125.5 }), { onConflict: "id" });
  mocks.upsert.mockReturnValue({ abortSignal: async () => { throw new Error("Failed to fetch"); } });
  expect((await saveRecebimentoAvulsoOffline(input)).queued).toBe(true);
});
test("busca online não ressuscita exclusões nem sobrescreve edições pendentes", async () => {
  const deleted = { ...receipt, id: "deleted" };
  mocks.readCached.mockResolvedValue([{ ...receipt, valor: 300 }]);
  mocks.getQueueItems.mockResolvedValue([{ entity: "recebimentos_avulsos", action: "upsert", recordId: receipt.id }, { entity: "recebimentos_avulsos", action: "delete", recordId: deleted.id }]);
  const query = { select: () => query, order: () => query, abortSignal: () => query, range: mocks.range };
  mocks.from.mockReturnValue(query); mocks.range.mockResolvedValue({ data: [receipt, deleted], error: null });
  expect(await fetchRecebimentosAvulsos()).toEqual([expect.objectContaining({ id: receipt.id, valor: 300 })]);
});
test("cache está disponível offline sem consulta de rede", async () => {
  mocks.isOffline.mockReturnValue(true); mocks.readCached.mockResolvedValue([receipt]);
  expect(await fetchRecebimentosAvulsos()).toEqual([receipt]);
  expect(mocks.from).not.toHaveBeenCalled();
});