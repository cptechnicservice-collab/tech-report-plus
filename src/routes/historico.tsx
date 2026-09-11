import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileText, Search } from "lucide-react";

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
    ],
  }),
  component: Historico,
});

function Historico() {
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [clienteId, setClienteId] = useState("");
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
    const termo = busca.trim().toLowerCase();
    return apontamentos.filter((a) => {
      if (clienteId && a.cliente_id !== clienteId) return false;
      if (de && a.data < de) return false;
      if (ate && a.data > ate) return false;
      if (!termo) return true;
      return (
        (a.clientes?.nome ?? "").toLowerCase().includes(termo) ||
        (a.maquina_servico ?? "").toLowerCase().includes(termo)
      );
    });
  }, [apontamentos, busca, de, ate, clienteId]);

  const totais = somarTotais(filtrados);

  return (
    <PageShell title="Histórico" subtitle={`${filtrados.length} apontamento(s)`} action={<Button asChild variant="outline" size="icon" className="h-11 w-11 rounded-xl" aria-label="Abrir relatório"><Link to="/relatorio"><FileText className="h-5 w-5" /></Link></Button>}>
      <Section title="Filtros">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente ou serviço"
            className="h-12 rounded-xl pl-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cliente-filtro" className="text-xs text-muted-foreground">
            Cliente
          </Label>
          <select
            id="cliente-filtro"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="h-12 w-full rounded-xl border border-input bg-background px-3"
          >
            <option value="">Todos os clientes</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
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
        <p className="text-xs text-muted-foreground">
          Total: {formatMinutes(totais.trabalho)} trabalhadas · {formatMinutes(totais.viagem)} de
          viagem · {totais.km} km
        </p>
      </Section>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtrados.length === 0 ? (
        <p className="card-surface p-6 text-center text-sm text-muted-foreground">
          Nenhum apontamento no filtro atual.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtrados.map((a) => {
            const t = calcularTotais(a);
            return (
              <li key={a.id}>
                <Link
                  to="/apontamento/$id"
                  params={{ id: a.id }}
                  className="card-surface flex items-center gap-3 p-4"
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
