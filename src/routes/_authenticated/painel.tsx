import { LembretesPainel } from "@/components/LembretesPainel";
import { NovoRecebimentoAvulsoButton } from "@/components/RecebimentosAvulsos";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Clock3, Gauge, MapPin, Play, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAgendamentos } from "@/lib/agenda";
import { dataInicialDoAgendamento, proximoAgendamento } from "@/lib/agenda-apontamento";

import { PageShell, Section } from "@/components/PageShell";
import { PagamentosCard } from "@/components/PagamentosAlertas";
import { Button } from "@/components/ui/button";
import {
  fetchApontamentos,
  formatDateBR,
  formatMinutes,
  normalizeTime,
  somarTotais,
  todayISO,
} from "@/lib/apontamentos";
import { relatoriosConfirmados, fetchRelatoriosSalvos } from "@/lib/relatorios";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel e lembretes — CP TECHNIC Horas" },
      {
        name: "description",
        content:
          "Lembretes de notas fiscais e revisões, pagamentos previstos e resumo de horas e quilometragem.",
      },
      { property: "og:title", content: "Painel e lembretes — CP TECHNIC Horas" },
      {
        property: "og:description",
        content: "Lembretes, pagamentos previstos, horas e quilometragem do técnico de campo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Resumo,
});

const NOME_KEY = "cp-perfil-nome";

async function fetchNomePerfil(): Promise<string> {
  try {
    const { data, error } = await supabase.from("profiles").select("display_name").limit(1).maybeSingle();
    if (error) throw error;
    const nome = data?.display_name?.trim() ?? "";
    localStorage.setItem(NOME_KEY, nome);
    return nome;
  } catch {
    return localStorage.getItem(NOME_KEY) ?? "";
  }
}

function Resumo() {
  const { data: nomePerfil = "" } = useQuery({ queryKey: ["perfil-nome"], queryFn: fetchNomePerfil });
  const { data: agendamentos = [] } = useQuery({ queryKey: ["agendamentos"], queryFn: fetchAgendamentos });
  const hoje = todayISO();
  const proximo = useMemo(() => proximoAgendamento(agendamentos, hoje), [agendamentos, hoje]);
  const primeiroNome = nomePerfil.split(/\s+/)[0] ?? "";
  const hojeTexto = new Date(`${hoje}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const [mes, setMes] = useState(() => todayISO().slice(0, 7));
  const { data: apontamentos = [], isLoading } = useQuery({
    queryKey: ["apontamentos"],
    queryFn: fetchApontamentos,
  });
  const { data: relatorios = [] } = useQuery({ queryKey: ["relatorios-salvos"], queryFn: fetchRelatoriosSalvos, select: relatoriosConfirmados });

  const doMes = useMemo(
    () => apontamentos.filter((a) => a.data.startsWith(mes)),
    [apontamentos, mes],
  );
  const totais = somarTotais(doMes);
  const ultimos = doMes.slice(0, 3);

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
    <PageShell title={primeiroNome ? `Olá, ${primeiroNome}` : "Olá!"} subtitle={hojeTexto.charAt(0).toUpperCase() + hojeTexto.slice(1)}>
      <Button asChild className="h-14 w-full rounded-2xl text-base">
        <Link to="/novo" search={{ data: undefined, cliente: undefined, servico: undefined, agenda: undefined, orcamento: undefined }}>
          <CalendarPlus className="mr-2 h-5 w-5" /> Novo apontamento
        </Link>
      </Button>

      {proximo ? (
        <Section title="Próximo atendimento" hint={proximo.data <= hoje ? "Hoje" : formatDateBR(proximo.data)}>
          <div className="space-y-1">
            <p className="truncate text-base font-semibold">{proximo.clientes?.nome ?? "Cliente"}</p>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
              <Clock3 className="h-4 w-4" />
              {formatDateBR(proximo.data)}{proximo.data_fim && proximo.data_fim !== proximo.data ? ` – ${formatDateBR(proximo.data_fim)}` : ""}{proximo.horario ? ` · ${normalizeTime(proximo.horario)}` : ""}
            </p>
            {proximo.maquina_servico ? <p className="truncate text-sm">{proximo.maquina_servico}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild className="h-11 rounded-xl">
              <Link to="/novo" search={{ data: dataInicialDoAgendamento(proximo, hoje), cliente: proximo.cliente_id, servico: proximo.maquina_servico ?? undefined, agenda: proximo.id, orcamento: undefined }}>
                <Play className="mr-1.5 h-4 w-4" /> Iniciar apontamento
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-xl">
              <Link to="/agenda"><CalendarDays className="mr-1.5 h-4 w-4" /> Abrir agenda</Link>
            </Button>
          </div>
        </Section>
      ) : null}

      <NovoRecebimentoAvulsoButton />
      <LembretesPainel />
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

      <section className="grid grid-cols-3 gap-2">
        {[{ label: "Horas trab.", value: formatMinutes(totais.trabalho), icon: Timer }, { label: "Horas viagem", value: formatMinutes(totais.viagem), icon: MapPin }, { label: "KM rodados", value: String(totais.km), icon: Gauge }].map(({ label, value, icon: Icon }) => <div key={label} className="ios-group p-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-primary"><Icon className="h-4 w-4" /></span><p className="mt-3 text-[0.68rem] text-muted-foreground">{label}</p><p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p></div>)}
      </section>

      <PagamentosCard relatorios={relatorios} />

      <Section title="Recentes" hint={`${doMes.length} no mês`}>
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
