import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Gauge, MapPin, Timer } from "lucide-react";

import { PageShell, Section } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import {
  fetchApontamentos,
  formatDateBR,
  formatMinutes,
  somarTotais,
  todayISO,
} from "@/lib/apontamentos";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CP TECHNIC Horas — resumo do mês" },
      {
        name: "description",
        content:
          "Resumo mensal de horas trabalhadas, horas de viagem e quilometragem do técnico de campo.",
      },
      { property: "og:title", content: "CP TECHNIC Horas — resumo do mês" },
      {
        property: "og:description",
        content: "Apontamento diário de horas, viagens e km direto do iPhone.",
      },
    ],
  }),
  component: Resumo,
});

function Resumo() {
  const { data: apontamentos = [], isLoading } = useQuery({
    queryKey: ["apontamentos"],
    queryFn: fetchApontamentos,
  });

  const mes = todayISO().slice(0, 7);
  const doMes = useMemo(
    () => apontamentos.filter((a) => a.data.startsWith(mes)),
    [apontamentos, mes],
  );
  const totais = somarTotais(doMes);
  const ultimos = apontamentos.slice(0, 5);

  const nomeMes = new Date(`${mes}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <PageShell title="CP TECHNIC Horas" subtitle={`Período: ${nomeMes}`}>
      <div className="grid gap-3">
        <div className="card-surface flex items-center gap-4 p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <Timer className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Horas trabalhadas
            </p>
            <p className="text-2xl font-semibold tabular-nums">{formatMinutes(totais.trabalho)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="card-surface p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary">
              <MapPin className="h-5 w-5 text-muted-foreground" />
            </span>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Viagem
            </p>
            <p className="text-xl font-semibold tabular-nums">{formatMinutes(totais.viagem)}</p>
          </div>
          <div className="card-surface p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary">
              <Gauge className="h-5 w-5 text-muted-foreground" />
            </span>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              KM rodados
            </p>
            <p className="text-xl font-semibold tabular-nums">{totais.km}</p>
          </div>
        </div>
      </div>

      <Button asChild className="h-14 w-full rounded-2xl text-base font-semibold">
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
          <ul className="divide-y divide-border">
            {ultimos.map((a) => (
              <li key={a.id}>
                <Link
                  to="/apontamento/$id"
                  params={{ id: a.id }}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {a.clientes?.nome ?? "—"}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {formatDateBR(a.data)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatMinutes(somarTotais([a]).trabalho)}
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
