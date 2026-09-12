import { createFileRoute } from "@tanstack/react-router";

import { ApontamentoForm } from "@/components/ApontamentoForm";
import { PageShell } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/novo")({
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
  return (
    <PageShell title="Novo apontamento" subtitle="Horários preenchidos manualmente">
      <ApontamentoForm />
    </PageShell>
  );
}
