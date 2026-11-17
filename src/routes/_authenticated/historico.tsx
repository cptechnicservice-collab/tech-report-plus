import { RecebimentosAvulsosSection } from "@/components/RecebimentosAvulsos";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Copy, FileText, Search, X } from "lucide-react";

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
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
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
  const clearFilters = () => {
    setBusca("");
    setDe("");
    setAte("");
    setClienteId("");
    setClienteBusca("");
  };

  return (
    <PageShell title="Histórico" subtitle={`${filtrados.length} apontamento(s)`} action={<Button asChild variant="outline" size="icon" className="rounded-full" aria-label="Abrir relatório"><Link to="/relatorio" search={{ relatorio: undefined }}><FileText className="h-5 w-5" /></Link></Button>}>
      <RecebimentosAvulsosSection clienteId={clienteId} inicio={de} fim={ate} busca={busca} />
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
          <Button type="button" variant={clienteId ? "default" : "outline"} className="h-11 shrink-0 rounded-full px-4 text-sm" onClick={() => setFiltrosAbertos((v) => !v)}>
            <span className="max-w-[10rem] truncate">{clienteId ? clienteBusca || "Cliente" : "Cliente"}</span>
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
          <Button type="button" variant={de || ate ? "default" : "outline"} className="h-11 shrink-0 rounded-full px-4 text-sm tabular-nums" onClick={() => setFiltrosAbertos((v) => !v)}>
            {de || ate ? `${de ? formatDateBR(de) : "…"} – ${ate ? formatDateBR(ate) : "…"}` : "Período"}
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
          {hasFilters ? (
            <Button type="button" variant="ghost" className="h-11 shrink-0 rounded-full px-3 text-sm text-muted-foreground" onClick={clearFilters}>
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
        <div className="grid grid-cols-3 divide-x divide-border rounded-xl bg-secondary/70 py-2.5 text-center">
          <p className="px-1 text-xs text-muted-foreground"><strong className="block text-sm text-foreground tabular-nums">{filtrados.length}</strong>Atendimentos</p>
          <p className="px-1 text-xs text-muted-foreground"><strong className="block text-sm text-foreground tabular-nums">{formatMinutes(totais.trabalho + totais.viagem)}</strong>Horas</p>
          <p className="px-1 text-xs text-muted-foreground"><strong className="block text-sm text-foreground tabular-nums">{totais.km}</strong>KM</p>
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
              <ul className="ios-group divide-y divide-border overflow-hidden">
                {dia.itens.map((a) => {
                  const t = calcularTotais(a);
                  const ini = normalizeTime(a.trabalho_inicio);
                  const fim = normalizeTime(a.trabalho_fim);
                  const pendente = pendingIds.has(a.id);
                  return (
                    <li key={a.id} className="flex items-stretch">
                      <Link to="/apontamento/$id" params={{ id: a.id }} className="press min-w-0 flex-1 px-4 py-3">
                        <p className="truncate text-sm font-semibold">{a.clientes?.nome ?? "—"}</p>
                        {a.maquina_servico ? <p className="truncate text-xs text-muted-foreground">{a.maquina_servico}</p> : null}
                        <p className="mt-1 truncate text-sm tabular-nums">
                          {ini && fim ? `${ini} – ${fim} · ${formatMinutes(t.trabalho)}` : t.trabalho === 0 && t.viagem > 0 ? `Só viagem · ${formatMinutes(t.viagem)}` : "Sem horário"}
                          {t.km > 0 ? <span className="text-muted-foreground"> · {t.km} km</span> : null}
                        </p>
                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-medium ${pendente ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                          {pendente ? "Pendente de sincronização" : "Sincronizado"}
                        </span>
                      </Link>
                      <Link
                        to="/novo"
                        search={{ data: undefined, cliente: undefined, servico: undefined, agenda: undefined, orcamento: undefined, parecido: a.id }}
                        className="press flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 border-l border-border text-[0.6rem] text-muted-foreground"
                        aria-label="Novo a partir deste"
                        title="Novo a partir deste"
                      >
                        <Copy className="h-4 w-4" />
                        Novo
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {filtrados.length > visibleCount ? <Button type="button" variant="outline" className="h-12 w-full rounded-xl" onClick={() => setVisibleCount((count) => count + 40)}>Carregar mais {Math.min(40, filtrados.length - visibleCount)}</Button> : null}
    </PageShell>
  );
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
