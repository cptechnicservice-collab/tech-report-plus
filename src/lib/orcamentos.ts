import { supabase } from "@/integrations/supabase/client";
import type { Cliente } from "@/lib/apontamentos";
import { offlineCacheKeys, readCached, writeCached } from "@/lib/offline";
import { cacheCompleteRecord, measureList, mergeListCache } from "@/lib/list-cache";
import { isRecordPending } from "@/lib/offline.queue";
import { fetchAllPages } from "@/lib/fetch-all-pages";

export type OrcamentoStatus = "rascunho" | "enviado" | "aprovado" | "recusado" | "aguardando_confirmacao" | "concluido";
export type DescontoTipo = "valor" | "percentual";
export type OrcamentoItemTipo = "produto" | "servico";
export type UnidadeOrcamento = "un" | "h" | "km" | "pç" | "cj";
export type FormaPagamentoOrcamento = "Pix" | "Boleto" | "Transferência" | "Dinheiro" | "Cartão";

export type OrcamentoItem = {
  id: string;
  user_id: string;
  orcamento_id: string;
  peca_id: string | null;
  tipo: OrcamentoItemTipo;
  nome: string;
  codigo: string | null;
  quantidade: number;
  unidade: UnidadeOrcamento;
  valor_unitario: number;
  foto_data_url: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export type Orcamento = {
  id: string;
  user_id: string;
  numero: string;
  cliente_id: string | null;
  cliente_snapshot: Cliente;
  data: string;
  validade_dias: number;
  desconto_tipo: DescontoTipo;
  desconto_valor: number;
  formas_pagamento: FormaPagamentoOrcamento[];
  condicoes_pagamento: string | null;
  observacoes: string | null;
  status: OrcamentoStatus;
  total_produtos: number;
  total_servicos: number;
  subtotal: number;
  total: number;
  created_at: string;
  updated_at: string;
  itens: OrcamentoItem[];
};

export const formasPagamentoOrcamento: FormaPagamentoOrcamento[] = ["Pix", "Boleto", "Transferência", "Dinheiro", "Cartão"];

export function calcularTotaisOrcamento(itens: Array<Pick<OrcamentoItem, "tipo" | "quantidade" | "valor_unitario">>, descontoTipo: DescontoTipo, descontoValor: number) {
  const produtos = itens.filter((item) => item.tipo === "produto").reduce((sum, item) => sum + item.quantidade * item.valor_unitario, 0);
  const servicos = itens.filter((item) => item.tipo === "servico").reduce((sum, item) => sum + item.quantidade * item.valor_unitario, 0);
  const subtotal = produtos + servicos;
  const desconto = descontoTipo === "percentual" ? subtotal * Math.min(100, descontoValor) / 100 : descontoValor;
  return { produtos, servicos, subtotal, desconto: Math.min(subtotal, desconto), total: Math.max(0, subtotal - desconto) };
}

export function proximoNumeroOrcamento(orcamentos: Orcamento[], date = new Date()) {
  const year = String(date.getFullYear()).slice(-2);
  const greatest = orcamentos.reduce((max, item) => {
    const match = item.numero.match(new RegExp(`^(\\d{1,4})-${year}$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${String(greatest + 1).padStart(4, "0")}-${year}`;
}

export async function fetchOrcamentos(): Promise<Orcamento[]> {
  const start = performance.now();
  try {
    const data = await fetchAllPages(() => supabase.from("orcamentos").select("*").order("data", { ascending: false }).order("id", { ascending: false }));
    measureList("orcamentos", data, start);
    const result = await mergeListCache(offlineCacheKeys.orcamentos, "orcamentos", data as unknown as Orcamento[]);
    return result.map((row) => ({ ...row, itens: [] }));
  } catch (error) {
    const cached = await readCached<Orcamento[]>(offlineCacheKeys.orcamentos);
    if (cached) return cached;
    throw error;
  }
}

export async function fetchOrcamento(id: string): Promise<Orcamento> {
  const cached = (await readCached<Orcamento[]>(offlineCacheKeys.orcamentos))?.find((item) => item.id === id);
  if (cached?.itens && await isRecordPending("orcamentos", id)) return cached;
  try {
    const { data, error } = await supabase.from("orcamentos").select("*, orcamento_itens(*)").eq("id", id).maybeSingle();
    if (error || !data) throw error ?? new Error("Orçamento não encontrado");
    const record = { ...data, itens: [...(data.orcamento_itens ?? [])].sort((a, b) => a.ordem - b.ordem) } as unknown as Orcamento;
    await cacheCompleteRecord(offlineCacheKeys.orcamentos, record);
    return record;
  } catch (error) {
    if (cached?.itens) return cached;
    throw error;
  }
}