import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, PackagePlus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { PageShell, Section } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchApontamentos, fetchClientes, fetchValores, formatMinutes, somarTotais, todayISO, type ApontamentoComCliente } from "@/lib/apontamentos";
import { calcularValoresPeriodo, formatCurrency, formatDecimalHours } from "@/lib/financeiro";
import { generateClientReport } from "@/lib/pdf-report";
import type { ReportPartItem } from "@/lib/pdf-report";
import { fetchPecas } from "@/lib/pecas";
import { saveRelatorioOffline } from "@/lib/offline";
import { fetchRelatoriosSalvos, numeroRelatorio } from "@/lib/relatorios";
import { fetchApontamentoPecas } from "@/lib/apontamento-pecas";
import { FloatingInput, FloatingSelect } from "@/components/FloatingField";

export const Route = createFileRoute("/_authenticated/relatorio")({
  validateSearch: (search: Record<string, unknown>) => ({
    relatorio: typeof search["relatorio"] === "string" ? search["relatorio"] : undefined,
  }),
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
  const [year, month, day] = value.split("-");
  return Date.UTC(Number(year), Number(month) - 1, Number(day)) / 86_400_000;
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
      const inicio = datesInGroup[0];
      const fim = datesInGroup.at(-1);
      if (!inicio || !fim) return null;
      const groupItems = datesInGroup.flatMap((date) => byDate.get(date) ?? []);
      return {
        inicio,
        fim,
        dias: datesInGroup.length,
        minutos: somarTotais(groupItems).trabalho,
      };
    })
    .filter((atendimento): atendimento is Atendimento => atendimento !== null)
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
  const search = Route.useSearch();
  const [clienteId, setClienteId] = useState("");
  const [inicio, setInicio] = useState(() => getShortcut("month")[0]);
  const [fim, setFim] = useState(() => getShortcut("month")[1]);
  const [activePeriod, setActivePeriod] = useState<PeriodKind>("month");
  const [generating, setGenerating] = useState(false);
  const [pecaId, setPecaId] = useState("");
  const [pecasSelecionadas, setPecasSelecionadas] = useState<Array<Omit<ReportPartItem, "quantidade"> & { quantidade: number | "" }>>([]);
  const initializedReportId = useRef<string | null>(null);
  const draftReportId = useRef(crypto.randomUUID());
  const queryClient = useQueryClient();
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: fetchClientes });
  const { data: apontamentos = [] } = useQuery({ queryKey: ["apontamentos"], queryFn: fetchApontamentos });
  const { data: valores = [] } = useQuery({ queryKey: ["valores"], queryFn: fetchValores });
  const { data: pecas = [] } = useQuery({ queryKey: ["pecas"], queryFn: fetchPecas });
  const { data: apontamentoPecas = [] } = useQuery({ queryKey: ["apontamento-pecas"], queryFn: fetchApontamentoPecas });
  const { data: relatoriosSalvos = [] } = useQuery({ queryKey: ["relatorios-salvos"], queryFn: fetchRelatoriosSalvos });
  const relatorioEmEdicao = useMemo(
    () => relatoriosSalvos.find((item) => item.id === search.relatorio),
    [relatoriosSalvos, search.relatorio],
  );
  const apontamentosDisponiveis = relatorioEmEdicao?.apontamentos_snapshot ?? apontamentos;
  const valoresDisponiveis = relatorioEmEdicao?.valores_snapshot ?? valores;

  useEffect(() => {
    if (!relatorioEmEdicao || initializedReportId.current === relatorioEmEdicao.id) return;
    initializedReportId.current = relatorioEmEdicao.id;
    setClienteId(relatorioEmEdicao.cliente_id ?? relatorioEmEdicao.cliente_snapshot.id);
    setInicio(relatorioEmEdicao.inicio);
    setFim(relatorioEmEdicao.fim);
    setActivePeriod("custom");
    setPecasSelecionadas(structuredClone(relatorioEmEdicao.pecas_snapshot));
  }, [relatorioEmEdicao]);
  const atendimentos = useMemo(
    () => groupAtendimentos(apontamentosDisponiveis.filter((item) => item.cliente_id === clienteId)),
    [apontamentosDisponiveis, clienteId],
  );
  const filtrados = useMemo(
    () => apontamentosDisponiveis.filter((item) => (clienteId === "all" || item.cliente_id === clienteId) && item.data >= inicio && item.data <= fim),
    [apontamentosDisponiveis, clienteId, inicio, fim],
  );
  const totais = somarTotais(filtrados);
  const financeiros = useMemo(() => calcularValoresPeriodo(filtrados, valoresDisponiveis), [filtrados, valoresDisponiveis]);
  const pecasDosApontamentos = useMemo(() => {
    if (relatorioEmEdicao) return [];
    const ids = new Set(filtrados.map((item) => item.id));
    const grouped = new Map<string, ReportPartItem>();
    apontamentoPecas.filter((item) => ids.has(item.apontamento_id)).forEach((item) => {
      const key = item.peca_id ?? `${item.descricao}|${item.codigo ?? ""}|${item.valor_unitario}`;
      const current = grouped.get(key);
      if (current) current.quantidade += item.quantidade;
      else grouped.set(key, { id: item.peca_id ?? item.id, descricao: item.descricao, codigo: item.codigo, unidade: item.unidade, preco: item.valor_unitario, foto_data_url: item.foto_data_url, quantidade: item.quantidade });
    });
    return [...grouped.values()];
  }, [apontamentoPecas, filtrados, relatorioEmEdicao]);
  const pecasCombinadas = useMemo(() => {
    const grouped = new Map<string, ReportPartItem>();
    [...pecasDosApontamentos, ...pecasSelecionadas].forEach((item) => {
      const quantity = item.quantidade === "" ? 0 : item.quantidade;
      const current = grouped.get(item.id);
      if (current) current.quantidade += quantity;
      else grouped.set(item.id, { ...item, quantidade: quantity });
    });
    return [...grouped.values()];
  }, [pecasDosApontamentos, pecasSelecionadas]);
  const totalPecas = useMemo(
    () => pecasCombinadas.reduce((total, peca) => total + peca.preco * peca.quantidade, 0),
    [pecasCombinadas],
  );
  const totalDespesasSalvas = relatorioEmEdicao?.total_despesas ?? 0;
  const descontoSalvo = relatorioEmEdicao?.desconto ?? 0;
  const totalRelatorio = Math.max(0, financeiros.totalGeral + totalPecas + totalDespesasSalvas - descontoSalvo);
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

  const addPeca = (selectedId: string) => {
    const peca = pecas.find((item) => item.id === selectedId);
    if (!peca) {
      toast.error("Selecione uma peça para adicionar.");
      return;
    }
    setPecasSelecionadas((current) => {
      const existing = current.find((item) => item.id === peca.id);
      if (existing) return current.map((item) => item.id === peca.id ? { ...item, quantidade: (typeof item.quantidade === "number" ? item.quantidade : 0) + 1 } : item);
      return [...current, { id: peca.id, descricao: peca.descricao, codigo: peca.codigo, unidade: peca.unidade, preco: peca.preco, foto_data_url: peca.foto_data_url, quantidade: 1 }];
    });
    setPecaId("");
  };

  const setPecaQuantidade = (id: string, quantidade: number | "") => {
    setPecasSelecionadas((current) => current.map((item) => item.id === id ? { ...item, quantidade } : item));
  };

  const pecasValidas = pecasSelecionadas.every((item) => typeof item.quantidade === "number" && item.quantidade > 0);
  const pecasParaSalvar = () => pecasCombinadas;
  const porCliente = useMemo(() => clientes.map((cliente) => {
    const items = filtrados.filter((item) => item.cliente_id === cliente.id);
    return { cliente, items, financeiro: calcularValoresPeriodo(items, valoresDisponiveis) };
  }).filter((entry) => entry.items.length > 0), [clientes, filtrados, valoresDisponiveis]);

  const save = useMutation({
    mutationFn: async () => {
      const cliente = relatorioEmEdicao?.cliente_snapshot ?? clientes.find((item) => item.id === clienteId);
      if (!cliente || clienteId === "all" || !inicio || !fim || invalidPeriod || filtrados.length === 0) throw new Error("Selecione um cliente com apontamentos no período.");
      if (!pecasValidas) throw new Error("Informe uma quantidade maior que zero para cada peça.");
      const report = {
        id: relatorioEmEdicao?.id ?? draftReportId.current,
        numero_relatorio: relatorioEmEdicao?.numero_relatorio ?? numeroRelatorio(draftReportId.current),
        cliente_id: cliente.id,
        cliente_nome: cliente.nome,
        inicio,
        fim,
        total_servicos: financeiros.totalGeral,
        total_pecas: totalPecas,
        total_geral: totalRelatorio,
        cliente_snapshot: structuredClone(cliente),
        apontamentos_snapshot: structuredClone(filtrados),
        valores_snapshot: structuredClone(valoresDisponiveis),
        pecas_snapshot: structuredClone(pecasParaSalvar()),
        financeiro_snapshot: structuredClone(financeiros),
        observacao_relatorio: relatorioEmEdicao?.observacao_relatorio ?? "",
        despesas_snapshot: relatorioEmEdicao?.despesas_snapshot ?? [],
        total_despesas: relatorioEmEdicao?.total_despesas ?? 0,
        desconto: descontoSalvo,
        pagamento_status: relatorioEmEdicao?.pagamento_status ?? "pendente" as const,
        valor_recebido: relatorioEmEdicao?.valor_recebido ?? 0,
        data_recebimento: relatorioEmEdicao?.data_recebimento ?? null,
        forma_pagamento: relatorioEmEdicao?.forma_pagamento ?? null,
      };
      return saveRelatorioOffline(relatorioEmEdicao ? { ...report, created_at: relatorioEmEdicao.created_at } : report);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["relatorios-salvos"] });
      const action = relatorioEmEdicao ? "atualizado" : "salvo";
      toast.success(result.queued ? `Relatório ${action} no aparelho — será enviado quando houver conexão` : `Relatório ${action}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar o relatório"),
  });

  const generate = async () => {
    const cliente = relatorioEmEdicao?.cliente_snapshot ?? clientes.find((item) => item.id === clienteId);
    if (!cliente || !inicio || !fim || invalidPeriod) return;
    if (filtrados.length === 0) {
      toast.warning("Nenhum apontamento no período selecionado");
      return;
    }
    setGenerating(true);
    try {
      if (!pecasValidas) {
        toast.warning("Informe uma quantidade maior que zero para cada peça");
        return;
      }
      await generateClientReport(
        cliente,
        filtrados,
        valoresDisponiveis,
        pecasParaSalvar(),
        inicio,
        fim,
        undefined,
        relatorioEmEdicao?.observacao_relatorio ?? "",
        relatorioEmEdicao?.despesas_snapshot ?? [],
        relatorioEmEdicao?.numero_relatorio ?? numeroRelatorio(draftReportId.current),
        descontoSalvo,
      );
    } catch (error) {
      toast.error(error instanceof Error ? `Não foi possível gerar o PDF: ${error.message}` : "Não foi possível gerar o PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <PageShell title={relatorioEmEdicao ? "Editar relatório" : "Relatório"} subtitle={relatorioEmEdicao ? "Documento salvo" : "Cliente e período"} backTo={relatorioEmEdicao ? "/relatorios-salvos" : "/historico"}>
      <Section title="Dados do relatório">
        <FloatingSelect label="Cliente" id="report-client" value={clienteId} disabled={Boolean(relatorioEmEdicao)} onChange={(event) => selectCliente(event.target.value)}>
            <option value="">Selecione o cliente</option>
            {!relatorioEmEdicao ? <option value="all">Todos os clientes</option> : null}
            {relatorioEmEdicao && !clientes.some((item) => item.id === clienteId) ? <option value={clienteId}>{relatorioEmEdicao.cliente_nome}</option> : null}
            {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
        </FloatingSelect>
        {clienteId !== "all" && clienteId && atendimentos.length > 0 && (
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
          <FloatingInput id="report-start" label="De" type="date" value={inicio} onChange={(event) => { setInicio(event.target.value); setActivePeriod("custom"); }} />
          <FloatingInput id="report-end" label="Até" type="date" value={fim} onChange={(event) => { setFim(event.target.value); setActivePeriod("custom"); }} />
        </div>
        {invalidPeriod && <p className="text-sm font-medium text-destructive">A data “De” deve ser anterior ou igual à data “Até”.</p>}
        <p className="text-xs text-muted-foreground">{filtrados.length} apontamento(s) · {formatMinutes(totais.trabalho)} trabalho · {formatMinutes(totais.viagem)} viagem · {totais.km} km</p>
      </Section>
      {clienteId === "all" ? (
        <Section title="Resumo por cliente" hint={`${porCliente.length} cliente(s)`}>
          {porCliente.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum apontamento no período.</p> : <ul className="divide-y divide-border">{porCliente.map(({ cliente, items, financeiro }) => <li key={cliente.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{cliente.nome}</p><p className="text-xs text-muted-foreground">{items.length} apontamento(s)</p></div><p className="shrink-0 font-semibold tabular-nums">{formatCurrency(financeiro.totalGeral)}</p></li>)}</ul>}
          <p className="text-xs text-muted-foreground">Selecione um cliente específico para salvar ou gerar o PDF.</p>
        </Section>
      ) : null}
      <Section title="Peças utilizadas" hint={totalPecas > 0 ? formatCurrency(totalPecas) : ""}>
        {pecasDosApontamentos.length > 0 ? <div className="rounded-lg bg-secondary p-3"><p className="text-xs font-semibold text-muted-foreground">VINCULADAS AOS APONTAMENTOS</p>{pecasDosApontamentos.map((part) => <div key={part.id} className="mt-2 flex justify-between gap-3 text-sm"><span className="truncate">{part.descricao} · {part.quantidade} {part.unidade}</span><span className="shrink-0 tabular-nums">{formatCurrency(part.preco * part.quantidade)}</span></div>)}</div> : null}
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
          <select value={pecaId} onChange={(event) => setPecaId(event.target.value)} className="ios-field h-12 min-w-0 border px-3" aria-label="Selecionar peça">
            <option value="">Selecione uma peça</option>
            {pecas.map((peca) => <option key={peca.id} value={peca.id}>{peca.descricao} · {formatCurrency(peca.preco)}</option>)}
          </select>
          {pecaId ? <Button type="button" size="icon" variant="outline" className="h-12 w-12 rounded-xl" aria-label="Limpar peça selecionada" title="Limpar seleção" onClick={() => setPecaId("")}><X className="h-5 w-5" /></Button> : null}
          <Button type="button" size="icon" className="h-12 w-12 rounded-xl" aria-label="Adicionar peça" title="Adicionar peça" disabled={!pecaId} onClick={() => addPeca(pecaId)}><PackagePlus className="h-5 w-5" /></Button>
        </div>
        {pecasSelecionadas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma peça adicionada a este relatório.</p>
        ) : (
          <ul className="divide-y divide-border">
            {pecasSelecionadas.map((peca) => (
              <li key={peca.id} className="grid grid-cols-[minmax(0,1fr)_5rem_2.5rem] items-center gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-2">{peca.foto_data_url ? <img src={peca.foto_data_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : null}<div className="min-w-0"><p className="truncate text-sm font-medium">{peca.descricao}</p><p className="text-xs text-muted-foreground">{formatCurrency(peca.preco)} por {peca.unidade} · {formatCurrency(peca.preco * (peca.quantidade === "" ? 0 : peca.quantidade))}</p></div></div>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={peca.quantidade}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => {
                    const value = event.target.value.replace(",", ".");
                    if (value === "") setPecaQuantidade(peca.id, "");
                    else if (/^\d*\.?\d*$/.test(value)) setPecaQuantidade(peca.id, Number(value));
                  }}
                  className="h-10 rounded-lg text-right tabular-nums"
                  aria-label={`Quantidade de ${peca.descricao}`}
                />
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full text-destructive" aria-label={`Remover ${peca.descricao}`} onClick={() => setPecasSelecionadas((current) => current.filter((item) => item.id !== peca.id))}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Detalhamento financeiro">
        <dl className="divide-y divide-border text-sm">
          <ValueRow label={`Horas trabalhadas · ${formatDecimalHours(financeiros.horasTrabalhadas)} h × valores vigentes`} value={financeiros.valorTrabalho} />
          <ValueRow label={`Horas de viagem · ${formatDecimalHours(financeiros.horasViagem)} h × valores vigentes`} value={financeiros.valorViagem} />
          <ValueRow label={`KM · ${financeiros.km} × valores vigentes`} value={financeiros.valorKm} />
          <ValueRow label={`Diárias · ${financeiros.diariasInteiras} inteira(s), ${financeiros.meiasDiarias} meia(s)`} value={financeiros.valorDiarias} />
          <ValueRow label="Pedágios" value={financeiros.pedagios} />
          <ValueRow label="Outras despesas" value={financeiros.outrasDespesas} />
          {totalPecas > 0 ? <ValueRow label={`Peças utilizadas · ${pecasCombinadas.length} item(ns)`} value={totalPecas} /> : null}
          {totalDespesasSalvas > 0 ? <ValueRow label="Despesas adicionais" value={totalDespesasSalvas} /> : null}
          {descontoSalvo > 0 ? <ValueRow label="Desconto" value={-descontoSalvo} /> : null}
          <div className="flex items-center justify-between gap-3 pt-4 text-base font-bold">
            <dt>TOTAL GERAL</dt><dd className="tabular-nums text-primary">{formatCurrency(totalRelatorio)}</dd>
          </div>
        </dl>
      </Section>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-14 rounded-xl text-base font-semibold" disabled={!clienteId || clienteId === "all" || !inicio || !fim || invalidPeriod || filtrados.length === 0 || !pecasValidas || save.isPending} onClick={() => save.mutate()}>
          <Save className="mr-2 h-5 w-5" /> {save.isPending ? "Salvando..." : relatorioEmEdicao ? "Atualizar" : "Salvar relatório"}
        </Button>
        <Button className="h-14 rounded-xl text-base font-semibold" disabled={!clienteId || clienteId === "all" || !inicio || !fim || invalidPeriod || generating} onClick={() => void generate()}>
          <FileText className="mr-2 h-5 w-5" /> {generating ? "Gerando..." : "Gerar PDF"}
        </Button>
      </div>
    </PageShell>
  );
}

function ValueRow({ label, value }: { label: string; value: number }) {
  return <div className="flex items-start justify-between gap-3 py-3 first:pt-0"><dt className="text-muted-foreground">{label}</dt><dd className="shrink-0 font-medium tabular-nums">{formatCurrency(value)}</dd></div>;
}