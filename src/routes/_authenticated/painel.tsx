import { LembretesPainel } from "@/components/LembretesPainel";
import { NovoRecebimentoAvulsoButton } from "@/components/RecebimentosAvulsos";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Users, Package, CircleDollarSign } from "lucide-react";
import { formatDuracao } from "@/lib/duracao-format";
import { formatCurrency } from "@/lib/financeiro";
import { empresaPadrao, fetchEmpresa } from "@/lib/empresa";

import { BrandMark } from "@/components/BrandMark";
import { PageShell } from "@/components/PageShell";
import { PagamentosCard } from "@/components/PagamentosAlertas";
import { Button } from "@/components/ui/button";
import {
  fetchApontamentos,
  formatDateBR,
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

function Resumo() {
  const { data: empresa } = useQuery({ queryKey: ["dados-empresa"], queryFn: fetchEmpresa });
  const hoje = todayISO();
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

  const dataCurta = (() => {
    const d = new Date(`${hoje}T12:00:00`);
    const semana = d.toLocaleDateString("pt-BR", { weekday: "long" }).split("-")[0] ?? "";
    const mesCurto = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${d.getDate()} ${mesCurto}`;
  })();
  const aReceber = relatorios.reduce((total, item) => total + saldoRelatorio(item), 0);
  const ontem = (() => { const d = new Date(`${hoje}T12:00:00`); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();
  const diaRelativo = (iso: string) => (iso === hoje ? "Hoje" : iso === ontem ? "Ontem" : formatDateBR(iso).slice(0, 5));

  const barras = useMemo(() => {
    const inicio = new Date(`${mes}-01T12:00:00`);
    const dias = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0).getDate();
    return Array.from({ length: dias }, (_, index) => {
      const dia = `${mes}-${String(index + 1).padStart(2, "0")}`;
      return { dia, minutos: somarTotais(doMes.filter((item) => item.data === dia)).trabalho };
    });
  }, [mes, doMes]);
  const maximoDia = Math.max(1, ...barras.map((item) => item.minutos));

  return (
    <PageShell
      compact
      brand={<BrandMark />}
      title={(empresa ?? empresaPadrao).nome_fantasia}
      subtitle={`CNPJ ${(empresa ?? empresaPadrao).cnpj} · ${dataCurta}`}
      action={
        <Link to="/mais" aria-label="Perfil e mais opções" className="press grid h-11 w-11 place-items-center rounded-full border border-border bg-card font-display text-sm font-bold">
          CP
        </Link>
      }
    >
      <section aria-label="Resumo do mês" className="month-hero p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center rounded-full bg-hero-pill">
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" aria-label="Mês anterior" onClick={() => moverMes(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-0 text-[10px] font-medium" title={periodo}>{periodo}</span>
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" aria-label="Próximo mês" onClick={() => moverMes(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <span className="rounded-full border border-primary-foreground/15 px-3 py-2 text-[10px] font-semibold">MÊS</span>
        </div>
        <h2 className="mt-6 font-sans text-xs font-medium uppercase tracking-[0.2em] text-hero-label">Horas trabalhadas</h2>
        <p className="font-display mt-1 text-[60px] font-bold leading-tight tabular-nums">{formatDuracao(totais.trabalho)}</p>
        <svg role="img" aria-label={`Horas trabalhadas por dia em ${periodo}`} className="my-5 h-16 w-full" viewBox={`0 0 ${barras.length * 10} 64`} preserveAspectRatio="none">
          {barras.map(({ dia, minutos }, index) => {
            const altura = minutos > 0 ? Math.max(5, minutos / maximoDia * 60) : 0;
            return <g key={dia}><title>{dia}: {formatDuracao(minutos)}</title><rect x={index * 10 + 1} y={0} width={6} height={64} rx={3} className="fill-hero-bar" /><rect x={index * 10 + 1} y={64 - altura} width={6} height={altura} rx={3} className="fill-primary" />{dia === hoje ? <rect x={index * 10 + 1} y={0} width={6} height={64} rx={3} className="fill-none stroke-primary-foreground/70" strokeWidth={1} /> : null}</g>;
          })}
        </svg>
        <div className="-mx-2 grid grid-cols-[1fr_1fr_1.3fr] divide-x divide-primary-foreground/8 rounded-[24px] bg-hero-strip py-4">
          <div className="min-w-0 px-2 text-center"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-hero-label">Viagem</p><p className="font-display mt-2 text-base font-bold tabular-nums">{formatDuracao(totais.viagem)}</p></div>
          <div className="min-w-0 px-2 text-center"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-hero-label">Rodados</p><p className="font-display mt-2 text-base font-bold tabular-nums">{totais.km.toLocaleString("pt-BR")} <span className="text-[10px] font-medium">km</span></p></div>
          <div className="min-w-0 px-1 text-center"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-hero-label">A receber</p><p className="font-display mt-2 break-words text-sm font-bold text-money tabular-nums">{formatCurrency(aReceber)}</p></div>
        </div>
      </section>
      <Button asChild className="h-[76px] w-full justify-start gap-3 rounded-[24px] px-4 shadow-glow">
        <Link to="/novo" search={{ data: undefined, cliente: undefined, servico: undefined, agenda: undefined, orcamento: undefined }}><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-primary-foreground/18"><Plus className="size-6!" /></span><span className="font-display flex-1 text-left text-base font-bold">Novo apontamento</span><ChevronRight className="size-6!" /></Link>
      </Button>
      <div className="grid grid-cols-3 gap-2">
        {[{ to: "/clientes", label: "Clientes", icon: Users }, { to: "/pecas", label: "Peças", icon: Package }, { to: "/valores", label: "Valores", icon: CircleDollarSign }].map(({ to, label, icon: Icon }) => <Button asChild key={to} variant="outline" className="h-14 rounded-[20px] px-2 text-xs"><Link to={to}><Icon className="text-primary" />{label}</Link></Button>)}
      </div>
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recentes <span className="font-normal">· {doMes.length} no mês</span></h2>
          <Link to="/historico" className="inline-flex min-h-11 items-center text-xs font-semibold text-primary">Ver tudo</Link>
        </div>
        {isLoading ? <p className="ios-group p-4 text-sm text-muted-foreground">Carregando...</p> : ultimos.length === 0 ? (
          <div className="ios-group space-y-3 px-5 py-8 text-center"><p className="font-display font-bold">Nenhum apontamento neste mês</p><p className="text-sm text-muted-foreground">Registre o primeiro atendimento para começar a somar suas horas.</p><Button asChild className="rounded-full"><Link to="/novo" search={{ data: undefined, cliente: undefined, servico: undefined, agenda: undefined, orcamento: undefined }}><Plus />Novo apontamento</Link></Button></div>
        ) : <ul className="space-y-2.5">{ultimos.map((a) => <li key={a.id}><Link to="/apontamento/$id" params={{ id: a.id }} className="press ios-group flex min-h-20 items-center gap-3 rounded-[22px] px-3 py-3"><span className="grid h-14 w-12 shrink-0 content-center rounded-[14px] bg-icon-bg text-center text-primary"><span className="font-display text-xl font-bold">{Number(a.data.slice(8, 10))}</span><span className="text-[9px] font-semibold uppercase">{new Date(`${a.data}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{a.clientes?.nome ?? "—"}</span><span className="mt-1 block text-xs text-muted-foreground">{diaRelativo(a.data)}</span></span><span className="font-display shrink-0 rounded-full bg-icon-bg px-3 py-2 text-xs font-bold text-primary tabular-nums">{formatDuracao(somarTotais([a]).trabalho)}</span></Link></li>)}</ul>}
      </section>

      <PagamentosCard relatorios={relatorios} />
      <NovoRecebimentoAvulsoButton />
      <LembretesPainel />
    </PageShell>
  );
}
