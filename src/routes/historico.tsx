import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, FileText, Search, X } from "lucide-react";

import { PageShell, Section } from "@/components/PageShell";
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

export const Route = createFileRoute("/historico")({
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
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteFiltroAberto, setClienteFiltroAberto] = useState(false);
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
    <PageShell title="Histórico" subtitle={`${filtrados.length} apontamento(s)`} action={<Button asChild variant="outline" size="icon" className="rounded-full" aria-label="Abrir relatório"><Link to="/relatorio"><FileText className="h-5 w-5" /></Link></Button>}>
      <Section title="Filtros">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente ou serviço"
            className="rounded-full bg-secondary pl-9"
          />
        </div>
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
        <div className="grid grid-cols-3 divide-x divide-border rounded-xl bg-secondary/70 py-3 text-center">
          <p className="px-1 text-xs text-muted-foreground"><strong className="block text-sm text-foreground">{formatMinutes(totais.trabalho)}</strong>Trabalho</p>
          <p className="px-1 text-xs text-muted-foreground"><strong className="block text-sm text-foreground">{formatMinutes(totais.viagem)}</strong>Viagem</p>
          <p className="px-1 text-xs text-muted-foreground"><strong className="block text-sm text-foreground">{totais.km}</strong>KM</p>
        </div>
      </Section>

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
        <ul className="ios-group divide-y divide-border">
          {filtrados.map((a) => {
            const t = calcularTotais(a);
            return (
              <li key={a.id}>
                <Link
                  to="/apontamento/$id"
                  params={{ id: a.id }}
                  className="press flex min-h-[4.5rem] items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatDateBR(a.data)}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        {a.clientes?.nome ?? "—"}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {normalizeTime(a.trabalho_inicio) || "--:--"} às{" "}
                      {normalizeTime(a.trabalho_fim) || "--:--"} · {formatMinutes(t.trabalho)}{" "}
                      trabalho · {formatMinutes(t.viagem)} viagem · {t.km} km
                    </p>
                    {pendingIds.has(a.id) ? <span className="mt-1 inline-block text-xs font-medium text-primary">Pendente de envio</span> : null}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
