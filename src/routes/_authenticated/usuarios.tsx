import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { CheckCircle2, Ban, RefreshCw, ShieldCheck, ShieldMinus } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { accessErrorMessage, canManageAccount, changeAccountRole, changeAppAccess, listAccessUsers, type AccessUser } from "@/lib/app-access";

const usersQuery = queryOptions({ queryKey: ["access-users"], queryFn: listAccessUsers, staleTime: 0, retry: false });
export const Route = createFileRoute("/_authenticated/usuarios")({
  beforeLoad: ({ context }) => { if (!context.access.admin) throw redirect({ to: "/painel" }); },
  loader: ({ context }) => context.queryClient.ensureQueryData(usersQuery),
  head: () => ({ meta: [
    { title: "Usuários e liberações — CP TECHNIC" },
    { name: "description", content: "Controle de liberação manual das contas do CP TECHNIC Horas." },
    { property: "og:title", content: "Usuários e liberações — CP TECHNIC" },
    { property: "og:description", content: "Papéis e liberação de contas do CP TECHNIC Horas." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AccessUsers,
});
function AccessUsers() {
  const { access } = Route.useRouteContext();
  const { data: users } = useSuspenseQuery(usersQuery);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ user: AccessUser; action: "blocked" | "admin" | "technician" } | null>(null);
  const update = async (id: string, status: "approved" | "blocked") => {
    setBusy(id);
    try { await changeAppAccess(id, status); await queryClient.invalidateQueries({ queryKey: usersQuery.queryKey }); toast.success(status === "approved" ? "Acesso liberado." : "Acesso bloqueado."); }
    catch (error) { toast.error(accessErrorMessage(error)); }
    finally { setBusy(null); }
  };
  const updateRole = async (id: string, role: "admin" | "technician") => {
    setBusy(id);
    try {
      await changeAccountRole(id, role);
      await queryClient.invalidateQueries({ queryKey: usersQuery.queryKey });
      toast.success(role === "admin" ? "Conta definida como admin." : "Conta definida como técnico.");
    } catch (error) { toast.error(accessErrorMessage(error)); }
    finally { setBusy(null); }
  };
  return <PageShell title="Usuários" backTo="/mais" action={<Button size="icon" variant="ghost" aria-label="Atualizar usuários" onClick={() => void queryClient.invalidateQueries({ queryKey: usersQuery.queryKey })}><RefreshCw className="h-5 w-5" /></Button>}>
    <div className="divide-y divide-border">
      {users.map(user => <div key={user.id} className="space-y-3 py-5">
        <p className="break-words font-semibold">{user.email ?? "Conta sem e-mail"}</p>
        <p className="text-sm text-muted-foreground">Criada em {new Date(user.created_at).toLocaleDateString("pt-BR")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">{{ owner: "Proprietário", admin: "Admin", technician: "Técnico" }[user.role]}</span>
          <span className={`rounded-full bg-secondary px-3 py-1 text-sm font-semibold ${user.status === "approved" ? "text-success" : user.status === "blocked" ? "text-destructive" : "text-warning-foreground"}`}>
            {{ approved: "Liberado", pending: "Pendente", blocked: "Bloqueado" }[user.status]}
          </span>
        </div>
        {canManageAccount(access, user.role) ? <div className="flex flex-wrap gap-2">
          {user.status !== "approved" ? <Button className="min-h-11" disabled={busy !== null} onClick={() => void update(user.id, "approved")}><CheckCircle2 className="h-4 w-4" /> Aprovar</Button> : null}
          {user.status !== "blocked" ? <Button className="min-h-11" disabled={busy !== null} variant="outline" onClick={() => setConfirmation({ user, action: "blocked" })}><Ban className="h-4 w-4" /> Bloquear</Button> : null}
          {access.role === "owner" ? <Button className="min-h-11" disabled={busy !== null} variant="outline" onClick={() => setConfirmation({ user, action: user.role === "admin" ? "technician" : "admin" })}>
            {user.role === "admin" ? <ShieldMinus className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}{user.role === "admin" ? "Remover admin" : "Tornar admin"}
          </Button> : null}
        </div> : null}
      </div>)}
    </div>
    <AlertDialog open={confirmation !== null} onOpenChange={open => { if (!open) setConfirmation(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmation?.action === "blocked" ? "Bloquear acesso?" : confirmation?.action === "admin" ? "Tornar admin?" : "Remover admin?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {confirmation?.user.email ?? "Esta conta"}: {confirmation?.action === "blocked" ? "o acesso será bloqueado quando a conta se reconectar." : confirmation?.action === "admin" ? "poderá aprovar e bloquear técnicos quando estiver liberada." : "voltará a ser técnico e não poderá gerenciar outras contas."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={busy !== null} onClick={() => {
            if (!confirmation) return;
            const { user, action } = confirmation;
            if (action === "blocked") void update(user.id, action);
            else void updateRole(user.id, action);
            setConfirmation(null);
          }}>Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </PageShell>;
}