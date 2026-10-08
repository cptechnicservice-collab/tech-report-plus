import { describe, expect, test } from "vitest";
import { numeroRelatorio, saldoRelatorio, statusPagamento } from "@/lib/relatorios";

describe("Situação financeira", () => {
  test.each([[100, 0, "pendente"], [100, -1, "pendente"], [100, 50, "parcial"], [100, 100, "pago"], [100, 120, "pago"]])("total %s, recebido %s => %s", (total, recebido, status) => {
    expect(statusPagamento(Number(total), Number(recebido))).toBe(status);
  });
  test("saldo nunca fica negativo", () => {
    expect(saldoRelatorio({ total_geral: 100, valor_recebido: 25 })).toBe(75);
    expect(saldoRelatorio({ total_geral: 100, valor_recebido: 125 })).toBe(0);
  });
});

describe("Número do relatório", () => {
  test("mantém o formato público e é determinístico para id/data", () => {
    const date = new Date(2026, 0, 1);
    expect(numeroRelatorio("abc12345-6789-4000-8000-123456789012", date)).toBe("RT-2026-ABC123456789");
    expect(numeroRelatorio("abc12345-6789-4000-8000-123456789012", date)).toBe(numeroRelatorio("abc12345-6789-4000-8000-123456789012", date));
    expect(numeroRelatorio("def12345-6789-4000-8000-123456789012", date)).not.toBe(numeroRelatorio("abc12345-6789-4000-8000-123456789012", date));
  });
});