import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { recoverAppIdentity } from "@/lib/auth-session";
import { resolveAppAccess } from "@/lib/app-access";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const recovery = await recoverAppIdentity();
    if (!recovery.identity) throw redirect({ to: "/auth" });
    const access = await resolveAppAccess(recovery.identity.userId, recovery.identity.offline);
    if (access.status !== "approved") throw redirect({ to: "/acesso-pendente" });
    return { user: recovery.identity.user, offline: recovery.identity.offline, access };
  },
  component: () => <Outlet />,
});
