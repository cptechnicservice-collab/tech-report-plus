import { describe, expect, test } from "vitest";
import { calcularValoresPeriodo, linhasRefeicoes, valorVigente, type ValorVigencia } from "@/lib/financeiro";
import { calcularTotaisOrcamento } from "@/lib/orcamentos";

const tarifa = (vigencia: string, hora: number, created_at = "2026-01-01"): ValorVigencia => ({
  id: vigencia, vigencia, valor_hora_trabalhada: hora, valor_hora_viagem: 50,
  valor_km: 2, valor_diaria_inteira: 100, valor_meia_diaria: 50,
  created_at, updated_at: created_at, user_id: null,
});

describe("Tarifas e totais financeiros", () => {
  test("vigência pela data, desempate por criação, sem mudar a lista", () => {
    const valores = [tarifa("2026-02-01", 200), tarifa("2026-01-01", 100), tarifa("2026-02-01", 210, "2026-02-02")];
    expect(valorVigente("2025-12-31", valores)).toBeNull();
    expect(valorVigente("2026-01-31", valores)?.valor_hora_trabalhada).toBe(100);
    expect(valorVigente("2026-02-01", valores)?.valor_hora_trabalhada).toBe(210);
    expect(valores[0]?.valor_hora_trabalhada).toBe(200);
  });
  test("soma trabalho noturno, viagem, km, diárias e despesas", () => {
    const total = calcularValoresPeriodo([
      { data: "2026-01-31", trabalho_inicio: "23:00", trabalho_fim: "02:00", intervalo_inicio: "00:00", intervalo_fim: "00:30", viagem_ida_saida: "22:00", viagem_ida_chegada: "23:00", km_ida: 10, km_volta: 10, diaria_tipo: "inteira", pedagio: 10, outras_despesas: 5 },
      { data: "2026-02-01", trabalho_inicio: "08:00", trabalho_fim: "09:00", diaria_tipo: "meia" },
    ], [tarifa("2026-01-01", 100), tarifa("2026-02-01", 200)]);
    expect(total).toMatchObject({ horasTrabalhadas: 210, horasViagem: 60, km: 20, valorTrabalho: 450, valorViagem: 50, valorKm: 40, diariasInteiras: 1, meiasDiarias: 1, valorDiariasInteiras: 100, valorMeiasDiarias: 50, valorDiarias: 150, pedagios: 10, outrasDespesas: 5, totalGeral: 705 });
  });
  test("lista vazia e ausência de tarifas preservam despesas", () => {
    expect(calcularValoresPeriodo([], []).totalGeral).toBe(0);
    expect(calcularValoresPeriodo([{ data: "2026-01-01", pedagio: 10, outras_despesas: 5 }], []).totalGeral).toBe(15);
  });
  test("despesas antigas não finitas não contaminam os totais", () => {
    const result = calcularValoresPeriodo([
      { pedagio: NaN, outras_despesas: Infinity },
      { pedagio: -Infinity, outras_despesas: NaN },
      { pedagio: 10, outras_despesas: 5 },
    ], []);
    expect(result.pedagios).toBe(10);
    expect(result.outrasDespesas).toBe(5);
    expect(result.totalGeral).toBe(15);
    expect(calcularValoresPeriodo([{ pedagio: -2 }], []).totalGeral).toBe(-2);
  });
});

describe("Descontos do orçamento", () => {
  const itens = [{ tipo: "produto" as const, quantidade: 2, valor_unitario: 100 }, { tipo: "servico" as const, quantidade: 1.5, valor_unitario: 100 }];
  test("separa produtos/serviços e aplica desconto fixo", () => {
    expect(calcularTotaisOrcamento(itens, "valor", 50)).toEqual({ produtos: 200, servicos: 150, subtotal: 350, desconto: 50, total: 300 });
  });
  test("percentual e limites não deixam o total negativo", () => {
    expect(calcularTotaisOrcamento(itens, "percentual", 10).total).toBe(315);
    expect(calcularTotaisOrcamento(itens, "percentual", 150).total).toBe(0);
    expect(calcularTotaisOrcamento(itens, "valor", 999).desconto).toBe(350);
    expect(calcularTotaisOrcamento([], "valor", 10).total).toBe(0);
  });
});

describe("Almoço e janta das diárias", () => {
  const fin = (inteiras: number, meias: number, valorInteiras: number, valorMeias: number) => ({ diariasInteiras: inteiras, meiasDiarias: meias, valorDiariasInteiras: valorInteiras, valorMeiasDiarias: valorMeias });
  const tarifaRef = { valor_diaria_inteira: 120, valor_meia_diaria: 60 };

  test("inteira cobre almoço e janta; meia cobre só almoço, preservando o total", () => {
    const linhas = linhasRefeicoes(fin(2, 1, 240, 60), tarifaRef);
    expect(linhas).toEqual([
      { descricao: "Almoço (alimentação)", quantidade: 3, unitario: 60, total: 180 },
      { descricao: "Janta (alimentação)", quantidade: 2, unitario: 60, total: 120 },
    ]);
    expect(linhas.reduce((soma, linha) => soma + linha.total, 0)).toBe(300);
  });

  test("sem meias, o almoço vem da vigência e a janta completa a inteira", () => {
    const linhas = linhasRefeicoes(fin(1, 0, 150, 0), tarifaRef);
    expect(linhas.map((linha) => [linha.descricao, linha.unitario, linha.total])).toEqual([
      ["Almoço (alimentação)", 60, 60],
      ["Janta (alimentação)", 90, 90],
    ]);
  });

  test("sem vigência e sem meias, divide a diária em duas refeições iguais", () => {
    expect(linhasRefeicoes(fin(1, 0, 150, 0), null).map((linha) => linha.unitario)).toEqual([75, 75]);
  });

  test("só meias mostra só almoço; dados inconsistentes caem no fallback de diárias", () => {
    expect(linhasRefeicoes(fin(0, 1, 0, 60), tarifaRef)).toEqual([
      { descricao: "Almoço (alimentação)", quantidade: 1, unitario: 60, total: 60 },
    ]);
    expect(linhasRefeicoes(fin(1, 1, 100, 150), tarifaRef)).toEqual([]);
    expect(linhasRefeicoes(fin(0, 0, 0, 0), tarifaRef)).toEqual([]);
  });
});