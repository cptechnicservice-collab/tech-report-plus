import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/financeiro";
import { gerarParcelas, type Parcela } from "@/lib/parcelas";

export type ParcelaEditavel = Omit<Parcela, "valor"> & { valor: string };

export type ParcelamentoState = {
  parcelar: boolean;
  quantidade: number;
  primeiro: string;
  parcelas: ParcelaEditavel[];
  dataPrevista: string;
};

const toNumber = (value: string) => Number(value.replace(",", ".")) || 0;
export const parcelasDoEstado = (state: ParcelamentoState): Parcela[] =>
  state.parcelas.map((p) => ({ ...p, valor: Math.round(toNumber(p.valor) * 100) / 100 }));

export function regenerar(state: ParcelamentoState, total: number): ParcelamentoState {
  if (!state.primeiro) return state;
  const novas = gerarParcelas(total, state.quantidade, state.primeiro).map((p, index) => {
    const anterior = state.parcelas[index];
    return {
      ...p,
      id: anterior?.id ?? p.id,
      pago_em: anterior?.pago_em ?? null,
      forma_pagamento: anterior?.forma_pagamento ?? null,
      valor: p.valor.toFixed(2).replace(".", ","),
    };
  });
  return { ...state, parcelas: novas };
}

export function ParcelamentoEditor({ total, value, onChange }: { total: number; value: ParcelamentoState; onChange: (next: ParcelamentoState) => void }) {
  const soma = Math.round(value.parcelas.reduce((t, p) => t + toNumber(p.valor), 0) * 100) / 100;
  const diferenca = Math.round((total - soma) * 100) / 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-sm font-semibold">Parcelar?</p><p className="text-xs text-muted-foreground">Mensal, no mesmo dia do 1º vencimento</p></div>
        <Switch aria-label="Parcelar" checked={value.parcelar} onCheckedChange={(checked) => onChange(checked ? regenerar({ ...value, parcelar: true }, total) : { ...value, parcelar: false })} />
      </div>
      {!value.parcelar ? (
        <div className="space-y-1.5"><Label htmlFor="pagamento-previsto">Data de pagamento prevista</Label><Input id="pagamento-previsto" type="date" value={value.dataPrevista} onChange={(event) => onChange({ ...value, dataPrevista: event.target.value })} className="h-12 rounded-xl" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label htmlFor="parcelas-qtd">Nº de parcelas</Label><select id="parcelas-qtd" value={value.quantidade} onChange={(event) => onChange(regenerar({ ...value, quantidade: Number(event.target.value) }, total))} className="ios-field h-11 w-full border px-3">{Array.from({ length: 23 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>{n}x</option>)}</select></div>
            <div className="space-y-1"><Label htmlFor="parcelas-primeiro">Data do 1º vencimento</Label><Input id="parcelas-primeiro" type="date" value={value.primeiro} onChange={(event) => onChange(regenerar({ ...value, primeiro: event.target.value }, total))} className="h-11 rounded-xl" /></div>
          </div>
          {value.parcelas.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-border p-3">
              {value.parcelas.map((parcela, index) => (
                <div key={parcela.id} className="grid grid-cols-[3rem_minmax(0,1fr)_6.5rem] items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">{parcela.numero}/{parcela.total}</span>
                  <Input aria-label={`Vencimento da parcela ${parcela.numero}`} type="date" disabled={Boolean(parcela.pago_em)} value={parcela.vencimento} onChange={(event) => onChange({ ...value, parcelas: value.parcelas.map((p, i) => i === index ? { ...p, vencimento: event.target.value } : p) })} className="h-10 rounded-xl px-2" />
                  <Input aria-label={`Valor da parcela ${parcela.numero}`} inputMode="decimal" disabled={Boolean(parcela.pago_em)} value={parcela.valor} onChange={(event) => { const v = event.target.value; if (/^\d*[,.]?\d{0,2}$/.test(v)) onChange({ ...value, parcelas: value.parcelas.map((p, i) => i === index ? { ...p, valor: v } : p) }); }} className="h-10 rounded-xl text-right tabular-nums" />
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold"><span>Soma</span><span className="tabular-nums">{formatCurrency(soma)}</span></div>
              {diferenca !== 0 ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-destructive/10 px-2 py-2 text-xs font-medium text-destructive">
                  <span>A soma difere do total ({formatCurrency(total)}) em {formatCurrency(Math.abs(diferenca))}.</span>
                  <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 rounded-lg" onClick={() => onChange(regenerar(value, total))}><RefreshCw className="mr-1 h-3.5 w-3.5" />Recalcular</Button>
                </div>
              ) : null}
            </div>
          ) : <p className="text-xs text-muted-foreground">Escolha a data do 1º vencimento para ver as parcelas.</p>}
        </>
      )}
    </div>
  );
}
