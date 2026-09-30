import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { recoverAppIdentity } from "@/lib/auth-session";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const recovery = await recoverAppIdentity();
    if (!recovery.identity) throw redirect({ to: "/auth" });
    return { user: recovery.identity.user, offline: recovery.identity.offline };
  },
  component: () => <Outlet />,
});
