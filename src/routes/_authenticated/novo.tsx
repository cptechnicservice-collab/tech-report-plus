import { createFileRoute } from "@tanstack/react-router";

import { ApontamentoForm } from "@/components/ApontamentoForm";
import { PageShell } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/novo")({
  validateSearch: (search: Record<string, unknown>) => ({
    data: typeof search["data"] === "string" ? search["data"] : undefined,
    cliente: typeof search["cliente"] === "string" ? search["cliente"] : undefined,
    servico: typeof search["servico"] === "string" ? search["servico"] : undefined,
    agenda: typeof search["agenda"] === "string" ? search["agenda"] : undefined,
    orcamento: typeof search["orcamento"] === "string" ? search["orcamento"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Novo apontamento — CP TECHNIC Horas" },
      {
        name: "description",
        content:
          "Registre data, cliente, horários de viagem, trabalho, intervalo e quilometragem do dia.",
      },
      { property: "og:title", content: "Novo apontamento — CP TECHNIC Horas" },
      {
        property: "og:description",
        content: "Apontamento manual de horas e km para técnico de campo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NovoApontamento,
});

function NovoApontamento() {
  const search = Route.useSearch();
  return (
    <PageShell title="Novo apontamento" subtitle="Horários preenchidos manualmente">
      <ApontamentoForm draft={{ data: search.data, clienteId: search.cliente, servico: search.servico, agendaId: search.agenda, orcamentoId: search.orcamento }} />
    </PageShell>
  );
}
