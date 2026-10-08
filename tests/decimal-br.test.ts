import { describe, expect, test } from "vitest";
import { isDecimalBRInput, parseDecimalBR } from "@/lib/decimal-br";
import { apontamentoValidationSchema } from "@/lib/apontamento-validation";

describe("Entrada decimal sem milhares", () => {
  test.each(["1.250", "1.234,50", "-1", "texto", "NaN", "Infinity", "  "])("rejeita %s", (value) => {
    expect(isDecimalBRInput(value)).toBe(false);
    expect(parseDecimalBR(value)).toBeNaN();
  });
  test("preserva vazio, decimais e estados intermediários da máscara", () => {
    expect(parseDecimalBR("")).toBeNull();
    expect(isDecimalBRInput("")).toBe(true);
    expect(parseDecimalBR("1234,50")).toBe(1234.5);
    expect(parseDecimalBR("1250")).toBe(1250);
    expect(parseDecimalBR("1.25")).toBe(1.25);
    expect(parseDecimalBR(",5")).toBe(0.5);
    expect(parseDecimalBR("1,")).toBe(1);
    expect(isDecimalBRInput(",")).toBe(true);
    expect(parseDecimalBR(",")).toBeNaN();
  });
});

describe("Validação compartilhada das despesas do apontamento", () => {
  test.each(["pedagio", "outras_despesas"])("valida %s", (field) => {
    for (const value of [NaN, Infinity, -Infinity, -1]) {
      const result = apontamentoValidationSchema.safeParse({ [field]: value });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.path).toEqual([field]);
    }
    for (const value of [undefined, null, 0, 1234.5]) {
      expect(apontamentoValidationSchema.safeParse({ [field]: value }).success).toBe(true);
    }
  });
  test("não exige despesas nem remove os campos legados de odômetro", () => {
    expect(apontamentoValidationSchema.parse({ km_inicial: 100, km_final: 101 })).toEqual({ km_inicial: 100, km_final: 101 });
  });
});