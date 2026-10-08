import { describe, expect, test, vi } from "vitest";
import { fetchAllPages } from "@/lib/fetch-all-pages";

describe("Consultas paginadas completas", () => {
  test("retorna 2.500 linhas ordenadas de um cliente mockado", async () => {
    const rows = Array.from({ length: 2500 }, (_, id) => ({ id }));
    const range = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
    const query = vi.fn(() => ({ range }));
    expect(await fetchAllPages(query)).toEqual(rows);
    expect(range.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(query).toHaveBeenCalledTimes(3);
  });
  test("consulta a página vazia quando o total é múltiplo de mil", async () => {
    const rows = Array.from({ length: 1000 }, (_, id) => id);
    const range = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
    expect(await fetchAllPages(() => ({ range }))).toEqual(rows);
    expect(range).toHaveBeenCalledTimes(2);
  });
  test("não retorna resultado parcial quando uma página falha", async () => {
    const error = new Error("Falha de rede");
    const range = vi.fn().mockResolvedValueOnce({ data: Array(1000).fill({ id: 1 }), error: null }).mockResolvedValueOnce({ data: null, error });
    await expect(fetchAllPages(() => ({ range }))).rejects.toBe(error);
  });
  test("lista vazia", async () => {
    expect(await fetchAllPages(() => ({ range: async () => ({ data: null, error: null }) }))).toEqual([]);
  });
});