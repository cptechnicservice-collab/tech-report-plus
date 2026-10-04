import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, CircleDollarSign, Clock3, HandCoins, ReceiptText, Users } from "lucide-react";

import { PageShell, Section } from "@/components/PageShell";
import { formatCurrency } from "@/lib/financeiro";
import { fetchRelatoriosSalvos, formasPagamento, saldoRelatorio } from "@/lib/relatorios";

export const Route = createFileRoute("/_authenticated/relatorios-totais")({
  head: () => ({
    meta: [
      { title: "Relatórios totais — CP TECHNIC Horas" },
      { name: "description", content: "Visão geral dos valores faturados, recebidos e ainda a receber." },
      { property: "og:title", content: "Relatórios totais — CP TECHNIC Horas" },
      { property: "og:description", content: "Resumo financeiro privado dos relatórios da CP TECHNIC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RelatoriosTotais,
});

function RelatoriosTotais() {
  const { data: relatorios = [], isLoading } = useQuery({
    queryKey: ["relatorios-salvos"],
    queryFn: fetchRelatoriosSalvos,
  });

  const resumo = useMemo(() => {
    const totalFaturado = relatorios.reduce((total, item) => total + item.total_geral, 0);
    const totalRecebido = relatorios.reduce((total, item) => total + item.valor_recebido, 0);
    const totalAReceber = relatorios.reduce((total, item) => total + saldoRelatorio(item), 0);
    const porForma = formasPagamento.map((forma) => ({
      ...forma,
      quantidade: relatorios.filter((item) => item.forma_pagamento === forma.value && item.valor_recebido > 0).length,
      total: relatorios
        .filter((item) => item.forma_pagamento === forma.value)
        .reduce((soma, item) => soma + item.valor_recebido, 0),
    })).filter((item) => item.quantidade > 0);
    const clientes = new Map<string, { nome: string; relatorios: number; total: number; recebido: number; saldo: number }>();
    relatorios.forEach((item) => {
      const chave = item.cliente_id ?? item.cliente_nome;
      const atual = clientes.get(chave) ?? { nome: item.cliente_nome, relatorios: 0, total: 0, recebido: 0, saldo: 0 };
      atual.relatorios += 1;
      atual.total += item.total_geral;
      atual.recebido += item.valor_recebido;
      atual.saldo += saldoRelatorio(item);
      clientes.set(chave, atual);
    });
    return {
      totalFaturado,
      totalRecebido,
      totalAReceber,
      pagos: relatorios.filter((item) => item.pagamento_status === "pago").length,
      parciais: relatorios.filter((item) => item.pagamento_status === "parcial").length,
      pendentes: relatorios.filter((item) => item.pagamento_status === "pendente").length,
      porForma,
      clientes: [...clientes.values()].sort((a, b) => b.total - a.total),
    };
  }, [relatorios]);

  return (
    <PageShell title="Relatórios totais" subtitle="Visão financeira geral" backTo="/painel">
      <section className="rounded-2xl bg-brand-header p-5 text-brand-header-foreground shadow-nav">
        <p className="flex items-center gap-2 text-xs text-brand-header-foreground/65"><CircleDollarSign className="h-4 w-4" />Total faturado</p>
        <p className="mt-2 break-words text-[2rem] font-bold leading-none tabular-nums">{formatCurrency(resumo.totalFaturado)}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
          <div><p className="text-brand-header-foreground/55">Recebidos</p><p className="mt-1 break-words font-semibold tabular-nums">{formatCurrency(resumo.totalRecebido)}</p></div>
          <div><p className="text-brand-header-foreground/55">A receber</p><p className="mt-1 break-words font-semibold tabular-nums">{formatCurrency(resumo.totalAReceber)}</p></div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {[
          { label: "Pagos", value: resumo.pagos, icon: CheckCircle2, className: "bg-success/15 text-success" },
          { label: "Parciais", value: resumo.parciais, icon: HandCoins, className: "bg-highlight text-highlight-foreground" },
          { label: "Pendentes", value: resumo.pendentes, icon: Clock3, className: "bg-secondary text-primary" },
        ].map(({ label, value, icon: Icon, className }) => (
          <div key={label} className="ios-group min-w-0 p-3">
            <span className={`grid h-8 w-8 place-items-center rounded-full ${className}`}><Icon className="h-4 w-4" /></span>
            <p className="mt-3 text-[0.68rem] text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Link to="/relatorios-salvos" search={{ status: "recebido", financeiro: true }} className="press ios-group min-w-0 p-4">
          <ReceiptText className="h-5 w-5 text-success" />
          <span className="mt-3 block text-sm font-semibold">Ver recebidos</span>
          <span className="mt-1 block text-xs text-muted-foreground">Pagos e parciais</span>
        </Link>
        <Link to="/relatorios-salvos" search={{ status: "aberto", financeiro: true }} className="press ios-group min-w-0 p-4">
          <HandCoins className="h-5 w-5 text-primary" />
          <span className="mt-3 block text-sm font-semibold">Ver a receber</span>
          <span className="mt-1 block text-xs text-muted-foreground">Saldos em aberto</span>
        </Link>
      </section>

      <Section title="Formas de recebimento" hint={`${resumo.porForma.length} forma(s)`}>
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : resumo.porForma.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum recebimento registrado.</p>
        ) : (
          <dl className="-my-2 divide-y divide-border">
            {resumo.porForma.map((item) => (
              <div key={item.value} className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm">
                <dt><span className="font-medium">{item.label}</span><span className="ml-1 text-xs text-muted-foreground">({item.quantidade})</span></dt>
                <dd className="font-semibold tabular-nums">{formatCurrency(item.total)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      <Section title="Totais por cliente" hint={`${resumo.clientes.length} cliente(s)`}>
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : resumo.clientes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum relatório salvo.</p>
        ) : (
          <ul className="-my-2 divide-y divide-border">
            {resumo.clientes.map((cliente) => (
              <li key={cliente.nome} className="py-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Users className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><p className="truncate text-sm font-semibold">{cliente.nome}</p><p className="text-xs text-muted-foreground">{cliente.relatorios} relatório(s)</p></div>
                      <p className="shrink-0 text-sm font-bold tabular-nums">{formatCurrency(cliente.total)}</p>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <span className="text-muted-foreground">Recebido <strong className="block text-foreground tabular-nums">{formatCurrency(cliente.recebido)}</strong></span>
                      <span className="text-muted-foreground">A receber <strong className="block text-foreground tabular-nums">{formatCurrency(cliente.saldo)}</strong></span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Link to="/relatorios-salvos" search={{}} className="press flex min-h-14 items-center justify-between rounded-xl bg-secondary px-4 text-sm font-semibold">
        Todos os relatórios <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Link>
    </PageShell>
  );
}