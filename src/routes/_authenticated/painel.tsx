import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarPlus, ChevronRight, CircleDollarSign, Gauge, MapPin, Timer } from "lucide-react";

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
  const { data: apontamentos = [], isLoading } = useQuery({
    queryKey: ["apontamentos"],
    queryFn: fetchApontamentos,
  });
  const { data: valores = [] } = useQuery({ queryKey: ["valores"], queryFn: fetchValores });

  const mes = todayISO().slice(0, 7);
  const doMes = useMemo(
    () => apontamentos.filter((a) => a.data.startsWith(mes)),
    [apontamentos, mes],
  );
  const totais = somarTotais(doMes);
  const financeiro = calcularValoresPeriodo(doMes, valores);
  const ultimos = apontamentos.slice(0, 5);

  const nomeMes = new Date(`${mes}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const periodo = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

  return (
    <PageShell title="Painel" subtitle="CP TECHNIC Horas">
      <div className="ios-group flex items-center justify-between p-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase text-muted-foreground">Período</p>
          <p className="mt-0.5 text-base font-medium">{periodo}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <CalendarDays className="h-5 w-5" />
        </span>
      </div>

      <div className="grid gap-3">
        <div className="ios-group p-5">
          <div className="flex items-center gap-2 text-primary">
            <CircleDollarSign className="h-5 w-5" />
            <p className="text-xs font-semibold uppercase">Valor acumulado</p>
          </div>
          <p className="mt-2 text-[2rem] font-bold leading-none tabular-nums">{formatCurrency(financeiro.totalGeral)}</p>
          <p className="mt-2 text-xs text-muted-foreground">Atualizado com os dados disponíveis, inclusive offline</p>
        </div>
        <div className="ios-group p-5">
          <div className="flex items-center gap-2 text-primary">
            <Timer className="h-5 w-5" />
            <p className="text-xs font-semibold uppercase">Horas trabalhadas</p>
          </div>
          <p className="mt-2 text-[2rem] font-bold leading-none tabular-nums">{formatMinutes(totais.trabalho)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="ios-group p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary">
              <MapPin className="h-5 w-5 text-muted-foreground" />
            </span>
            <p className="mt-3 text-xs font-medium text-muted-foreground">
              Viagem
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums">{formatMinutes(totais.viagem)}</p>
          </div>
          <div className="ios-group p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary">
              <Gauge className="h-5 w-5 text-muted-foreground" />
            </span>
            <p className="mt-3 text-xs font-medium text-muted-foreground">
              KM rodados
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums">{totais.km}</p>
          </div>
        </div>
      </div>

      <Button asChild className="h-14 w-full rounded-2xl text-base">
        <Link to="/novo">
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
