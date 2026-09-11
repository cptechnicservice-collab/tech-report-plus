import type { ReactNode } from "react";

export function PageShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-lg px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-28">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 px-1 pb-5 pt-4">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold uppercase text-primary">CP TECHNIC</p>
          <h1 className="truncate text-[2rem] font-bold leading-none">{title}</h1>
          {subtitle ? <p className="mt-2 truncate text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <main className="space-y-5">{children}</main>
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
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-[0.72rem] font-semibold uppercase text-muted-foreground">
          {title}
        </h2>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <div className="ios-group space-y-3 p-4">{children}</div>
    </section>
  );
}
