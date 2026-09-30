import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { clearOfflineUserData } from "@/lib/offline";
import { clearConfirmedUser } from "@/lib/auth-session";

export function PageShell({
  title,
  subtitle,
  action,
  backTo,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode;
  backTo?: "/mais" | "/historico" | "/relatorios-salvos" | "/orcamentos";
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await clearOfflineUserData();
    clearConfirmedUser();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  };
  return (
    <div className="mx-auto min-h-screen w-full max-w-lg px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-28">
      <header
        className={`mb-7 grid min-h-16 items-center ${backTo ? "grid-cols-[auto_minmax(0,1fr)_auto] gap-2" : "grid-cols-[minmax(0,1fr)_auto] gap-3"}`}
      >
        {backTo ? (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full"
            aria-label="Voltar"
            title="Voltar"
          >
            <Link to={backTo}>
              <ChevronLeft className="h-7 w-7" />
            </Link>
          </Button>
        ) : null}
        <div className="min-w-0">
          <p className="mb-2 inline-flex rounded-md bg-brand-header px-2 py-1 text-[0.62rem] font-bold uppercase text-brand-header-foreground">
            CP <span className="ml-1 text-primary">TECHNIC</span>
          </p>
          <h1 className="truncate text-[1.65rem] font-bold leading-none">{title}</h1>
          {subtitle ? (
            <p className="mt-1.5 truncate text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full text-muted-foreground"
            aria-label="Sair"
            title="Sair"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>
      <main className="space-y-6">{children}</main>
    </div>
  );
}

export function Section({
  title,
  children,
  hint,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <div className="ios-group space-y-4 p-4">{children}</div>
    </section>
  );
}
