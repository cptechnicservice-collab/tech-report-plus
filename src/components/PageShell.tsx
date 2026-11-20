import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PageShell({
  title,
  subtitle,
  action,
  backTo,
  onBack,
  centered,
  large,
  compact,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode;
  backTo?: "/mais" | "/historico" | "/relatorios-salvos" | "/orcamentos" | "/painel" | "/resumos";
  onBack?: (() => void) | undefined;
  centered?: boolean;
  large?: boolean;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-lg px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-24">
      <header
        className={`mb-7 grid min-h-16 items-center ${compact ? "mb-4 min-h-11" : ""} ${backTo || onBack ? "grid-cols-[auto_minmax(0,1fr)_auto] gap-2" : "grid-cols-[minmax(0,1fr)_auto] gap-3"}`}
      >
        {onBack ? (
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="Voltar" title="Voltar" onClick={onBack}>
            <ChevronLeft className="h-7 w-7" />
          </Button>
        ) : backTo ? (
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
        <div className={`min-w-0 ${centered ? "text-center" : ""}`}>
          {centered || large || compact ? null : <p className="mb-2 inline-flex rounded-md bg-brand-header px-2 py-1 text-[0.62rem] font-bold uppercase text-brand-header-foreground">
            CP <span className="ml-1 text-primary">TECHNIC</span>
          </p>}
          <h1 className={`truncate font-bold leading-tight ${compact ? "text-[0.95rem] tracking-tight" : large ? "text-[2rem] tracking-tight" : centered ? "text-lg" : "text-[1.65rem] leading-none"}`}>{title}</h1>
          {subtitle ? (
            <p className={`truncate text-muted-foreground ${compact ? "mt-0.5 text-[0.72rem] leading-snug" : "mt-1.5 text-sm"}`}>{subtitle}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
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
