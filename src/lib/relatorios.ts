import { supabase } from "@/integrations/supabase/client";
import type { ApontamentoComCliente, Cliente } from "@/lib/apontamentos";
import type { TotaisFinanceiros, ValorVigencia } from "@/lib/financeiro";
import { offlineCacheKeys, readCached, writeCached } from "@/lib/offline";
import type { ReportPartItem } from "@/lib/pdf-report";

export type RelatorioSalvo = {
  id: string;
  user_id: string;
  cliente_id: string | null;
  cliente_nome: string;
  inicio: string;
  fim: string;
  total_servicos: number;
  total_pecas: number;
  total_geral: number;
  cliente_snapshot: Cliente;
  apontamentos_snapshot: ApontamentoComCliente[];
  valores_snapshot: ValorVigencia[];
  pecas_snapshot: ReportPartItem[];
  financeiro_snapshot: TotaisFinanceiros;
  pagamento_status: PagamentoStatus;
  valor_recebido: number;
  data_recebimento: string | null;
  forma_pagamento: FormaPagamento | null;
  created_at: string;
  updated_at: string;
};

export type PagamentoStatus = "pendente" | "parcial" | "pago";
export type FormaPagamento = "pix" | "transferencia" | "dinheiro" | "boleto" | "outro";

export const formasPagamento: Array<{ value: FormaPagamento; label: string }> = [
  { value: "pix", label: "Pix" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "boleto", label: "Boleto" },
  { value: "outro", label: "Outro" },
];

export function statusPagamento(total: number, recebido: number): PagamentoStatus {
  if (recebido <= 0) return "pendente";
  return recebido >= total ? "pago" : "parcial";
}

export function saldoRelatorio(relatorio: Pick<RelatorioSalvo, "total_geral" | "valor_recebido">) {
  return Math.max(0, relatorio.total_geral - relatorio.valor_recebido);
}

export async function fetchRelatoriosSalvos(): Promise<RelatorioSalvo[]> {
  const { data, error } = await supabase
    .from("relatorios_salvos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    const cached = await readCached<RelatorioSalvo[]>(offlineCacheKeys.relatorios);
    if (cached) return cached;
    throw error;
  }
  const result = (data ?? []) as unknown as RelatorioSalvo[];
  await writeCached(offlineCacheKeys.relatorios, result);
  return result;
}