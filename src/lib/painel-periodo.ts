import { saldoRelatorio, relatoriosConfirmados } from "@/lib/relatorios";

export type EscalaPainel = "mes" | "ano";

export function chavePeriodoPainel(mes: string, escala: EscalaPainel) {
  return escala === "ano" ? mes.slice(0, 4) : mes;
}

export function registrosDoPeriodo<T extends { data: string }>(registros: T[], periodo: string): T[] {
  return registros.filter((registro) => registro.data.startsWith(periodo));
}

// Usa a data final do atendimento, assim como a tela Resumos, não o vencimento.
export function saldoDoPeriodo(
  relatorios: Array<{ fim: string; total_geral: number; valor_recebido: number; status_relatorio?: string | null }>,
  periodo: string,
) {
  return relatoriosConfirmados(relatorios)
    .filter((relatorio) => relatorio.fim.startsWith(periodo))
    .reduce((total, relatorio) => total + saldoRelatorio(relatorio), 0);
}