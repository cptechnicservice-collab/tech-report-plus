import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, CalendarPlus, ChevronLeft, ChevronRight, CircleDollarSign, Gauge, MapPin, Timer, Users } from "lucide-react";

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
  const [mes, setMes] = useState(() => todayISO().slice(0, 7));
  const { data: apontamentos = [], isLoading } = useQuery({
    queryKey: ["apontamentos"],
    queryFn: fetchApontamentos,
  });
  const { data: valores = [] } = useQuery({ queryKey: ["valores"], queryFn: fetchValores });

  const doMes = useMemo(
    () => apontamentos.filter((a) => a.data.startsWith(mes)),
    [apontamentos, mes],
  );
  const totais = somarTotais(doMes);
  const financeiro = calcularValoresPeriodo(doMes, valores);
  const ultimos = doMes.slice(0, 5);
  const clientesAtendidos = new Set(doMes.map((item) => item.cliente_id)).size;
  const servicosInformados = doMes.filter((item) => Boolean(item.maquina_servico?.trim())).length;

  const moverMes = (diferenca: number) => {
    const [ano, numeroMes] = mes.split("-").map(Number);
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
      <section className="ios-group">
        <div className="grid grid-cols-3 divide-x divide-border py-4 text-center">
          <div className="px-2">
            <Users className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 text-xl font-bold tabular-nums">{clientesAtendidos}</p>
            <p className="text-[0.68rem] text-muted-foreground">Clientes</p>
          </div>
          <div className="px-2">
            <BriefcaseBusiness className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 text-xl font-bold tabular-nums">{servicosInformados}</p>
            <p className="text-[0.68rem] text-muted-foreground">Serviços</p>
          </div>
          <div className="px-2">
            <Timer className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 text-xl font-bold tabular-nums">{doMes.length}</p>
            <p className="text-[0.68rem] text-muted-foreground">Apontamentos</p>
          </div>
        </div>
        <div className="flex h-14 items-center justify-between border-t border-border px-2">
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Mês anterior" onClick={() => moverMes(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="font-semibold">{periodo}</p>
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Próximo mês" onClick={() => moverMes(1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </section>

      <section className="ios-group overflow-hidden">
        <div className="px-5 py-6 text-center">
          <CircleDollarSign className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-2 text-[2rem] font-bold leading-none tabular-nums">{formatCurrency(financeiro.totalGeral)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Total acumulado no mês</p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border border-t border-border bg-secondary/50 py-4 text-center">
          <div className="px-1">
            <Timer className="mx-auto h-4 w-4 text-muted-foreground" />
            <p className="mt-1 text-xs text-muted-foreground">Trabalho</p>
            <p className="mt-0.5 font-bold tabular-nums">{formatMinutes(totais.trabalho)}</p>
          </div>
          <div className="px-1">
            <MapPin className="mx-auto h-4 w-4 text-muted-foreground" />
            <p className="mt-1 text-xs text-muted-foreground">Viagem</p>
            <p className="mt-0.5 font-bold tabular-nums">{formatMinutes(totais.viagem)}</p>
          </div>
          <div className="px-1">
            <Gauge className="mx-auto h-4 w-4 text-muted-foreground" />
            <p className="mt-1 text-xs text-muted-foreground">KM</p>
            <p className="mt-0.5 font-bold tabular-nums">{totais.km}</p>
          </div>
        </div>
      </section>

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
        <Link to="/novo" search={{ data: undefined, cliente: undefined, servico: undefined }}>
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
