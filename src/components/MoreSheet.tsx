import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Database,
  Package,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { getOfflineQueueStatus, subscribeOfflineStatus } from "@/lib/offline";
import { openSyncPanel } from "@/lib/offline-events";

const options = [
  { to: "/dados-empresa", label: "Dados da empresa", icon: Building2 },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/pecas", label: "Peças", icon: Package },
  { to: "/valores", label: "Valores", icon: CircleDollarSign },
  { to: "/orcamentos", label: "Orçamentos", icon: ClipboardList },
] as const;

type MoreSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MoreSheet({ open, onOpenChange }: MoreSheetProps) {
  const [pending, setPending] = useState(0);

  const refreshStatus = useCallback(async () => {
    const status = await getOfflineQueueStatus();
    setPending(status.pending);
  }, []);

  useEffect(() => {
    if (open) void refreshStatus();
    return subscribeOfflineStatus(() => void refreshStatus());
  }, [open, refreshStatus]);

  const showSync = () => {
    onOpenChange(false);
    window.setTimeout(openSyncPanel, 180);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent
        overlayClassName="bg-foreground/35 backdrop-blur-sm"
        className="bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-3 right-3 max-h-[calc(100dvh-env(safe-area-inset-top)-2rem)] rounded-[2rem] border-border bg-card shadow-nav sm:mx-auto sm:max-w-md"
      >
        <DrawerHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 px-5 pb-3 pt-3 text-left">
          <div className="min-w-0">
            <DrawerDescription className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-primary">
              CP TECHNIC
            </DrawerDescription>
            <DrawerTitle className="mt-1 text-2xl font-bold leading-tight">Mais opções</DrawerTitle>
          </div>
          <DrawerClose asChild>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Fechar mais opções"
              className="h-11 w-11 shrink-0 rounded-xl"
            >
              <X className="h-5 w-5" />
            </Button>
          </DrawerClose>
        </DrawerHeader>

        <div className="mx-5 mb-5 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="divide-y divide-border">
            {options.map(({ to, label, icon: Icon }) => (
              <DrawerClose asChild key={to}>
                <Link to={to} className="press grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4">
                  <Icon className="h-5 w-5 shrink-0 text-foreground" strokeWidth={1.7} />
                  <span className="min-w-0 truncate font-semibold">{label}</span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </Link>
              </DrawerClose>
            ))}
            <Button
              type="button"
              variant="ghost"
              onClick={showSync}
              className="press grid min-h-14 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-none px-4 text-left"
            >
              <Database className="h-5 w-5 shrink-0 text-foreground" strokeWidth={1.7} />
              <span className="min-w-0 truncate font-semibold">Sincronização</span>
              <span className={pending === 0 ? "flex shrink-0 items-center gap-1 text-sm font-semibold text-success" : "shrink-0 text-sm font-semibold text-warning-foreground"}>
                {pending === 0 ? <CheckCircle2 className="h-4 w-4" /> : null}
                {pending === 0 ? "OK" : `${pending} pendente${pending === 1 ? "" : "s"}`}
              </span>
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}