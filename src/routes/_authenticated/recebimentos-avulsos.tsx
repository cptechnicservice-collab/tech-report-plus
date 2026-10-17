import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/PageShell";
import { FloatingInput, FloatingSelect } from "@/components/FloatingField";
import { NovoRecebimentoAvulsoButton, RecebimentoAvulsoEditor, RecebimentosAvulsosSection } from "@/components/RecebimentosAvulsos";
import { fetchClientes } from "@/lib/apontamentos";
import { recebimentosAvulsosQuery } from "@/lib/recebimentos-avulsos";

export const Route = createFileRoute("/_authenticated/recebimentos-avulsos")({
  validateSearch: (search: Record<string, unknown>) => ({ novo: search["novo"] === true || search["novo"] === "true" }),
  loader: ({ context }) => context.queryClient.ensureQueryData(recebimentosAvulsosQuery()),
  head: () => ({ meta: [
    { title: "Recebimentos avulsos — CP TECHNIC Horas" },
    { name: "description", content: "Entradas independentes por cliente e data de recebimento." },
    { property: "og:title", content: "Recebimentos avulsos — CP TECHNIC Horas" },
    { property: "og:description", content: "Controle privado de recebimentos por cliente e período." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: RecebimentosAvulsos,
});

function RecebimentosAvulsos() {
  const { novo } = Route.useSearch();
  const navigate = useNavigate();
  const [clienteId, setClienteId] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: fetchClientes });
  return <PageShell title="Recebimentos avulsos" backTo="/mais">
    <NovoRecebimentoAvulsoButton />
    <FloatingSelect label="Cliente" value={clienteId} onChange={(event) => setClienteId(event.target.value)}><option value="">Todos os clientes</option>{clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}</FloatingSelect>
    <div className="grid grid-cols-2 gap-3"><FloatingInput label="De" type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} /><FloatingInput label="Até" type="date" value={fim} onChange={(event) => setFim(event.target.value)} /></div>
    <RecebimentosAvulsosSection clienteId={clienteId} inicio={inicio} fim={fim} />
    {novo ? <RecebimentoAvulsoEditor open onOpenChange={(open) => { if (!open) void navigate({ to: "/recebimentos-avulsos", search: { novo: false }, replace: true }); }} /> : null}
  </PageShell>;
}