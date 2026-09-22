import { supabase } from "@/integrations/supabase/client";
import type { ApontamentoComCliente, Cliente } from "@/lib/apontamentos";
import type { TotaisFinanceiros, ValorVigencia } from "@/lib/financeiro";
import { offlineCacheKeys, readCached, writeCached } from "@/lib/offline";
import type { ReportPartItem } from "@/lib/pdf-report";

export type AnexoDespesa = string | {
  tipo: "imagem" | "pdf";
  nome: string;
  conteudo: string;
};

export type DespesaRelatorio = {
  id: string;
  tipo?: "pedagio" | "hotel" | "alimentacao" | "combustivel" | "diversos";
  descricao: string;
  data?: string;
  valor: number;
  anexos?: AnexoDespesa[];
};

export type RelatorioSalvo = {
  id: string;
  numero_relatorio: string;
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
  observacao_relatorio: string;
  despesas_snapshot: DespesaRelatorio[];
  total_despesas: number;
  desconto: number;
  pagamento_status: PagamentoStatus;
  valor_recebido: number;
  data_recebimento: string | null;
  forma_pagamento: FormaPagamento | null;
  created_at: string;
  updated_at: string;
};

export function numeroRelatorio(id: string, date = new Date()) {
  const compactId = id.replaceAll("-", "").slice(0, 12).toUpperCase();
  return `RT-${date.getFullYear()}-${compactId}`;
}

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
  return Math.max(0, relatorio.total_geral - (relatorio.valor_recebido ?? 0));
}

function normalizeRelatorio(item: RelatorioSalvo): RelatorioSalvo {
  const recebido = Number(item.valor_recebido ?? 0);
  const despesas = Array.isArray(item.despesas_snapshot)
    ? item.despesas_snapshot.map((despesa) => ({
        ...despesa,
        tipo: despesa.tipo ?? ("diversos" as const),
        data: despesa.data ?? item.fim,
        anexos: Array.isArray(despesa.anexos)
          ? despesa.anexos.filter((anexo): anexo is AnexoDespesa =>
              typeof anexo === "string" || Boolean(anexo && typeof anexo === "object" && "tipo" in anexo && "conteudo" in anexo),
            )
          : [],
      }))
    : [];
  return {
    ...item,
    numero_relatorio: item.numero_relatorio || numeroRelatorio(item.id, new Date(item.created_at)),
    pagamento_status: statusPagamento(item.total_geral, recebido),
    valor_recebido: recebido,
    data_recebimento: item.data_recebimento ?? null,
    forma_pagamento: item.forma_pagamento ?? null,
    observacao_relatorio: item.observacao_relatorio ?? "",
    despesas_snapshot: despesas,
    total_despesas: Number(item.total_despesas ?? 0),
    desconto: Number(item.desconto ?? 0),
  };
}

export async function fetchRelatoriosSalvos(): Promise<RelatorioSalvo[]> {
  const { data, error } = await supabase
    .from("relatorios_salvos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    const cached = await readCached<RelatorioSalvo[]>(offlineCacheKeys.relatorios);
    if (cached) return cached.map(normalizeRelatorio);
    throw error;
  }
  const result = ((data ?? []) as unknown as RelatorioSalvo[]).map(normalizeRelatorio);
  await writeCached(offlineCacheKeys.relatorios, result);
  return result;
}