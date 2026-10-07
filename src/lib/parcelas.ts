import type { FormaPagamento, RelatorioSalvo } from "@/lib/relatorios";

export type Parcela = {
  id: string;
  numero: number;
  total: number;
  valor: number;
  vencimento: string;
  pago_em: string | null;
  forma_pagamento: FormaPagamento | null;
};

export type VencimentoInfo = {
  tipo: "pago" | "atrasado" | "hoje" | "breve" | "a_vencer";
  dias: number;
  label: string;
  className: string;
};

export function localTodayISO(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function addMonthsClamped(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function gerarParcelas(total: number, quantidade: number, primeiroVencimento: string): Parcela[] {
  const totalCentavos = Math.round(total * 100);
  const base = Math.floor(totalCentavos / quantidade);
  return Array.from({ length: quantidade }, (_, index) => ({
    id: crypto.randomUUID(),
    numero: index + 1,
    total: quantidade,
    valor: (index === quantidade - 1 ? totalCentavos - base * (quantidade - 1) : base) / 100,
    vencimento: addMonthsClamped(primeiroVencimento, index),
    pago_em: null,
    forma_pagamento: null,
  }));
}

export const somaParcelas = (parcelas: Parcela[]) => Math.round(parcelas.reduce((t, p) => t + p.valor, 0) * 100) / 100;

function diasEntre(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function vencimentoInfo(vencimento: string, pagoEm: string | null, hoje = localTodayISO()): VencimentoInfo {
  if (pagoEm) return { tipo: "pago", dias: 0, label: "Pago", className: "bg-success/15 text-success" };
  const dias = diasEntre(hoje, vencimento);
  if (dias < 0) return { tipo: "atrasado", dias: -dias, label: `Atrasado há ${-dias} dia${dias === -1 ? "" : "s"}`, className: "bg-destructive/15 text-destructive" };
  if (dias === 0) return { tipo: "hoje", dias, label: "Vence hoje", className: "bg-warning text-warning-foreground" };
  if (dias <= 3) return { tipo: "breve", dias, label: `Vence em ${dias} dia${dias === 1 ? "" : "s"}`, className: "bg-warning/20 text-warning-foreground" };
  return { tipo: "a_vencer", dias, label: "A vencer", className: "bg-info/15 text-info" };
}

/** Recebimentos derivados: parcelas próprias, ou um vencimento único previsto. */
export type RecebimentoItem = {
  relatorio: RelatorioSalvo;
  parcela: Parcela | null;
  label: string;
  valor: number;
  vencimento: string;
  info: VencimentoInfo;
};

export function recebimentosDoRelatorio(relatorio: RelatorioSalvo, hoje = localTodayISO()): RecebimentoItem[] {
  if (relatorio.parcelas.length > 0) {
    return relatorio.parcelas.map((parcela) => ({
      relatorio,
      parcela,
      label: `Parcela ${parcela.numero}/${parcela.total}`,
      valor: parcela.valor,
      vencimento: parcela.vencimento,
      info: vencimentoInfo(parcela.vencimento, parcela.pago_em, hoje),
    }));
  }
  if (!relatorio.data_pagamento_prevista) return [];
  const saldo = Math.max(0, relatorio.total_geral - relatorio.valor_recebido);
  return [{
    relatorio,
    parcela: null,
    label: "Pagamento único",
    valor: saldo > 0 ? saldo : relatorio.total_geral,
    vencimento: relatorio.data_pagamento_prevista,
    info: vencimentoInfo(relatorio.data_pagamento_prevista, saldo <= 0 ? (relatorio.data_recebimento ?? relatorio.data_pagamento_prevista) : null, hoje),
  }];
}

export function todosRecebimentos(relatorios: RelatorioSalvo[], hoje = localTodayISO()) {
  return relatorios.flatMap((r) => recebimentosDoRelatorio(r, hoje)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

export function urgentes(relatorios: RelatorioSalvo[]) {
  return todosRecebimentos(relatorios).filter((r) => r.info.tipo === "hoje" || r.info.tipo === "atrasado");
}

/** Aplica o pagamento de uma parcela, mantendo valor recebido e status derivados. */
export function relatorioComParcelas(relatorio: RelatorioSalvo, parcelas: Parcela[]): RelatorioSalvo {
  const pagas = parcelas.filter((p) => p.pago_em);
  const recebido = somaParcelas(pagas);
  const ultima = [...pagas].sort((a, b) => (b.pago_em ?? "").localeCompare(a.pago_em ?? ""))[0];
  return {
    ...relatorio,
    parcelas,
    valor_recebido: recebido,
    data_recebimento: ultima?.pago_em ?? null,
    forma_pagamento: ultima?.forma_pagamento ?? relatorio.forma_pagamento,
    pagamento_status: recebido <= 0 ? "pendente" : recebido >= relatorio.total_geral ? "pago" : "parcial",
  };
}
