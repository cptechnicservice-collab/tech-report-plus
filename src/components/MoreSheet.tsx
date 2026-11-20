import { useCallback, useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  CalendarPlus,
  ChartPie,
  FileArchive,
  LogOut,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Database,
  Package,
  Users,
  X,
} from "lucide-react";

import { BrandMark } from "@/components/BrandMark";
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
import { useSignOut } from "@/hooks/use-sign-out";

const options = [
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/pecas", label: "Peças", icon: Package },
  { to: "/orcamentos-nao-confirmados", label: "Orçamentos não confirmados", icon: ClipboardList },
  { to: "/valores", label: "Valores", icon: CircleDollarSign },
  { to: "/recebimentos-avulsos", label: "Recebimento avulso", icon: CircleDollarSign },
  { to: "/orcamentos", label: "Orçamentos", icon: ClipboardList },
  { to: "/dados-empresa", label: "Dados da empresa", icon: Building2 },
] as const;

type MoreSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MoreSheet({ open, onOpenChange }: MoreSheetProps) {
  const isAdmin = useRouterState({ select: (state) => state.matches.some((match) => "access" in match.context && match.context.access?.admin === true) });
  const [pending, setPending] = useState(0);
  const signOut = useSignOut();

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
        className="bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-3 right-3 max-h-[calc(100dvh-env(safe-area-inset-top)-2rem)] rounded-[2rem] border-border bg-background shadow-nav sm:mx-auto sm:max-w-md"
      >
        <DrawerHeader className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 pb-5 pt-3 text-left">
          <BrandMark />
          <div className="min-w-0">
            <DrawerTitle className="font-display text-lg font-bold leading-tight">CP TECHNIC Horas</DrawerTitle>
            <DrawerDescription className="mt-1 text-xs">CP TECHNIC</DrawerDescription>
          </div>
          <DrawerClose asChild><Button type="button" variant="outline" size="icon" aria-label="Fechar mais opções" className="h-11 w-11 shrink-0 rounded-[14px]"><X className="h-5 w-5" /></Button></DrawerClose>
        </DrawerHeader>

        <div className="space-y-4 px-5 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <DrawerClose asChild><Link to="/novo" search={{ data: undefined, cliente: undefined, servico: undefined, agenda: undefined, orcamento: undefined }} className="more-tile"><span className="more-icon"><CalendarPlus /></span><span>Novo apontamento</span></Link></DrawerClose>
            <DrawerClose asChild><Link to="/relatorios-salvos" className="more-tile"><span className="more-icon"><FileArchive /></span><span>Relatórios salvos</span></Link></DrawerClose>
            <DrawerClose asChild><Link to="/resumos" className="more-tile"><span className="more-icon"><ChartPie /></span><span>Resumos</span></Link></DrawerClose>
            {options.map(({ to, label, icon: Icon }) => (
              <DrawerClose asChild key={to}><Link to={to} search={to === "/recebimentos-avulsos" ? { novo: true } : {}} className="more-tile"><span className="more-icon"><Icon strokeWidth={1.7} /></span><span>{label}</span></Link></DrawerClose>
            ))}
            <Button type="button" variant="ghost" onClick={showSync} className="more-tile h-auto items-start whitespace-normal text-left">
              <span className="more-icon"><Database strokeWidth={1.7} /></span>
              <span>Sincronização</span>
              <span className={pending === 0 ? "flex items-center gap-1 text-xs text-success" : "text-xs text-warning-foreground"}>{pending === 0 ? <CheckCircle2 className="h-4 w-4" /> : null}{pending === 0 ? "OK" : `${pending} pendente${pending === 1 ? "" : "s"}`}</span>
            </Button>
            {isAdmin ? <DrawerClose asChild><Link to="/usuarios" className="more-tile"><span className="more-icon"><Users /></span><span>Usuários e liberações</span></Link></DrawerClose> : null}
          </div>
          <Button type="button" variant="outline" onClick={() => { onOpenChange(false); void signOut(); }} className="h-14 w-full rounded-[22px] text-destructive hover:text-destructive"><LogOut className="h-5 w-5" strokeWidth={1.7} />Sair</Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}