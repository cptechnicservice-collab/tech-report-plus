import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { ApontamentoForm } from "@/components/ApontamentoForm";
import { PageShell } from "@/components/PageShell";
import { fetchApontamento, formatDateBR } from "@/lib/apontamentos";

export const Route = createFileRoute("/_authenticated/apontamento/$id")({
  head: () => ({
    meta: [
      { title: "Editar apontamento — CP TECHNIC Horas" },
      {
        name: "description",
        content: "Abra e ajuste um apontamento já registrado: horários, quilometragem e observações.",
      },
      { property: "og:title", content: "Editar apontamento — CP TECHNIC Horas" },
      {
        property: "og:description",
        content: "Ajuste horários, km e observações de um apontamento existente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditarApontamento,
});

function EditarApontamento() {
  const { id } = Route.useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["apontamento", id],
    queryFn: () => fetchApontamento(id),
  });

  return (
    <PageShell
      title="Editar apontamento"
      subtitle={data ? `${formatDateBR(data.data)} · ${data.clientes?.nome ?? ""}` : undefined}
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : isError || !data ? (
        <p className="text-sm text-muted-foreground">Apontamento não encontrado.</p>
      ) : (
        <ApontamentoForm key={data.id} apontamento={data} />
      )}
    </PageShell>
  );
}
