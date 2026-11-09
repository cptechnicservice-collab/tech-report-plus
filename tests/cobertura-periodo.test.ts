import { describe, expect, test } from "vitest";
import { coberturaPeriodo, duracaoEntre } from "@/lib/cobertura-periodo";

describe("Duração entre datas", () => {
  test("mesmo dia conta um dia", () => {
    expect(duracaoEntre("2026-05-04", "2026-05-04")).toBe("1 dia");
  });
  test("menos de um mês conta dias", () => {
    expect(duracaoEntre("2026-05-01", "2026-05-10")).toBe("10 dias");
  });
  test("mês cheio no plural e no singular", () => {
    expect(duracaoEntre("2026-01-01", "2026-02-01")).toBe("1 mês");
    expect(duracaoEntre("2026-01-01", "2026-08-01")).toBe("7 meses");
  });
  test("ano cheio e ano com meses", () => {
    expect(duracaoEntre("2025-01-01", "2026-01-01")).toBe("1 ano");
    expect(duracaoEntre("2025-03-12", "2026-11-08")).toBe("1 ano e 7 meses");
    expect(duracaoEntre("2023-01-01", "2026-01-01")).toBe("3 anos");
  });
  test("datas invertidas dão a mesma duração", () => {
    expect(duracaoEntre("2026-11-08", "2025-03-12")).toBe("1 ano e 7 meses");
  });
});

describe("Cobertura de um total", () => {
  test("sem relatórios não há período", () => {
    expect(coberturaPeriodo([])).toBeNull();
  });
  test("usa a primeira e a última data do conjunto", () => {
    const cobertura = coberturaPeriodo([
      { inicio: "2025-06-10", fim: "2025-06-12" },
      { inicio: "2025-03-12", fim: "2025-03-20" },
      { inicio: "2026-10-01", fim: "2026-11-08" },
    ]);
    expect(cobertura?.inicio).toBe("2025-03-12");
    expect(cobertura?.fim).toBe("2026-11-08");
    expect(cobertura?.relatorios).toBe(3);
    expect(cobertura?.intervalo).toBe("12/03/2025 a 08/11/2026");
    expect(cobertura?.frase).toBe(
      "Total de 3 relatórios de 12/03/2025 a 08/11/2026 — 1 ano e 7 meses",
    );
  });
  test("um relatório usa o singular", () => {
    const cobertura = coberturaPeriodo([{ inicio: "2026-05-01", fim: "2026-05-09" }]);
    expect(cobertura?.frase).toBe("Total de 1 relatório de 01/05/2026 a 09/05/2026 — 9 dias");
  });
  test("ignora registros sem data válida", () => {
    const cobertura = coberturaPeriodo([
      { inicio: "", fim: "" },
      { inicio: "2026-01-05", fim: "2026-01-06" },
    ]);
    expect(cobertura?.relatorios).toBe(1);
  });
});
