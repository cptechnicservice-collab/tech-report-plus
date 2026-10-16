import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";

import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { formatDateBR, todayISO } from "@/lib/apontamentos";
import { formatCurrency } from "@/lib/financeiro";
import { todosRecebimentos, type RecebimentoItem } from "@/lib/parcelas";
import { fetchRelatoriosSalvos } from "@/lib/relatorios";

export const Route = createFileRoute("/_authenticated/previsao-recebimentos")({
  head: () => ({
    meta: [
      { title: "Previsão de recebimentos — CP TECHNIC Horas" },
      { name: "description", content: "Valores previstos de parcelas e recebimentos por mês." },
      { property: "og:title", content: "Previsão de recebimentos — CP TECHNIC Horas" },
      { property: "og:description", content: "Previsão mensal privada da CP TECHNIC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrevisaoRecebimentos,
});

function LinhaRecebimento({ item }: { item: RecebimentoItem }) {
  return (
    <li>
      <Link to="/relatorios-salvos" search={{ abrir: item.relatorio.id }} className="press flex min-h-14 items-center gap-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{item.relatorio.cliente_nome}</span>
          <span className="block text-xs text-muted-foreground">
            {item.label} · vence {formatDateBR(item.vencimento)}
          </span>
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

function PrevisaoRecebimentos() {
  const [mes, setMes] = useState(() => todayISO().slice(0, 7));
  const { data: relatorios = [] } = useQuery({ queryKey: ["relatorios-salvos"], queryFn: fetchRelatoriosSalvos });

  const pendentes = useMemo(
    () => todosRecebimentos(relatorios).filter((item) => item.info.tipo !== "pago"),
    [relatorios],
  );

  const doMes = pendentes.filter((item) => item.vencimento.startsWith(mes));
  const totalMes = doMes.reduce((total, item) => total + item.valor, 0);

  const proximosMeses = useMemo(() => {
    const grupos = new Map<string, number>();
    pendentes.forEach((item) => {
      const chave = item.vencimento.slice(0, 7);
      grupos.set(chave, (grupos.get(chave) ?? 0) + item.valor);
    });
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 6);
  }, [pendentes]);

  const moverMes = (diferenca: number) => {
    const [ano, numeroMes] = mes.split("-").map(Number);
    if (!ano || !numeroMes) return;
    const data = new Date(ano, numeroMes - 1 + diferenca, 1);
    setMes(`${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`);
  };

  const mesLabel = new Date(`${mes}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <PageShell title="Previsão de recebimentos" subtitle="O que entra em cada mês" backTo="/resumos">
      <section className="ios-group p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl" aria-label="Mês anterior" onClick={() => moverMes(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="text-sm font-semibold capitalize">{mesLabel}</p>
          <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl" aria-label="Próximo mês" onClick={() => moverMes(1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground">
          <CalendarClock className="h-6 w-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs opacity-80">Total previsto para o mês</p>
            <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalMes)}</p>
          </div>
          <p className="shrink-0 text-xs opacity-80">{doMes.length} recebimento{doMes.length === 1 ? "" : "s"}</p>
        </div>
      </section>

      <section className="ios-group p-4">
        <h2 className="text-sm font-semibold">Recebimentos do mês</h2>
        {doMes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma parcela ou pagamento previsto para este mês.</p>
        ) : (
          <ul className="divide-y divide-border">{doMes.map((item) => <LinhaRecebimento key={`${item.relatorio.id}-${item.parcela?.id ?? "unico"}`} item={item} />)}</ul>
        )}
      </section>

      <section className="ios-group p-4">
        <h2 className="text-sm font-semibold">Próximos meses</h2>
        {proximosMeses.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum valor pendente com vencimento futuro.</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {proximosMeses.map(([chave, valor]) => (
              <li key={chave}>
                <button type="button" onClick={() => setMes(chave)} className="press flex min-h-12 w-full items-center gap-3 py-2 text-left">
                  <span className="min-w-0 flex-1 text-sm font-medium capitalize">
                    {new Date(`${chave}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{formatCurrency(valor)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
