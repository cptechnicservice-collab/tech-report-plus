import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import { PageShell, Section } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApontamentos, fetchClientes, fetchValores, formatMinutes, somarTotais, todayISO, type ApontamentoComCliente } from "@/lib/apontamentos";
import { calcularValoresPeriodo, formatCurrency, formatDecimalHours } from "@/lib/financeiro";
import { generateClientReport } from "@/lib/pdf-report";

export const Route = createFileRoute("/relatorio")({
  head: () => ({ meta: [
    { title: "Relatório por cliente — CP TECHNIC Horas" },
    { name: "description", content: "Gere e compartilhe relatórios de horas, viagens e quilometragem por cliente e período." },
    { property: "og:title", content: "Relatório por cliente — CP TECHNIC Horas" },
    { property: "og:description", content: "Relatórios em PDF de apontamentos por cliente e período." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Relatorio,
});

function iso(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function getShortcut(kind: "week" | "lastWeek" | "month") {
  const today = new Date(`${todayISO()}T12:00:00`);
  if (kind === "month") return [`${todayISO().slice(0, 7)}-01`, todayISO()] as const;
  const weekday = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - weekday - (kind === "lastWeek" ? 7 : 0));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [iso(monday), iso(sunday)] as const;
}

type PeriodKind = "week" | "lastWeek" | "month" | "custom";

type Atendimento = {
  inicio: string;
  fim: string;
  dias: number;
  minutos: number;
};

function dayNumber(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function isContinuous(previous: string, current: string) {
  const gap = dayNumber(current) - dayNumber(previous);
  const previousDay = new Date(`${previous}T12:00:00`).getDay();
  const currentDay = new Date(`${current}T12:00:00`).getDay();
  return gap === 1 || (gap === 3 && previousDay === 5 && currentDay === 1);
}

function groupAtendimentos(items: ApontamentoComCliente[]): Atendimento[] {
  const byDate = new Map<string, ApontamentoComCliente[]>();
  items.forEach((item) => byDate.set(item.data, [...(byDate.get(item.data) ?? []), item]));

  const dates = [...byDate.keys()].sort();
  const groups: string[][] = [];
  dates.forEach((date) => {
    const current = groups.at(-1);
    const previous = current?.at(-1);
    if (current && previous && isContinuous(previous, date)) current.push(date);
    else groups.push([date]);
  });

  return groups
    .map((datesInGroup) => {
      const groupItems = datesInGroup.flatMap((date) => byDate.get(date) ?? []);
      return {
        inicio: datesInGroup[0],
        fim: datesInGroup[datesInGroup.length - 1],
        dias: datesInGroup.length,
        minutos: somarTotais(groupItems).trabalho,
      };
    })
    .reverse()
    .slice(0, 6);
}

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function atendimentoHours(minutes: number) {
  const formatted = formatMinutes(minutes);
  return formatted.endsWith("h00") ? formatted.slice(0, -2) : formatted;
}

function Relatorio() {
  const [clienteId, setClienteId] = useState("");
  const [inicio, setInicio] = useState(() => getShortcut("month")[0]);
  const [fim, setFim] = useState(() => getShortcut("month")[1]);
  const [activePeriod, setActivePeriod] = useState<PeriodKind>("month");
  const [generating, setGenerating] = useState(false);
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: fetchClientes });
  const { data: apontamentos = [] } = useQuery({ queryKey: ["apontamentos"], queryFn: fetchApontamentos });
  const { data: valores = [] } = useQuery({ queryKey: ["valores"], queryFn: fetchValores });
  const atendimentos = useMemo(
    () => groupAtendimentos(apontamentos.filter((item) => item.cliente_id === clienteId)),
    [apontamentos, clienteId],
  );
  const filtrados = useMemo(
    () => apontamentos.filter((item) => item.cliente_id === clienteId && item.data >= inicio && item.data <= fim),
    [apontamentos, clienteId, inicio, fim],
  );
  const totais = somarTotais(filtrados);
  const financeiros = useMemo(() => calcularValoresPeriodo(filtrados, valores), [filtrados, valores]);
  const invalidPeriod = Boolean(inicio && fim && inicio > fim);

  const shortcut = (kind: "week" | "lastWeek" | "month") => {
    const [start, end] = getShortcut(kind);
    setInicio(start);
    setFim(end);
    setActivePeriod(kind);
  };

  const selectAtendimento = (atendimento: Atendimento) => {
    setInicio(atendimento.inicio);
    setFim(atendimento.fim);
    setActivePeriod("custom");
  };

  const selectCliente = (id: string) => {
    setClienteId(id);
    const latest = groupAtendimentos(apontamentos.filter((item) => item.cliente_id === id))[0];
    if (latest) selectAtendimento(latest);
  };

  const generate = async () => {
    const cliente = clientes.find((item) => item.id === clienteId);
    if (!cliente || !inicio || !fim || invalidPeriod) return;
    if (filtrados.length === 0) {
      toast.warning("Nenhum apontamento no período selecionado");
      return;
    }
    setGenerating(true);
    try {
      await generateClientReport(cliente, filtrados, valores, inicio, fim);
    } catch (error) {
      toast.error(error instanceof Error ? `Não foi possível gerar o PDF: ${error.message}` : "Não foi possível gerar o PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <PageShell title="Relatório" subtitle="Cliente e período">
      <Section title="Dados do relatório">
        <div className="space-y-1.5">
          <Label htmlFor="report-client">Cliente</Label>
          <select id="report-client" value={clienteId} onChange={(event) => selectCliente(event.target.value)} className="ios-field h-12 w-full border px-3">
            <option value="">Selecione o cliente</option>
            {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
          </select>
        </div>
        {clienteId && atendimentos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Atendimentos recentes</p>
            <div className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
              {atendimentos.map((atendimento) => {
                const selected = inicio === atendimento.inicio && fim === atendimento.fim;
                const period = atendimento.inicio === atendimento.fim
                  ? shortDate(atendimento.inicio)
                  : `${shortDate(atendimento.inicio)} – ${shortDate(atendimento.fim)}`;
                return (
                  <Button
                    key={`${atendimento.inicio}-${atendimento.fim}`}
                    type="button"
                    variant="ghost"
                    className={`h-11 w-full justify-start rounded-none px-3 text-sm font-medium ${selected ? "bg-secondary" : ""}`}
                    aria-pressed={selected}
                    onClick={() => selectAtendimento(atendimento)}
                  >
                    {period} · {atendimento.dias} {atendimento.dias === 1 ? "dia" : "dias"} · {atendimentoHours(atendimento.minutos)}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary p-1">
          <Button type="button" variant="ghost" size="sm" className={activePeriod === "week" ? "bg-card" : ""} aria-pressed={activePeriod === "week"} onClick={() => shortcut("week")}>Esta semana</Button>
          <Button type="button" variant="ghost" size="sm" className={activePeriod === "lastWeek" ? "bg-card" : ""} aria-pressed={activePeriod === "lastWeek"} onClick={() => shortcut("lastWeek")}>Semana passada</Button>
          <Button type="button" variant="ghost" size="sm" className={activePeriod === "month" ? "bg-card" : ""} aria-pressed={activePeriod === "month"} onClick={() => shortcut("month")}>Este mês</Button>
          <Button type="button" variant="ghost" size="sm" className={activePeriod === "custom" ? "bg-card" : ""} aria-pressed={activePeriod === "custom"} onClick={() => { setActivePeriod("custom"); document.getElementById("report-start")?.focus(); }}>Personalizado</Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="report-start">De</Label><Input id="report-start" type="date" value={inicio} onChange={(event) => { setInicio(event.target.value); setActivePeriod("custom"); }} className="h-12 rounded-xl" /></div>
          <div className="space-y-1.5"><Label htmlFor="report-end">Até</Label><Input id="report-end" type="date" value={fim} onChange={(event) => { setFim(event.target.value); setActivePeriod("custom"); }} className="h-12 rounded-xl" /></div>
        </div>
        {invalidPeriod && <p className="text-sm font-medium text-destructive">A data “De” deve ser anterior ou igual à data “Até”.</p>}
        <p className="text-xs text-muted-foreground">{filtrados.length} apontamento(s) · {formatMinutes(totais.trabalho)} trabalho · {formatMinutes(totais.viagem)} viagem · {totais.km} km</p>
      </Section>
      <Section title="Valores do período">
        <dl className="divide-y divide-border text-sm">
          <ValueRow label={`Horas trabalhadas · ${formatDecimalHours(financeiros.horasTrabalhadas)} h × valores vigentes`} value={financeiros.valorTrabalho} />
          <ValueRow label={`Horas de viagem · ${formatDecimalHours(financeiros.horasViagem)} h × valores vigentes`} value={financeiros.valorViagem} />
          <ValueRow label={`KM · ${financeiros.km} × valores vigentes`} value={financeiros.valorKm} />
          <ValueRow label={`Diárias · ${financeiros.diariasInteiras} inteira(s), ${financeiros.meiasDiarias} meia(s)`} value={financeiros.valorDiarias} />
          <ValueRow label="Pedágios" value={financeiros.pedagios} />
          <ValueRow label="Outras despesas" value={financeiros.outrasDespesas} />
          <div className="flex items-center justify-between gap-3 pt-4 text-base font-bold">
            <dt>TOTAL GERAL</dt><dd className="tabular-nums text-primary">{formatCurrency(financeiros.totalGeral)}</dd>
          </div>
        </dl>
      </Section>
      <Button className="h-14 w-full rounded-2xl text-base font-semibold" disabled={!clienteId || !inicio || !fim || invalidPeriod || generating} onClick={() => void generate()}>
        <FileText className="mr-2 h-5 w-5" /> {generating ? "Gerando..." : "Gerar e compartilhar PDF"}
      </Button>
    </PageShell>
  );
}

function ValueRow({ label, value }: { label: string; value: number }) {
  return <div className="flex items-start justify-between gap-3 py-3 first:pt-0"><dt className="text-muted-foreground">{label}</dt><dd className="shrink-0 font-medium tabular-nums">{formatCurrency(value)}</dd></div>;
}