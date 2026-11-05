import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { LockKeyhole, RefreshCw } from "lucide-react";
import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { recoverAppIdentity } from "@/lib/auth-session";
import { resolveAppAccess } from "@/lib/app-access";

export const Route = createFileRoute("/acesso-pendente")({
  ssr: false,
  beforeLoad: async () => {
    const recovery = await recoverAppIdentity();
    if (!recovery.identity) throw redirect({ to: "/auth" });
    const access = await resolveAppAccess(recovery.identity.userId, recovery.identity.offline);
    if (access.status === "approved") throw redirect({ to: "/painel" });
    return { access };
  },
  head: () => ({ meta: [
    { title: "Acesso aguardando liberação — CP TECHNIC" },
    { name: "description", content: "Consulte a liberação da sua conta no CP TECHNIC Horas." },
    { property: "og:title", content: "Liberação de acesso — CP TECHNIC" },
    { property: "og:description", content: "Acesso mediante pagamento e aprovação do responsável." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: PendingAccess,
});

function PendingAccess() {
  const { access } = Route.useRouteContext();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <PageShell title="Acesso restrito">
    <div className="space-y-5 py-12 text-center">
      <LockKeyhole className="mx-auto h-12 w-12 text-primary" />
      <h2 className="text-xl font-semibold">{access.status === "blocked" ? "Acesso bloqueado" : "Aguardando liberação"}</h2>
      <p className="text-muted-foreground">O uso do app é pago. Entre em contato com Clarel Pavan para combinar o pagamento e a liberação da sua conta.</p>
      <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await router.invalidate(); } finally { setBusy(false); } }}>
        <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Verificar liberação
      </Button>
    </div>
  </PageShell>;
}