import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/orcamentos-nao-confirmados")({
  head: () => ({ meta: [
    { title: "Orçamentos não confirmados — CP TECHNIC Horas" },
    { name: "description", content: "Relatórios aguardando a confirmação do cliente." },
    { property: "og:title", content: "Orçamentos não confirmados — CP TECHNIC Horas" },
    { property: "og:description", content: "Relatórios aguardando a confirmação do cliente." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/relatorios-salvos", search: { naoConfirmados: true } });
  },
});
