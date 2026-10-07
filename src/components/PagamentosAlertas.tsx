import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, BellRing, ChevronRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/apontamentos";
import { formatCurrency } from "@/lib/financeiro";
import { localTodayISO, todosRecebimentos, urgentes, type RecebimentoItem } from "@/lib/parcelas";
import type { RelatorioSalvo } from "@/lib/relatorios";

const BANNER_KEY = "cp-technic-aviso-pagamentos";

function Linha({ item }: { item: RecebimentoItem }) {
  return (
    <li>
      <Link to="/relatorios-salvos" search={{ abrir: item.relatorio.id }} className="press flex min-h-14 items-center gap-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{item.relatorio.cliente_nome}</span>
          <span className="block text-xs text-muted-foreground">{item.label} · {formatDateBR(item.vencimento)}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-bold tabular-nums">{formatCurrency(item.valor)}</span>
          <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${item.info.className}`}>{item.info.label}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

export function PagamentosCard({ relatorios }: { relatorios: RelatorioSalvo[] }) {
  const abertos = todosRecebimentos(relatorios).filter((r) => r.info.tipo !== "pago");
  const grupos = [
    { titulo: "Atrasados", itens: abertos.filter((r) => r.info.tipo === "atrasado") },
    { titulo: "Vencendo hoje", itens: abertos.filter((r) => r.info.tipo === "hoje") },
    { titulo: "Próximos 7 dias", itens: abertos.filter((r) => r.info.tipo !== "atrasado" && r.info.tipo !== "hoje" && r.info.dias <= 7) },
  ];
  const vazio = grupos.every((g) => g.itens.length === 0);
  return (
    <section className="ios-group p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-warning/20 text-warning-foreground"><BellRing className="h-5 w-5" /></span>
        <div><h2 className="text-sm font-semibold">Pagamentos</h2><p className="text-xs text-muted-foreground">Vencimentos de parcelas e previsões</p></div>
      </div>
      {vazio ? <p className="mt-3 text-sm text-muted-foreground">Nenhum vencimento atrasado ou nos próximos 7 dias.</p> : grupos.filter((g) => g.itens.length).map((g) => (
        <div key={g.titulo} className="mt-3">
          <p className={`text-xs font-semibold uppercase ${g.titulo === "Atrasados" ? "text-destructive" : "text-muted-foreground"}`}>{g.titulo} · {g.itens.length}</p>
          <ul className="divide-y divide-border">{g.itens.slice(0, 5).map((item) => <Linha key={`${item.relatorio.id}-${item.parcela?.id ?? "unico"}`} item={item} />)}</ul>
        </div>
      ))}
    </section>
  );
}

/** Banner único por dia e notificação local quando há vencimento hoje ou atraso. */
export function PagamentosBanner({ relatorios }: { relatorios: RelatorioSalvo[] }) {
  const [visivel, setVisivel] = useState(false);
  const lista = urgentes(relatorios);
  const hoje = localTodayISO();

  useEffect(() => {
    if (!lista.length || window.localStorage.getItem(BANNER_KEY) === hoje) return;
    setVisivel(true);
    window.localStorage.setItem(BANNER_KEY, hoje);
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        const atrasados = lista.filter((r) => r.info.tipo === "atrasado").length;
        const body = `${lista.length - atrasados} vencendo hoje · ${atrasados} atrasado(s)`;
        void navigator.serviceWorker?.ready.then((reg) => reg.showNotification("CP TECHNIC — Pagamentos", { body, icon: "/app-icon.png", tag: `pagamentos-${hoje}` })).catch(() => undefined);
      }
    } catch { /* Notificação local é opcional. */ }
  }, [lista.length, hoje]);

  if (!visivel || !lista.length) return null;
  const atrasados = lista.filter((r) => r.info.tipo === "atrasado").length;
  const podeAtivar = typeof window !== "undefined" && "Notification" in window && Notification.permission === "default";
  return (
    <div role="status" className="fixed inset-x-3 top-[max(env(safe-area-inset-top),0.75rem)] z-50 mx-auto max-w-md rounded-2xl border border-destructive/30 bg-card p-3 shadow-nav">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Pagamentos que pedem atenção</p>
          <p className="text-xs text-muted-foreground">{lista.length - atrasados} vencendo hoje · {atrasados} atrasado(s)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild size="sm" className="h-9 rounded-lg"><Link to="/relatorios-salvos" search={{ vencimento: atrasados ? "atrasado" : "hoje" }} onClick={() => setVisivel(false)}>Ver</Link></Button>
            {podeAtivar ? <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => void Notification.requestPermission()}>Ativar notificações</Button> : null}
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl" aria-label="Dispensar aviso" onClick={() => setVisivel(false)}><X className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
