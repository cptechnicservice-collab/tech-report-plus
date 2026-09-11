import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import { PageShell, Section } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApontamentos, fetchClientes, formatMinutes, somarTotais, todayISO } from "@/lib/apontamentos";
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

function Relatorio() {
  const [clienteId, setClienteId] = useState("");
  const [inicio, setInicio] = useState(() => getShortcut("month")[0]);
  const [fim, setFim] = useState(() => getShortcut("month")[1]);
  const [generating, setGenerating] = useState(false);
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: fetchClientes });
  const { data: apontamentos = [] } = useQuery({ queryKey: ["apontamentos"], queryFn: fetchApontamentos });
  const filtrados = useMemo(
    () => apontamentos.filter((item) => item.cliente_id === clienteId && item.data >= inicio && item.data <= fim),
    [apontamentos, clienteId, inicio, fim],
  );
  const totais = somarTotais(filtrados);

  const shortcut = (kind: "week" | "lastWeek" | "month") => {
    const [start, end] = getShortcut(kind);
    setInicio(start);
    setFim(end);
  };

  const generate = async () => {
    const cliente = clientes.find((item) => item.id === clienteId);
    if (!cliente || !inicio || !fim) return;
    if (filtrados.length === 0) {
      toast.warning("Nenhum apontamento no período selecionado");
      return;
    }
    setGenerating(true);
    try {
      await generateClientReport(cliente, filtrados, inicio, fim);
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
          <select id="report-client" value={clienteId} onChange={(event) => setClienteId(event.target.value)} className="h-12 w-full rounded-xl border border-input bg-background px-3">
            <option value="">Selecione o cliente</option>
            {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => shortcut("week")}>Esta semana</Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => shortcut("lastWeek")}>Semana passada</Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => shortcut("month")}>Este mês</Button>
          <Button type="button" variant="outline" size="sm">Personalizado</Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="report-start">De</Label><Input id="report-start" type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} className="h-12 rounded-xl" /></div>
          <div className="space-y-1.5"><Label htmlFor="report-end">Até</Label><Input id="report-end" type="date" value={fim} onChange={(event) => setFim(event.target.value)} className="h-12 rounded-xl" /></div>
        </div>
        <p className="text-xs text-muted-foreground">{filtrados.length} apontamento(s) · {formatMinutes(totais.trabalho)} trabalho · {formatMinutes(totais.viagem)} viagem · {totais.km} km</p>
      </Section>
      <Button className="h-14 w-full rounded-2xl text-base font-semibold" disabled={!clienteId || !inicio || !fim || generating} onClick={() => void generate()}>
        <FileText className="mr-2 h-5 w-5" /> {generating ? "Gerando..." : "Gerar e compartilhar PDF"}
      </Button>
    </PageShell>
  );
}