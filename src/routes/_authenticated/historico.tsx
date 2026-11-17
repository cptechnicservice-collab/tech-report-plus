import { RecebimentosAvulsosSection } from "@/components/RecebimentosAvulsos";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, ChevronRight, Clock, Copy, FileText, MapPin, Search, UserRound, X } from "lucide-react";
import { formatDuracao } from "@/lib/duracao-format";

import { PageShell } from "@/components/PageShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getPendingApontamentoIds, subscribeOfflineStatus } from "@/lib/offline";
import {
  calcularTotais,
  fetchApontamentos,
  fetchClientes,
  formatDateBR,
  formatMinutes,
  normalizeSearchText,
  normalizeTime,
  somarTotais,
  todayISO,
} from "@/lib/apontamentos";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de apontamentos — CP TECHNIC Horas" },
      {
        name: "description",
        content: "Consulte apontamentos por data e cliente, filtre por período e edite registros.",
      },
      { property: "og:title", content: "Histórico de apontamentos — CP TECHNIC Horas" },
      {
        property: "og:description",
        content: "Busca por cliente e período com totais de horas e quilometragem.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Historico,
});

function Historico() {
  const [visibleCount, setVisibleCount] = useState(40);
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState(() => inicioDoMes());
  const [ate, setAte] = useState(() => fimDoMes());
  const [clienteId, setClienteId] = useState("");
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteFiltroAberto, setClienteFiltroAberto] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const refresh = () => void getPendingApontamentoIds().then(setPendingIds);
    refresh();
    return subscribeOfflineStatus(refresh);
  }, []);

  const { data: apontamentos = [], isLoading } = useQuery({
    queryKey: ["apontamentos"],
    queryFn: fetchApontamentos,
  });
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: fetchClientes });

  const filtrados = useMemo(() => {
    const termo = normalizeSearchText(busca);
    return apontamentos.filter((a) => {
      if (clienteId && a.cliente_id !== clienteId) return false;
      if (de && a.data < de) return false;
      if (ate && a.data > ate) return false;
      if (!termo) return true;
      return (
        normalizeSearchText(a.clientes?.nome ?? "").includes(termo) ||
        normalizeSearchText(a.maquina_servico ?? "").includes(termo)
      );
    });
  }, [apontamentos, busca, de, ate, clienteId]);

  const clientesEncontrados = useMemo(() => {
    const termo = normalizeSearchText(clienteBusca);
    return clientes.filter((cliente) => !termo || normalizeSearchText(cliente.nome).includes(termo));
  }, [clientes, clienteBusca]);

  const totais = somarTotais(filtrados);
  const hasFilters = Boolean(busca || de || ate || clienteId);
  const esteMes = de === inicioDoMes() && ate === fimDoMes();
  const periodoAtivo = Boolean(de || ate) && !esteMes;
  const clearFilters = () => {
    setBusca("");
    setDe("");
    setAte("");
    setClienteId("");
    setClienteBusca("");
  };

  return (
    <PageShell large title="Histórico" action={<Button asChild variant="ghost" size="icon" className="h-11 w-11 rounded-full bg-icon-bg text-muted-foreground" aria-label="Abrir relatório"><Link to="/relatorio" search={{ relatorio: undefined }}><FileText className="h-5 w-5" /></Link></Button>}>
      <section className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente ou serviço"
            className="rounded-full bg-secondary pl-9"
          />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Button type="button" className={`h-12 shrink-0 rounded-full px-4 text-sm font-semibold ${esteMes ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-chip text-foreground hover:bg-chip"}`} onClick={() => { if (esteMes) { setDe(""); setAte(""); } else { setDe(inicioDoMes()); setAte(fimDoMes()); } }}>
            <CalendarDays className="mr-1.5 h-4 w-4" /> Este mês
          </Button>
          <Button type="button" className={`h-12 shrink-0 rounded-full px-4 text-sm font-semibold ${clienteId ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-chip text-foreground hover:bg-chip"}`} onClick={() => setFiltrosAbertos((v) => !v)}>
            <UserRound className="mr-1.5 h-4 w-4" />
            <span className="max-w-[9rem] truncate">{clienteId ? clienteBusca || "Cliente" : "Cliente"}</span>
          </Button>
          <Button type="button" className={`h-12 shrink-0 rounded-full px-4 text-sm font-semibold tabular-nums ${periodoAtivo ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-chip text-foreground hover:bg-chip"}`} onClick={() => setFiltrosAbertos((v) => !v)}>
            <CalendarDays className="mr-1.5 h-4 w-4" />
            {periodoAtivo ? `${de ? formatDateBR(de).slice(0, 5) : "…"} – ${ate ? formatDateBR(ate).slice(0, 5) : "…"}` : "Período"}
          </Button>
          {hasFilters && !esteMes ? (
            <Button type="button" variant="ghost" className="h-12 shrink-0 rounded-full px-3 text-sm text-muted-foreground" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" /> Limpar
            </Button>
          ) : null}
        </div>
        {filtrosAbertos ? (
          <div className="ios-group space-y-4 p-4">
        <div className="relative space-y-1.5">
          <Label htmlFor="cliente-filtro" className="text-xs text-muted-foreground">
            Cliente
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
            id="cliente-filtro"
              value={clienteBusca}
              onFocus={() => setClienteFiltroAberto(true)}
              onBlur={() => window.setTimeout(() => setClienteFiltroAberto(false), 120)}
              onChange={(event) => {
                setClienteBusca(event.target.value);
                setClienteId("");
                setClienteFiltroAberto(true);
              }}
              placeholder="Todos os clientes"
              autoComplete="off"
              className="h-12 rounded-xl pl-9 pr-10"
            />
            {clienteBusca ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Limpar filtro de cliente"
                className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setClienteBusca("");
                  setClienteId("");
                  setClienteFiltroAberto(true);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          {clienteFiltroAberto ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border bg-card p-1 shadow-sm">
              {clientesEncontrados.length ? (
                clientesEncontrados.map((cliente) => (
                  <Button
                    key={cliente.id}
                    type="button"
                    variant="ghost"
                    className="h-11 w-full justify-between rounded-lg px-3 font-normal"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setClienteId(cliente.id);
                      setClienteBusca(cliente.nome);
                      setClienteFiltroAberto(false);
                    }}
                  >
                    <span className="truncate">{cliente.nome}</span>
                    {clienteId === cliente.id ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                  </Button>
                ))
              ) : (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
              )}
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
        </div>
          </div>
        ) : null}
        <div className="grid grid-cols-3 divide-x divide-border rounded-[1.125rem] bg-chip py-3">
          {[
            { icon: FileText, value: `${filtrados.length}`, label: filtrados.length === 1 ? "atendimento" : "atendimentos" },
            { icon: Clock, value: formatDuracao(totais.trabalho + totais.viagem), label: "horas" },
            { icon: MapPin, value: `${totais.km.toLocaleString("pt-BR")} km`, label: "rodados" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex items-center justify-center gap-1.5 px-1.5">
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <p className="min-w-0 text-xs leading-tight text-muted-foreground"><strong className="block truncate text-sm text-foreground tabular-nums">{value}</strong>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <div className="card-surface space-y-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {hasFilters ? "Nenhum apontamento no filtro atual." : "Nenhum apontamento salvo."}
          </p>
          {hasFilters ? <Button type="button" variant="outline" size="sm" onClick={clearFilters}>Limpar filtros</Button> : null}
        </div>
      ) : (
        <div className="space-y-5">
          {agruparPorData(filtrados.slice(0, visibleCount)).map((dia) => (
            <section key={dia.data} className="space-y-2">
              <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground">{dia.rotulo}</h2>
              <ul className="relative space-y-3 pl-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-border">
                {dia.itens.map((a) => {
                  const t = calcularTotais(a);
                  const ini = normalizeTime(a.trabalho_inicio);
                  const fim = normalizeTime(a.trabalho_fim);
                  const pendente = pendingIds.has(a.id);
                  return (
                    <li key={a.id} className="relative">
                      <span aria-hidden className="absolute -left-[22px] top-5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                      <div className="ios-group relative">
                        <Link to="/apontamento/$id" params={{ id: a.id }} className="press block p-4 pr-10">
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 truncate text-[0.95rem] font-bold">{a.clientes?.nome ?? "—"}</p>
                            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${pendente ? "bg-chip text-muted-foreground" : "bg-success/15 text-success"}`}>
                              {pendente ? <FileText className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                              {pendente ? "Pendente de sincronização" : "Sincronizado"}
                            </span>
                          </div>
                          {a.maquina_servico ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{a.maquina_servico}</p> : null}
                          <p className="mt-1.5 flex items-center gap-1.5 truncate text-sm tabular-nums">
                            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                            {ini && fim ? `${ini}–${fim} · ${formatDuracao(t.trabalho)}` : t.trabalho === 0 && t.viagem > 0 ? `Só viagem · ${formatDuracao(t.viagem)}` : "Sem horário"}
                            {t.km > 0 ? <span className="text-muted-foreground"> · {t.km} km</span> : null}
                          </p>
                        </Link>
                        <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <Link
                          to="/novo"
                          search={{ data: undefined, cliente: undefined, servico: undefined, agenda: undefined, orcamento: undefined, parecido: a.id }}
                          className="press absolute bottom-2 right-9 grid h-10 w-10 place-items-center rounded-full text-muted-foreground"
                          aria-label="Novo a partir deste"
                          title="Novo a partir deste"
                        >
                          <Copy className="h-4 w-4" />
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {filtrados.length > visibleCount ? <Button type="button" variant="outline" className="h-12 w-full rounded-xl" onClick={() => setVisibleCount((count) => count + 40)}>Carregar mais {Math.min(40, filtrados.length - visibleCount)}</Button> : null}
      <RecebimentosAvulsosSection clienteId={clienteId} inicio={de} fim={ate} busca={busca} />
    </PageShell>
  );
}

function inicioDoMes() {
  return `${todayISO().slice(0, 7)}-01`;
}

function fimDoMes() {
  const [ano, mes] = todayISO().split("-").map(Number);
  const ultimo = new Date(ano ?? 2000, mes ?? 1, 0).getDate();
  return `${todayISO().slice(0, 7)}-${String(ultimo).padStart(2, "0")}`;
}

type Apt = Awaited<ReturnType<typeof fetchApontamentos>>[number];

function agruparPorData(lista: Apt[]) {
  const dias: { data: string; rotulo: string; itens: Apt[] }[] = [];
  const ordenada = [...lista].sort((x, y) => (x.data < y.data ? 1 : x.data > y.data ? -1 : 0));
  for (const a of ordenada) {
    let dia = dias[dias.length - 1];
    if (!dia || dia.data !== a.data) {
      const d = new Date(`${a.data}T12:00:00`);
      const semana = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      const mes = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      dia = { data: a.data, rotulo: `${semana}, ${d.getDate()} ${mes}`.toUpperCase(), itens: [] };
      dias.push(dia);
    }
    dia.itens.push(a);
  }
  return dias;
}
