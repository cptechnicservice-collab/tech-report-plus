import { describe, expect, test } from "vitest";
import { calcularValoresPeriodo, valorVigente, type ValorVigencia } from "@/lib/financeiro";
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