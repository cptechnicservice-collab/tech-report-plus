import { beforeEach, describe, expect, test, vi } from "vitest";
import type { RelatorioSalvo } from "@/lib/relatorios";

const mocks = vi.hoisted(() => ({ readCached: vi.fn(), writeCached: vi.fn(), enqueue: vi.fn(), isOffline: vi.fn(), from: vi.fn(), upsert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/lib/offline.cache", () => ({ readCached: mocks.readCached, writeCached: mocks.writeCached }));
vi.mock("@/lib/offline.queue", () => ({ enqueue: mocks.enqueue, requireUserId: async () => "test-user" }));
vi.mock("@/lib/offline.utils", () => ({ isOffline: mocks.isOffline, isNetworkError: () => false, timeoutSignal: () => AbortSignal.timeout(1000) }));
import { saveRelatorioOffline } from "@/lib/offline.records";

beforeEach(() => { vi.clearAllMocks(); });

describe("Salvamento a partir de um relatório completo da lista", () => {
  test.each([true, false])("preserva snapshots e anexos; offline=%s", async (offline) => {
    // Isolated fixtures and clients: never authenticate or write real records.
    const report = {
      id: "report-test", numero_relatorio: "RT-TEST", cliente_nome: "Cliente teste",
      inicio: "2026-01-01", fim: "2026-01-01", total_servicos: 90, total_pecas: 10, total_geral: 100,
      cliente_snapshot: { id: "cliente-test", nome: "Cliente teste" },
      apontamentos_snapshot: [{ id: "apontamento-test" }], valores_snapshot: [{ id: "tarifa-test" }],
      pecas_snapshot: [{ id: "peca-test", foto_data_url: "data:image/png;base64,FOTO" }],
      financeiro_snapshot: { totalGeral: 100 },
      despesas_snapshot: [{ id: "despesa-test", descricao: "Hotel", valor: 10, anexos: ["data:image/png;base64,IMAGEM", { tipo: "pdf", nome: "comprovante.pdf", conteudo: "data:application/pdf;base64,PDF" }] }],
      created_at: "2026-01-01T00:00:00Z",
    } as unknown as RelatorioSalvo;
    mocks.readCached.mockResolvedValue([report]);
    mocks.isOffline.mockReturnValue(offline);
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.upsert.mockReturnValue({ abortSignal: async () => ({ error: null }) });
    const changed = { ...report, valor_recebido: 25, status_relatorio: "concluido" as const, observacao_relatorio: "Atualizado" };
    const result = await saveRelatorioOffline(changed);
    const stored = offline ? mocks.enqueue.mock.calls[0]?.[0]?.payload : mocks.upsert.mock.calls[0]?.[0];
    for (const key of ["cliente_snapshot", "apontamentos_snapshot", "valores_snapshot", "pecas_snapshot", "financeiro_snapshot", "despesas_snapshot"] as const) {
      expect(stored[key]).toEqual(report[key]);
      expect(result.record[key]).toEqual(report[key]);
      expect(mocks.writeCached.mock.calls[0]?.[1]?.[0]?.[key]).toEqual(report[key]);
    }
    expect(result.queued).toBe(offline);
    expect(stored).toMatchObject({ valor_recebido: 25, status_relatorio: "concluido", observacao_relatorio: "Atualizado" });
    if (offline) expect(mocks.from).not.toHaveBeenCalled();
    else expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});