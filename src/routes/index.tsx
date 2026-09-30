import { createFileRoute, redirect } from "@tanstack/react-router";

import { recoverAppIdentity } from "@/lib/auth-session";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const recovery = await recoverAppIdentity();
    throw redirect({ to: recovery.identity ? "/painel" : "/auth" });
  },
  head: () => ({
    meta: [
      { title: "CP TECHNIC Horas" },
      { name: "description", content: "Acesse seus apontamentos técnicos com segurança." },
      { property: "og:title", content: "CP TECHNIC Horas" },
      {
        property: "og:description",
        content: "Apontamentos técnicos privados e disponíveis no iPhone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
