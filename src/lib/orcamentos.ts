import { supabase } from "@/integrations/supabase/client";
import type { Cliente } from "@/lib/apontamentos";
import { offlineCacheKeys, readCached, writeCached } from "@/lib/offline";

export type OrcamentoStatus = "rascunho" | "enviado" | "aprovado" | "recusado";
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

export function itemOrcamentoSomado(item: Pick<OrcamentoItem, "tipo" | "unidade">) {
  return !(item.tipo === "servico" && item.unidade === "h");
}

export function calcularTotaisOrcamento(itens: Array<Pick<OrcamentoItem, "tipo" | "quantidade" | "unidade" | "valor_unitario">>, descontoTipo: DescontoTipo, descontoValor: number) {
  const produtos = itens.filter((item) => item.tipo === "produto").reduce((sum, item) => sum + item.quantidade * item.valor_unitario, 0);
  const servicos = itens.filter((item) => item.tipo === "servico" && itemOrcamentoSomado(item)).reduce((sum, item) => sum + item.quantidade * item.valor_unitario, 0);
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
  try {
    const { data, error } = await supabase.from("orcamentos").select("*, orcamento_itens(*)").order("data", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error;
    const result = (data ?? []).map((row) => ({ ...row, itens: [...(row.orcamento_itens ?? [])].sort((a, b) => a.ordem - b.ordem) })) as unknown as Orcamento[];
    await writeCached(offlineCacheKeys.orcamentos, result);
    return result;
  } catch (error) {
    const cached = await readCached<Orcamento[]>(offlineCacheKeys.orcamentos);
    if (cached) return cached;
    throw error;
  }
}