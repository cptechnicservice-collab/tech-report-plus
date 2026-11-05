import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { CheckCircle2, Ban, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { changeAppAccess, listAccessUsers } from "@/lib/app-access";

const usersQuery = queryOptions({ queryKey: ["access-users"], queryFn: listAccessUsers, staleTime: 0, retry: false });
export const Route = createFileRoute("/_authenticated/usuarios")({
  beforeLoad: ({ context }) => { if (!context.access.admin) throw redirect({ to: "/painel" }); },
  loader: ({ context }) => context.queryClient.ensureQueryData(usersQuery),
  head: () => ({ meta: [
    { title: "Usuários e liberações — CP TECHNIC" },
    { name: "description", content: "Controle de liberação manual das contas do CP TECHNIC Horas." },
    { property: "og:title", content: "Usuários e liberações — CP TECHNIC" },
    { property: "og:description", content: "Aprovação e bloqueio de acesso pelo proprietário." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AccessUsers,
});
function AccessUsers() {
  const { data: users } = useSuspenseQuery(usersQuery);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const update = async (id: string, status: "approved" | "blocked") => {
    setBusy(id);
    try { await changeAppAccess(id, status); await queryClient.invalidateQueries({ queryKey: usersQuery.queryKey }); toast.success(status === "approved" ? "Acesso liberado." : "Acesso bloqueado."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o acesso."); }
    finally { setBusy(null); }
  };
  return <PageShell title="Usuários" backTo="/mais" action={<Button size="icon" variant="ghost" aria-label="Atualizar usuários" onClick={() => void queryClient.invalidateQueries({ queryKey: usersQuery.queryKey })}><RefreshCw className="h-5 w-5" /></Button>}>
    <div className="divide-y divide-border">
      {users.map(user => <div key={user.id} className="space-y-3 py-5">
        <p className="break-words font-semibold">{user.email ?? "Conta sem e-mail"}</p>
        <span className={`text-sm font-semibold ${user.status === "approved" || user.status === "owner" ? "text-success" : user.status === "blocked" ? "text-destructive" : "text-warning-foreground"}`}>
          {{ owner: "Proprietário", approved: "Liberado", pending: "Aguardando pagamento / aprovação", blocked: "Bloqueado" }[user.status]}
        </span>
        {user.status !== "owner" ? <div className="flex gap-2">
          {user.status !== "approved" ? <Button disabled={busy !== null} onClick={() => void update(user.id, "approved")}><CheckCircle2 className="h-4 w-4" /> Liberar acesso</Button> : null}
          {user.status !== "blocked" ? <Button disabled={busy !== null} variant="outline" onClick={() => { if (window.confirm("Bloquear o acesso deste usuário?")) void update(user.id, "blocked"); }}><Ban className="h-4 w-4" /> Bloquear</Button> : null}
        </div> : null}
      </div>)}
    </div>
  </PageShell>;
}