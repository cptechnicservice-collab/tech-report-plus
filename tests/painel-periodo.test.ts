import { describe, expect, test } from "vitest";
import { chavePeriodoPainel, registrosDoPeriodo, saldoDoPeriodo } from "@/lib/painel-periodo";
import { somarTotais } from "@/lib/apontamentos";

const registros = [
  { data: "2026-10-10", trabalho_inicio: "08:00", trabalho_fim: "10:00", viagem_ida_saida: "07:00", viagem_ida_chegada: "08:00", km_ida: 20, km_volta: 20 },
  { data: "2026-11-10", trabalho_inicio: "08:00", trabalho_fim: "11:00", viagem_ida_saida: "07:00", viagem_ida_chegada: "07:30", km_ida: 10, km_volta: 10 },
  { data: "2025-10-10", trabalho_inicio: "08:00", trabalho_fim: "12:00", km_ida: 100, km_volta: 100 },
];
const relatorios = [
  { fim: "2026-10-31", total_geral: 1000, valor_recebido: 200 },
  { fim: "2026-11-01", total_geral: 500, valor_recebido: 100 },
  { fim: "2025-10-31", total_geral: 2000, valor_recebido: 0 },
  { fim: "2026-10-20", total_geral: 9000, valor_recebido: 0, status_relatorio: "orcamento_nao_confirmado" },
];

describe("Resumo do Painel por período", () => {
  test("mês soma somente horas, viagem e KM do mês mostrado", () => {
    const periodo = chavePeriodoPainel("2026-10", "mes");
    const totais = somarTotais(registrosDoPeriodo(registros, periodo));
    expect(totais.trabalho).toBe(120);
    expect(totais.viagem).toBe(60);
    expect(totais.km).toBe(40);
  });
  test("ano soma os meses do ano selecionado sem incluir outros anos", () => {
    const periodo = chavePeriodoPainel("2026-10", "ano");
    const totais = somarTotais(registrosDoPeriodo(registros, periodo));
    expect(totais.trabalho).toBe(300);
    expect(totais.viagem).toBe(90);
    expect(totais.km).toBe(60);
  });
  test("a receber segue o mês do atendimento, sem orçamentos não confirmados", () => {
    expect(saldoDoPeriodo(relatorios, "2026-10")).toBe(800);
    expect(saldoDoPeriodo(relatorios, "2026-11")).toBe(400);
  });
  test("a receber anual soma apenas os saldos do ano mostrado", () => {
    expect(saldoDoPeriodo(relatorios, "2026")).toBe(1200);
  });
});