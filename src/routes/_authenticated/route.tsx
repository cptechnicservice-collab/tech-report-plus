import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { resolveNavigationAccess } from "@/lib/navigation-access";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { identity, access } = await resolveNavigationAccess();
    if (!identity) throw redirect({ to: "/auth" });
    if (access?.status !== "approved") throw redirect({ to: "/acesso-pendente" });
    return { user: identity.user, offline: identity.offline, access };
  },
  component: () => <Outlet />,
});
