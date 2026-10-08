import { describe, expect, test } from "vitest";
import { gerarParcelas, somaParcelas, vencimentoInfo, relatorioComParcelas, recebimentosDoRelatorio, todosRecebimentos, localTodayISO } from "@/lib/parcelas";
import type { RelatorioSalvo } from "@/lib/relatorios";

const relatorio = (overrides: Partial<RelatorioSalvo> = {}): RelatorioSalvo => ({
  id: "report", numero_relatorio: "RT-2026-TEST", user_id: "test", cliente_id: null, cliente_nome: "Teste",
  inicio: "2026-01-01", fim: "2026-01-31", total_servicos: 100, total_pecas: 0, total_geral: 100,
  cliente_snapshot: { id: "client", nome: "Teste", cidade: "", cnpj: null, contato: null, telefone: null, ativo: true, observacoes: null, created_at: "", updated_at: "", user_id: "test" },
  apontamentos_snapshot: [], valores_snapshot: [], pecas_snapshot: [],
  financeiro_snapshot: { horasTrabalhadas: 0, horasViagem: 0, km: 0, diariasInteiras: 0, meiasDiarias: 0, valorTrabalho: 0, valorViagem: 0, valorKm: 0, valorDiariasInteiras: 0, valorMeiasDiarias: 0, valorDiarias: 0, pedagios: 0, outrasDespesas: 0, totalGeral: 100 },
  observacao_relatorio: "", despesas_snapshot: [], total_despesas: 0, desconto: 0, status_relatorio: "concluido", pagamento_status: "pendente", valor_recebido: 0, data_recebimento: null, forma_pagamento: null, source_orcamento_id: null, parcelas: [], data_pagamento_prevista: null, created_at: "", updated_at: "", ...overrides,
});

describe("Parcelamento", () => {
  test("última parcela absorve centavos, sem perder o dia original", () => {
    const parcelas = gerarParcelas(100, 3, "2026-01-31");
    expect(parcelas.map(p => p.valor)).toEqual([33.33, 33.33, 33.34]);
    expect(parcelas.map(p => p.vencimento)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(somaParcelas(parcelas)).toBe(100);
    expect(new Set(parcelas.map(p => p.id)).size).toBe(3);
  });
  test("ano bissexto, mudança de ano e 24 parcelas", () => {
    expect(gerarParcelas(10, 2, "2024-01-31")[1]?.vencimento).toBe("2024-02-29");
    expect(gerarParcelas(10, 2, "2026-12-15")[1]?.vencimento).toBe("2027-01-15");
    expect(somaParcelas(gerarParcelas(9552.50, 24, "2026-10-31"))).toBe(9552.50);
  });
  test("pagamentos recalculam recebido, saldo e situação sem mudar o operacional", () => {
    const parcelas = gerarParcelas(100, 2, "2026-01-31");
    const parcial = relatorioComParcelas(relatorio(), parcelas.map((p, i) => i === 0 ? { ...p, pago_em: "2026-02-01", forma_pagamento: "pix" } : p));
    expect(parcial).toMatchObject({ valor_recebido: 50, pagamento_status: "parcial", status_relatorio: "concluido", data_recebimento: "2026-02-01", forma_pagamento: "pix" });
    const pago = relatorioComParcelas(parcial, parcelas.map(p => ({ ...p, pago_em: "2026-03-01", forma_pagamento: "dinheiro" })));
    expect(pago.pagamento_status).toBe("pago");
    expect(pago.valor_recebido).toBe(100);
    expect(relatorioComParcelas(pago, parcelas).pagamento_status).toBe("pendente");
  });
});

describe("Vencimentos e recebimentos", () => {
  test.each([["2026-01-09", "atrasado"], ["2026-01-10", "hoje"], ["2026-01-13", "breve"], ["2026-01-14", "a_vencer"]])("%s => %s", (date, tipo) => {
    expect(vencimentoInfo(date, null, "2026-01-10").tipo).toBe(tipo);
  });
  test("pago prevalece sobre atraso e mostra dias corretamente", () => {
    expect(vencimentoInfo("2026-01-01", "2026-01-02", "2026-01-10").tipo).toBe("pago");
    expect(vencimentoInfo("2026-01-08", null, "2026-01-10").label).toBe("Atrasado há 2 dias");
    expect(localTodayISO(new Date(2026, 0, 10, 12))).toBe("2026-01-10");
  });
  test("deriva pagamento único ou parcelas e ordena pelo vencimento", () => {
    expect(recebimentosDoRelatorio(relatorio())).toEqual([]);
    expect(recebimentosDoRelatorio(relatorio({ data_pagamento_prevista: "2026-01-15", valor_recebido: 25 }), "2026-01-10")[0]?.valor).toBe(75);
    const parcelas = gerarParcelas(100, 2, "2026-01-31");
    const lista = todosRecebimentos([relatorio({ parcelas }), relatorio({ data_pagamento_prevista: "2026-01-15" })], "2026-01-10");
    expect(lista.map(i => i.label)).toEqual(["Pagamento único", "Parcela 1/2", "Parcela 2/2"]);
  });
});