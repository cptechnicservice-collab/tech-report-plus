import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, ChevronLeft, ChevronRight, CircleDollarSign, Gauge, HandCoins, MapPin, Timer } from "lucide-react";

import { PageShell, Section } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import {
  fetchApontamentos,
  fetchValores,
  formatDateBR,
  formatMinutes,
  somarTotais,
  todayISO,
} from "@/lib/apontamentos";
import { calcularValoresPeriodo, formatCurrency } from "@/lib/financeiro";
import { fetchRelatoriosSalvos, saldoRelatorio } from "@/lib/relatorios";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel mensal — CP TECHNIC Horas" },
      {
        name: "description",
        content:
          "Resumo mensal de horas trabalhadas, horas de viagem e quilometragem do técnico de campo.",
      },
      { property: "og:title", content: "Painel mensal — CP TECHNIC Horas" },
      {
        property: "og:description",
        content: "Apontamento diário de horas, viagens e km direto do iPhone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Resumo,
});

function Resumo() {
  const [mes, setMes] = useState(() => todayISO().slice(0, 7));
  const { data: apontamentos = [], isLoading } = useQuery({
    queryKey: ["apontamentos"],
    queryFn: fetchApontamentos,
  });
  const { data: valores = [] } = useQuery({ queryKey: ["valores"], queryFn: fetchValores });
  const { data: relatorios = [] } = useQuery({ queryKey: ["relatorios-salvos"], queryFn: fetchRelatoriosSalvos });

  const doMes = useMemo(
    () => apontamentos.filter((a) => a.data.startsWith(mes)),
    [apontamentos, mes],
  );
  const totais = somarTotais(doMes);
  const financeiro = calcularValoresPeriodo(doMes, valores);
  const ultimos = doMes.slice(0, 5);
  const relatoriosAbertos = relatorios.filter((item) => saldoRelatorio(item) > 0);
  const totalAReceber = relatoriosAbertos.reduce((total, item) => total + saldoRelatorio(item), 0);

  const moverMes = (diferenca: number) => {
    const [ano, numeroMes] = mes.split("-").map(Number);
    if (!ano || !numeroMes) return;
    const data = new Date(ano, numeroMes - 1 + diferenca, 1);
    setMes(`${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`);
  };

  const nomeMes = new Date(`${mes}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const periodo = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

  return (
    <PageShell title="Painel" subtitle="CP TECHNIC Horas">
      <section>
        <div className="flex h-12 items-center justify-between px-1">
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Mês anterior" onClick={() => moverMes(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="font-semibold">{periodo}</p>
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Próximo mês" onClick={() => moverMes(1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </section>

      <section className="rounded-2xl bg-brand-header p-5 text-brand-header-foreground shadow-nav">
        <p className="flex items-center gap-2 text-xs text-brand-header-foreground/65"><CircleDollarSign className="h-4 w-4" />Total do mês</p>
        <p className="mt-2 text-[2rem] font-bold leading-none tabular-nums">{formatCurrency(financeiro.totalGeral)}</p>
        <div className="mt-6 grid grid-cols-3 gap-2 text-xs">
          <div><p className="text-brand-header-foreground/55">Trabalho</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(financeiro.valorTrabalho)}</p></div>
          <div><p className="text-brand-header-foreground/55">Viagem</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(financeiro.valorViagem)}</p></div>
          <div><p className="text-brand-header-foreground/55">KM + Diárias</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(financeiro.valorKm + financeiro.valorDiarias)}</p></div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {[{ label: "Horas trab.", value: formatMinutes(totais.trabalho), icon: Timer }, { label: "Horas viagem", value: formatMinutes(totais.viagem), icon: MapPin }, { label: "KM rodados", value: String(totais.km), icon: Gauge }].map(({ label, value, icon: Icon }) => <div key={label} className="ios-group p-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-primary"><Icon className="h-4 w-4" /></span><p className="mt-3 text-[0.68rem] text-muted-foreground">{label}</p><p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p></div>)}
      </section>

      <Link to="/relatorios-salvos" search={{ status: "aberto" }} className="press ios-group flex items-center gap-4 p-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-highlight text-highlight-foreground"><HandCoins className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-muted-foreground">A receber</span><span className="mt-0.5 block text-xl font-bold tabular-nums">{formatCurrency(totalAReceber)}</span><span className="mt-1 block text-xs text-muted-foreground">{relatoriosAbertos.length} relatório(s) em aberto</span></span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>

      <Section title="Composição do valor">
        <dl className="-my-2 divide-y divide-border">
          {[
            ["Horas trabalhadas", financeiro.valorTrabalho],
            ["Horas de viagem", financeiro.valorViagem],
            ["Quilometragem", financeiro.valorKm],
            ["Diárias", financeiro.valorDiarias],
            ["Despesas", financeiro.pedagios + financeiro.outrasDespesas],
          ].map(([label, valor]) => (
            <div key={String(label)} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-semibold tabular-nums">{formatCurrency(Number(valor))}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Button asChild className="h-14 w-full rounded-2xl text-base">
        <Link to="/novo" search={{ data: undefined, cliente: undefined, servico: undefined, agenda: undefined, orcamento: undefined }}>
          <CalendarPlus className="mr-2 h-5 w-5" /> Novo apontamento
        </Link>
      </Button>

      <Section title="Últimos apontamentos" hint={`${doMes.length} no mês`}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : ultimos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum apontamento ainda. Toque em “Novo apontamento” para começar.
          </p>
        ) : (
          <ul className="-my-1 divide-y divide-border">
            {ultimos.map((a) => (
              <li key={a.id}>
                <Link
                  to="/apontamento/$id"
                  params={{ id: a.id }}
                  className="press flex min-h-16 items-center gap-3 py-2.5"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                    <Timer className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {a.clientes?.nome ?? "—"}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {formatDateBR(a.data)}
                    </span>
                  </span>
                  <span className="ml-auto shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums">{formatMinutes(somarTotais([a]).trabalho)}</span>
                    <ChevronRight className="ml-auto mt-0.5 h-4 w-4 text-muted-foreground" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PageShell>
  );
}
