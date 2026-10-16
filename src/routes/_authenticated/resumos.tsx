import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, HandCoins, ReceiptText } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageShell, Section } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { fetchApontamentos, fetchValores, todayISO } from "@/lib/apontamentos";
import { calcularValoresPeriodo, formatCurrency } from "@/lib/financeiro";
import { fetchRelatoriosSalvos, formasPagamento, saldoRelatorio } from "@/lib/relatorios";

export const Route = createFileRoute("/_authenticated/resumos")({
  head: () => ({
    meta: [
      { title: "Resumos — CP TECHNIC Horas" },
      { name: "description", content: "Resumos financeiros mensais e anuais com gráficos." },
      { property: "og:title", content: "Resumos — CP TECHNIC Horas" },
      { property: "og:description", content: "Resumos financeiros privados da CP TECHNIC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Resumos,
});

const CORES = ["var(--primary)", "var(--success)", "var(--highlight-foreground)", "var(--muted-foreground)", "var(--accent-foreground)"];

function Resumos() {
  const [tipo, setTipo] = useState<"mensal" | "anual">("mensal");
  const [periodo, setPeriodo] = useState(() => todayISO().slice(0, 7));
  const { data: apontamentos = [] } = useQuery({ queryKey: ["apontamentos"], queryFn: fetchApontamentos });
  const { data: valores = [] } = useQuery({ queryKey: ["valores"], queryFn: fetchValores });
  const { data: relatorios = [] } = useQuery({ queryKey: ["relatorios-salvos"], queryFn: fetchRelatoriosSalvos });

  const doPeriodo = useMemo(() => apontamentos.filter((a) => a.data.startsWith(periodo)), [apontamentos, periodo]);
  const financeiro = useMemo(() => calcularValoresPeriodo(doPeriodo, valores), [doPeriodo, valores]);

  const abertos = relatorios.filter((item) => saldoRelatorio(item) > 0 && item.fim.startsWith(periodo));
  const totalAReceber = abertos.reduce((total, item) => total + saldoRelatorio(item), 0);
  const recebidos = relatorios.filter((item) => item.valor_recebido > 0 && Boolean(item.data_recebimento?.startsWith(periodo)));
  const totalRecebido = recebidos.reduce((total, item) => total + item.valor_recebido, 0);
  const faturadoPeriodo = relatorios.filter((item) => item.fim.startsWith(periodo)).reduce((total, item) => total + item.total_geral, 0);
  const totalRelatorios = relatorios.reduce((total, item) => total + item.total_geral, 0);
  const totalRecebidoGeral = relatorios.reduce((total, item) => total + item.valor_recebido, 0);
  const totalAReceberGeral = relatorios.reduce((total, item) => total + saldoRelatorio(item), 0);

  const graficoMensal = useMemo(() => {
    const meses = new Map<string, { mes: string; faturado: number; recebido: number }>();
    relatorios.forEach((item) => {
      const chave = item.fim.slice(0, 7);
      const atual = meses.get(chave) ?? { mes: chave, faturado: 0, recebido: 0 };
      atual.faturado += item.total_geral;
      meses.set(chave, atual);
      if (item.data_recebimento && item.valor_recebido > 0) {
        const chaveRec = item.data_recebimento.slice(0, 7);
        const rec = meses.get(chaveRec) ?? { mes: chaveRec, faturado: 0, recebido: 0 };
        rec.recebido += item.valor_recebido;
        meses.set(chaveRec, rec);
      }
    });
    return [...meses.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-6)
      .map((item) => ({
        ...item,
        mes: new Date(`${item.mes}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      }));
  }, [relatorios]);

  const graficoFormas = useMemo(
    () =>
      formasPagamento
        .map((forma) => ({
          nome: forma.label,
          valor: relatorios.filter((item) => item.forma_pagamento === forma.value).reduce((soma, item) => soma + item.valor_recebido, 0),
        }))
        .filter((item) => item.valor > 0),
    [relatorios],
  );

  const graficoComposicao = useMemo(
    () =>
      [
        { nome: "Horas trabalhadas", valor: financeiro.valorTrabalho },
        { nome: "Horas de viagem", valor: financeiro.valorViagem },
        { nome: "Quilometragem", valor: financeiro.valorKm },
        { nome: "Diárias", valor: financeiro.valorDiarias },
        { nome: "Despesas", valor: financeiro.pedagios + financeiro.outrasDespesas },
      ].filter((item) => item.valor > 0),
    [financeiro],
  );

  const alterarTipo = (novo: "mensal" | "anual") => {
    setTipo(novo);
    setPeriodo((atual) => (novo === "anual" ? atual.slice(0, 4) : `${atual.slice(0, 4)}-${todayISO().slice(5, 7)}`));
  };

  const moverPeriodo = (diferenca: number) => {
    if (tipo === "anual") {
      setPeriodo(String(Number(periodo.slice(0, 4)) + diferenca));
      return;
    }
    const [ano, numeroMes] = periodo.split("-").map(Number);
    if (!ano || !numeroMes) return;
    const data = new Date(ano, numeroMes - 1 + diferenca, 1);
    setPeriodo(`${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`);
  };

  const periodoLabel =
    tipo === "anual"
      ? periodo
      : new Date(`${periodo}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <PageShell title="Resumos" subtitle="Visão financeira e gráficos">
      <Link to="/relatorios-totais" className="press ios-group flex min-h-24 items-center gap-4 p-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><ReceiptText className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-muted-foreground">Total financeiro</span>
          <span className="mt-0.5 block break-words text-xl font-bold tabular-nums">{formatCurrency(totalRelatorios)}</span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Recebidos {formatCurrency(totalRecebidoGeral)}</span>
            <span>A receber {formatCurrency(totalAReceberGeral)}</span>
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>

      <Link to="/previsao-recebimentos" className="press ios-group flex min-h-16 items-center gap-4 p-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-info/15 text-info"><CalendarClock className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Previsão de recebimentos</span>
          <span className="block text-xs text-muted-foreground">Quanto entra em cada mês, por parcela</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>

      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold">Período</h2>
        <div className="flex rounded-lg bg-secondary p-1" aria-label="Tipo de período">
          {(["mensal", "anual"] as const).map((opcao) => (
            <Button key={opcao} type="button" size="sm" variant={tipo === opcao ? "default" : "ghost"} className="h-8 rounded-md px-3 text-xs capitalize" onClick={() => alterarTipo(opcao)}>
              {opcao}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex h-11 items-center justify-between">
        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Período anterior" onClick={() => moverPeriodo(-1)}><ChevronLeft className="h-5 w-5" /></Button>
        <p className="text-sm font-semibold capitalize">{periodoLabel}</p>
        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Próximo período" onClick={() => moverPeriodo(1)}><ChevronRight className="h-5 w-5" /></Button>
      </div>

      <section className="rounded-2xl bg-brand-header p-5 text-brand-header-foreground shadow-nav">
        <p className="flex items-center gap-2 text-xs text-brand-header-foreground/65"><CircleDollarSign className="h-4 w-4" />Total do período</p>
        <p className="mt-2 text-[2rem] font-bold leading-none tabular-nums">{formatCurrency(financeiro.totalGeral)}</p>
        <div className="mt-6 grid grid-cols-3 gap-2 text-xs">
          <div><p className="text-brand-header-foreground/55">Trabalho</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(financeiro.valorTrabalho)}</p></div>
          <div><p className="text-brand-header-foreground/55">Viagem</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(financeiro.valorViagem)}</p></div>
          <div><p className="text-brand-header-foreground/55">KM + Diárias</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(financeiro.valorKm + financeiro.valorDiarias)}</p></div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Link to="/relatorios-salvos" search={{ status: "aberto", periodo, financeiro: true }} className="press ios-group min-w-0 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-highlight text-highlight-foreground"><HandCoins className="h-5 w-5" /></span>
          <span className="mt-3 block text-sm font-medium text-muted-foreground">A receber</span>
          <span className="mt-0.5 block break-words text-lg font-bold tabular-nums">{formatCurrency(totalAReceber)}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{abertos.length} em aberto</span>
        </Link>
        <Link to="/relatorios-salvos" search={{ status: "recebido", periodo, financeiro: true }} className="press ios-group min-w-0 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-success/15 text-success"><CheckCircle2 className="h-5 w-5" /></span>
          <span className="mt-3 block text-sm font-medium text-muted-foreground">Recebidos</span>
          <span className="mt-0.5 block break-words text-lg font-bold tabular-nums">{formatCurrency(totalRecebido)}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{recebidos.length} recebimento(s)</span>
        </Link>
      </section>

      <p className="px-1 text-xs text-muted-foreground">Faturado em relatórios no período: <strong className="text-foreground tabular-nums">{formatCurrency(faturadoPeriodo)}</strong></p>

      <Section title="Faturado x recebido" hint="últimos 6 meses">
        {graficoMensal.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum relatório salvo ainda.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={graficoMensal} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis hide />
                <Tooltip formatter={(valor) => formatCurrency(Number(valor))} cursor={{ fill: "var(--secondary)" }} />
                <Bar dataKey="faturado" name="Faturado" radius={[4, 4, 0, 0]} fill="var(--primary)" />
                <Bar dataKey="recebido" name="Recebido" radius={[4, 4, 0, 0]} fill="var(--success)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section title="Composição do valor" hint={tipo === "anual" ? periodo : periodoLabel}>
        {graficoComposicao.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum apontamento no período.</p>
        ) : (
          <>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={graficoComposicao} dataKey="valor" nameKey="nome" innerRadius={48} outerRadius={80} paddingAngle={2}>
                    {graficoComposicao.map((item, index) => (
                      <Cell key={item.nome} fill={CORES[index % CORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(valor) => formatCurrency(Number(valor))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <dl className="-my-2 divide-y divide-border">
              {graficoComposicao.map((item, index) => (
                <div key={item.nome} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
                  <dt className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CORES[index % CORES.length] }} />{item.nome}</dt>
                  <dd className="font-semibold tabular-nums">{formatCurrency(item.valor)}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </Section>

      <Section title="Formas de recebimento">
        {graficoFormas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum recebimento registrado.</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={graficoFormas} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="nome" tickLine={false} axisLine={false} fontSize={12} width={96} stroke="var(--muted-foreground)" />
                <Tooltip formatter={(valor) => formatCurrency(Number(valor))} cursor={{ fill: "var(--secondary)" }} />
                <Bar dataKey="valor" name="Recebido" radius={[0, 4, 4, 0]} fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>
    </PageShell>
  );
}
