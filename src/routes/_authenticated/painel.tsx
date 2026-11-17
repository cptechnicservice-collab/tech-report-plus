import { LembretesPainel } from "@/components/LembretesPainel";
import { NovoRecebimentoAvulsoButton } from "@/components/RecebimentosAvulsos";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Car, ChevronLeft, ChevronRight, FileText, Gauge, Play, Plus, Timer, UserRound, Wallet, Wrench } from "lucide-react";
import { formatDuracao } from "@/lib/duracao-format";
import { formatCurrency } from "@/lib/financeiro";
import { supabase } from "@/integrations/supabase/client";
import { fetchAgendamentos } from "@/lib/agenda";
import { dataInicialDoAgendamento, proximoAgendamento } from "@/lib/agenda-apontamento";

import { PageShell } from "@/components/PageShell";
import { PagamentosCard } from "@/components/PagamentosAlertas";
import { Button } from "@/components/ui/button";
import {
  fetchApontamentos,
  formatDateBR,
  normalizeTime,
  somarTotais,
  todayISO,
} from "@/lib/apontamentos";
import { relatoriosConfirmados, fetchRelatoriosSalvos, saldoRelatorio } from "@/lib/relatorios";

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

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const dataCurta = (() => {
    const d = new Date(`${hoje}T12:00:00`);
    const semana = d.toLocaleDateString("pt-BR", { weekday: "long" }).split("-")[0] ?? "";
    const mesCurto = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${d.getDate()} ${mesCurto}`;
  })();
  const aReceber = relatorios.reduce((total, item) => total + saldoRelatorio(item), 0);
  const ontem = (() => { const d = new Date(`${hoje}T12:00:00`); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
  const diaRelativo = (iso: string) => (iso === hoje ? "Hoje" : iso === ontem ? "Ontem" : formatDateBR(iso).slice(0, 5));

  return (
    <PageShell
      large
      title={primeiroNome ? `${saudacao}, ${primeiroNome}` : `${saudacao}!`}
      subtitle={dataCurta}
      action={
        <Link to="/mais" aria-label="Perfil e mais opções" className="press grid h-11 w-11 place-items-center rounded-full bg-icon-bg text-muted-foreground">
          <UserRound className="h-5 w-5" />
        </Link>
      }
    >
      <Button asChild className="h-14 w-full rounded-2xl text-base font-semibold">
        <Link to="/novo" search={{ data: undefined, cliente: undefined, servico: undefined, agenda: undefined, orcamento: undefined }}>
          <Plus className="mr-1 h-5 w-5" /> Novo apontamento
        </Link>
      </Button>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="shrink-0 text-xl font-bold">Resumo do mês</h2>
          <div className="flex min-w-0 items-center text-xs text-muted-foreground">
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="Mês anterior" onClick={() => moverMes(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span title={periodo} className="min-w-0 truncate capitalize">{new Date(`${mes}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "").replace(" de ", " ")}</span>
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="Próximo mês" onClick={() => moverMes(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Horas trabalhadas", value: formatDuracao(totais.trabalho), icon: Timer },
            { label: "Viagem", value: formatDuracao(totais.viagem), icon: Car },
            { label: "KM rodados", value: `${totais.km.toLocaleString("pt-BR")} km`, icon: Gauge },
            { label: "A receber", value: formatCurrency(aReceber), icon: Wallet },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-[1.125rem] bg-chip p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-tint text-primary"><Icon className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{label}</p>
                <p className="truncate text-base font-bold tracking-tight tabular-nums">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {proximo ? (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Próximo atendimento</h2>
          <div className="ios-group space-y-4 p-4">
            <Link to="/agenda" className="press flex items-start gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-tint text-primary"><Wrench className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-base font-bold uppercase">{proximo.clientes?.nome ?? "Cliente"}</p>
                <p className="flex items-center gap-1.5 text-sm tabular-nums">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {proximo.data <= hoje ? "Hoje" : formatDateBR(proximo.data)}{proximo.data_fim && proximo.data_fim !== proximo.data ? ` – ${formatDateBR(proximo.data_fim)}` : ""}{proximo.horario ? ` · ${normalizeTime(proximo.horario)}` : ""}
                </p>
                {proximo.maquina_servico ? <p className="truncate text-sm text-muted-foreground">{proximo.maquina_servico}</p> : null}
              </div>
              <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
            </Link>
            <div className="space-y-2">
              <Button asChild className="h-12 w-full rounded-2xl">
                <Link to="/novo" search={{ data: dataInicialDoAgendamento(proximo, hoje), cliente: proximo.cliente_id, servico: proximo.maquina_servico ?? undefined, agenda: proximo.id, orcamento: undefined }}>
                  <Play className="mr-1.5 h-4 w-4" /> Iniciar apontamento
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 w-full rounded-2xl border-primary/30 bg-tint text-primary hover:bg-tint hover:text-primary">
                <Link to="/agenda">Abrir agenda</Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Recentes</h2>
          <span className="text-xs text-muted-foreground">{doMes.length} no mês</span>
        </div>
        {isLoading ? (
          <p className="ios-group p-4 text-sm text-muted-foreground">Carregando...</p>
        ) : ultimos.length === 0 ? (
          <p className="ios-group p-4 text-sm text-muted-foreground">Nenhum apontamento ainda. Toque em “Novo apontamento” para começar.</p>
        ) : (
          <ul className="space-y-2.5">
            {ultimos.map((a) => (
              <li key={a.id}>
                <Link to="/apontamento/$id" params={{ id: a.id }} className="press ios-group flex min-h-16 items-center gap-3 px-4 py-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-icon-bg text-muted-foreground"><FileText className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {diaRelativo(a.data)} · <span className="font-semibold text-foreground">{a.clientes?.nome ?? "—"}</span> · {formatDuracao(somarTotais([a]).trabalho)}
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PagamentosCard relatorios={relatorios} />
      <NovoRecebimentoAvulsoButton />
      <LembretesPainel />
    </PageShell>
  );
}
