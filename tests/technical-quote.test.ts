import { describe, expect, it } from "vitest";
import { technicalQuoteRates } from "@/lib/pdf-technical-quote";
import type { ValorVigencia } from "@/lib/financeiro";

describe("technical quote rates", () => {
  const date = "2026-10-22";
  it.each([[0, 170], [1, 120], [2, 2], [3, 60], [4, 60], [5, 300]])("uses default for row %i", (row, amount) => {
    expect(technicalQuoteRates([], date)[row]?.[2]).toBe(amount);
  });
  it("uses current work/travel/km rates without converting daily allowances into meals or hotel", () => {
    const rates = { vigencia: "2026-10-01", created_at: "2026-10-01", valor_hora_trabalhada: 190, valor_hora_viagem: 130, valor_km: 3, valor_diaria_inteira: 999, valor_meia_diaria: 888 } as ValorVigencia;
    expect(technicalQuoteRates([rates], date).map((row) => row[2])).toEqual([190, 130, 3, 60, 60, 300]);
    expect(technicalQuoteRates([{ ...rates, vigencia: "2026-11-01" }], date)[0][2]).toBe(170);
  });
});