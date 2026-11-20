import { supabase } from "@/integrations/supabase/client";
import type { ApontamentoComCliente, Cliente } from "@/lib/apontamentos";
import type { TotaisFinanceiros, ValorVigencia } from "@/lib/financeiro";
import { offlineCacheKeys, readCached, writeCached } from "@/lib/offline";
import type { ReportPartItem } from "@/lib/pdf-report";
import type { Parcela } from "@/lib/parcelas";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { cacheCompleteRecord, measureList, mergeListCache } from "@/lib/list-cache";
import { isRecordPending } from "@/lib/offline.queue";

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
  status_relatorio: StatusRelatorio;
  pagamento_status: PagamentoStatus;
  valor_recebido: number;
  data_recebimento: string | null;
  forma_pagamento: FormaPagamento | null;
  source_orcamento_id: string | null;
  parcelas: Parcela[];
  data_pagamento_prevista: string | null;
  created_at: string;
  updated_at: string;
};

export function numeroRelatorio(id: string, date = new Date()) {
  const compactId = id.replaceAll("-", "").slice(0, 12).toUpperCase();
  return `RT-${date.getFullYear()}-${compactId}`;
}

export type PagamentoStatus = "pendente" | "parcial" | "pago";
export type FormaPagamento = "pix" | "transferencia" | "dinheiro" | "boleto" | "outro";
export type StatusRelatorio = "orcamento_nao_confirmado" | "pendente" | "aguardando_pagamento" | "concluido";

export const statusRelatorioOptions: Array<{ value: StatusRelatorio; label: string }> = [
  { value: "pendente", label: "Pendente" },
  { value: "aguardando_pagamento", label: "Aguardando pagamento" },
  { value: "concluido", label: "Concluído" },
  { value: "orcamento_nao_confirmado", label: "Orçamento não confirmado" },
];

/** Orçamentos não confirmados ficam fora de totais, avisos e cobranças até virarem Pendente. */
export function relatoriosConfirmados<T extends { status_relatorio?: string | null }>(items: T[]): T[] {
  return items.filter((item) => item.status_relatorio !== "orcamento_nao_confirmado");
}

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
    source_orcamento_id: item.source_orcamento_id ?? null,
    parcelas: Array.isArray(item.parcelas) ? item.parcelas : [],
    data_pagamento_prevista: item.data_pagamento_prevista ?? null,
    observacao_relatorio: item.observacao_relatorio ?? "",
    despesas_snapshot: despesas,
    total_despesas: Number(item.total_despesas ?? 0),
    desconto: Number(item.desconto ?? 0),
    status_relatorio: item.status_relatorio ?? "pendente",
  };
}

export type RelatorioResumo = Omit<RelatorioSalvo, "cliente_snapshot" | "apontamentos_snapshot" | "valores_snapshot" | "pecas_snapshot" | "financeiro_snapshot" | "despesas_snapshot" | "observacao_relatorio">;
export const RELATORIO_LIST_COLUMNS = "id,numero_relatorio,user_id,cliente_id,cliente_nome,inicio,fim,total_servicos,total_pecas,total_geral,total_despesas,desconto,status_relatorio,pagamento_status,valor_recebido,data_recebimento,forma_pagamento,source_orcamento_id,parcelas,data_pagamento_prevista,created_at,updated_at";

function resumo(item: RelatorioResumo): RelatorioResumo {
  return { ...item, numero_relatorio: item.numero_relatorio || numeroRelatorio(item.id, new Date(item.created_at)), valor_recebido: Number(item.valor_recebido ?? 0), pagamento_status: statusPagamento(item.total_geral, Number(item.valor_recebido ?? 0)), parcelas: item.parcelas ?? [], status_relatorio: item.status_relatorio ?? "pendente" };
}

export async function fetchRelatoriosSalvos(): Promise<RelatorioResumo[]> {
  const start = performance.now();
  try {
    const data = await fetchAllPages(() => supabase
      .from("relatorios_salvos")
      .select(RELATORIO_LIST_COLUMNS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }));
    measureList("relatorios_salvos", data, start);
    const result = await mergeListCache(offlineCacheKeys.relatorios, "relatorios_salvos", data as unknown as RelatorioResumo[]);
    // Return only projected fields, even when the offline cache holds complete documents.
    return result.map((item) => resumo(Object.fromEntries(RELATORIO_LIST_COLUMNS.split(",").map((key) => [key, item[key as keyof RelatorioResumo]])) as RelatorioResumo));
  } catch (error) {
    const cached = await readCached<RelatorioSalvo[]>(offlineCacheKeys.relatorios);
    if (cached) return cached.map((item) => resumo(Object.fromEntries(RELATORIO_LIST_COLUMNS.split(",").map((key) => [key, item[key as keyof RelatorioResumo]])) as RelatorioResumo));
    throw error;
  }
}

export async function fetchRelatorioSalvo(id: string): Promise<RelatorioSalvo> {
  const cached = (await readCached<RelatorioSalvo[]>(offlineCacheKeys.relatorios))?.find((item) => item.id === id);
  const complete = cached && Array.isArray(cached.apontamentos_snapshot) && cached.cliente_snapshot && cached.financeiro_snapshot;
  if (complete && await isRecordPending("relatorios_salvos", id)) return normalizeRelatorio(cached);
  try {
    const { data, error } = await supabase.from("relatorios_salvos").select("*").eq("id", id).single();
    if (error) throw error;
    const record = normalizeRelatorio(data as unknown as RelatorioSalvo);
    await cacheCompleteRecord(offlineCacheKeys.relatorios, record);
    return record;
  } catch (error) {
    if (complete) return normalizeRelatorio(cached);
    throw error;
  }
}