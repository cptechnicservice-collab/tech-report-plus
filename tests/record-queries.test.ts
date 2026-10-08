import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), readCached: vi.fn(), writeCached: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/lib/offline", () => ({
  offlineCacheKeys: { apontamentos: "apontamentos", clientes: "clientes", relatorios: "relatorios", pecas: "pecas" },
  readCached: mocks.readCached, writeCached: mocks.writeCached,
}));
import { fetchApontamentos, fetchClientes } from "@/lib/apontamentos";
import { fetchRelatoriosSalvos } from "@/lib/relatorios";
import { fetchPecas } from "@/lib/pecas";

beforeEach(() => { vi.clearAllMocks(); mocks.readCached.mockResolvedValue(undefined); });

describe("Listas completas e cache offline", () => {
  test.each([
    ["apontamentos", fetchApontamentos], ["clientes", fetchClientes],
    ["relatorios_salvos", fetchRelatoriosSalvos], ["pecas", fetchPecas],
  ] as const)("%s busca todas as 2.500 linhas", async (table, fetch) => {
    const rows = Array.from({ length: 2500 }, (_, id) => ({
      id: String(id), nome: String(id), created_at: "2026-01-01", total_geral: 100,
      despesas_snapshot: [{ id: "despesa", valor: 10, descricao: "Hotel", anexos: ["data:image/png;base64,TESTE"] }],
      cliente_snapshot: { nome: "Cliente" }, apontamentos_snapshot: [{ id: "apontamento" }],
      valores_snapshot: [{ id: "tarifa" }], pecas_snapshot: [{ id: "peca" }], financeiro_snapshot: { totalGeral: 100 },
    }));
    const range = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
    const query = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockReturnThis(), range };
    mocks.from.mockReturnValue(query);
    const result = await fetch();
    expect(result).toHaveLength(2500);
    expect(result.map((item) => item.id)).toEqual(rows.map((item) => item.id));
    expect(range.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(mocks.from).toHaveBeenCalledWith(table);
    expect(query.order).toHaveBeenCalledWith("id", { ascending: table === "clientes" || table === "pecas" });
    expect(mocks.writeCached).toHaveBeenCalledTimes(1);
    expect(mocks.writeCached.mock.calls[0]?.[1]).toEqual(result);
    if (table === "pecas") expect(query.abortSignal).toHaveBeenCalledTimes(3);
    if (table === "relatorios_salvos") {
      expect(result[2499]).toMatchObject({
        cliente_snapshot: rows[2499]?.cliente_snapshot,
        apontamentos_snapshot: rows[2499]?.apontamentos_snapshot,
        pecas_snapshot: rows[2499]?.pecas_snapshot,
        despesas_snapshot: [{ anexos: ["data:image/png;base64,TESTE"] }],
      });
    }
  });
  test.each([fetchApontamentos, fetchClientes, fetchRelatoriosSalvos, fetchPecas])("falha intermediária mantém o cache anterior", async (fetch) => {
    const range = vi.fn().mockResolvedValueOnce({ data: Array(1000).fill({ id: "partial" }), error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("Conexão interrompida") });
    mocks.from.mockReturnValue({ select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), abortSignal: vi.fn().mockReturnThis(), range });
    mocks.readCached.mockResolvedValue([{ id: "cached", nome: "Cliente", created_at: "2026-01-01" }]);
    const result = await fetch();
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("cached");
    expect(mocks.writeCached).not.toHaveBeenCalled();
  });
});