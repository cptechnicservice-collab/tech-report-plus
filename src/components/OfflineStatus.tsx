import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  Eye,
  RefreshCw,
  Trash2,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import {
  discardQueueItem,
  getOfflineQueueStatus,
  getQueueItems,
  retryQueueItem,
  subscribeOfflineStatus,
  syncOfflineQueue,
  type QueueItem,
} from "@/lib/offline";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";

const ENTITY_LABELS: Record<QueueItem["entity"], string> = {
  clientes: "Cliente",
  apontamentos: "Apontamento",
  apontamento_pecas: "Peça do apontamento",
  valores_vigencia: "Valor vigente",
  agendamentos: "Agendamento",
  pecas: "Peça",
  relatorios_salvos: "Relatório",
  dados_empresa: "Dados da empresa",
  orcamentos: "Orçamento",
  orcamento_itens: "Item do orçamento",
};

function itemName(item: QueueItem) {
  const payload = item.payload;
  const value =
    payload?.["nome"] ??
    payload?.["descricao"] ??
    payload?.["cliente_nome"] ??
    payload?.["numero"] ??
    payload?.["maquina_servico"];
  return typeof value === "string" && value.trim()
    ? value
    : `${ENTITY_LABELS[item.entity]} ${item.recordId.slice(0, 8)}`;
}

function syncTime(value?: string) {
  if (!value) return undefined;
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

export function OfflineStatus() {
  const [authenticated, setAuthenticated] = useState(false);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [lastSuccessfulSync, setLastSuccessfulSync] = useState<string>();
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [discarding, setDiscarding] = useState<QueueItem | null>(null);
  const syncingRef = useRef(false);
  const previousPending = useRef<number | undefined>(undefined);
  const attentionShown = useRef(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    const [status, items] = await Promise.all([getOfflineQueueStatus(), getQueueItems()]);
    setOnline(navigator.onLine);
    setAuthenticated(status.authenticated);
    setPending(status.pending);
    setFailed(status.failed);
    setLastSuccessfulSync(status.lastSuccessfulSync);
    setQueueItems(items);
    if (status.attention > 0 && !attentionShown.current) {
      attentionShown.current = true;
      setDrawerOpen(true);
    }
    if (status.attention === 0) attentionShown.current = false;
    if (
      previousPending.current &&
      previousPending.current > 0 &&
      status.pending === 0 &&
      status.lastSuccessfulSync
    ) {
      toast.success(`Tudo sincronizado às ${syncTime(status.lastSuccessfulSync)}`);
    }
    previousPending.current = status.pending;
  }, []);

  const sync = useCallback(
    async (force = false) => {
      if (syncingRef.current || document.visibilityState !== "visible") return;
      syncingRef.current = true;
      setSyncing(true);
      try {
        const changedKeys = await syncOfflineQueue({ force });
        await Promise.all(
          changedKeys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
        );
      } finally {
        syncingRef.current = false;
        setSyncing(false);
        await refresh();
      }
    },
    [queryClient, refresh],
  );

  useEffect(() => {
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    const syncOnFocus = () => {
      if (document.visibilityState === "visible") void sync();
    };
    void refresh().then(() => sync());
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void sync();
    }, 120_000);
    window.addEventListener("online", syncOnFocus);
    window.addEventListener("focus", syncOnFocus);
    document.addEventListener("visibilitychange", syncWhenVisible);
    const unsubscribe = subscribeOfflineStatus(refresh);
    return () => {
      window.removeEventListener("online", syncOnFocus);
      window.removeEventListener("focus", syncOnFocus);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [refresh, sync]);

  const retry = async (item: QueueItem) => {
    if (item.queueId == null) return;
    await retryQueueItem(item.queueId);
    await sync(true);
  };

  const discard = async () => {
    if (discarding?.queueId == null) return;
    await discardQueueItem(discarding.queueId);
    setDiscarding(null);
    await refresh();
    toast.success("Operação descartada");
  };

  const viewRecord = async (item: QueueItem) => {
    setDrawerOpen(false);
    if (item.entity === "apontamentos")
      await navigate({ to: "/apontamento/$id", params: { id: item.recordId } });
    else if (item.entity === "orcamentos" || item.entity === "orcamento_itens")
      await navigate({ to: "/orcamentos" });
    else if (item.entity === "relatorios_salvos") await navigate({ to: "/relatorios-salvos" });
    else if (item.entity === "pecas" || item.entity === "apontamento_pecas")
      await navigate({ to: "/pecas" });
    else if (item.entity === "clientes") await navigate({ to: "/clientes" });
    else if (item.entity === "valores_vigencia") await navigate({ to: "/valores" });
    else if (item.entity === "dados_empresa") await navigate({ to: "/dados-empresa" });
    else await navigate({ to: "/historico" });
  };

  if (!authenticated) return null;
  const attentionItems = queueItems.filter((item) => (item.attempts ?? 0) >= 3);
  const time = syncTime(lastSuccessfulSync);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center pt-[env(safe-area-inset-top)]">
        <div className="pointer-events-auto flex min-h-8 max-w-[calc(100%-1rem)] items-center gap-1 rounded-b-xl border border-t-0 border-border bg-card/95 px-2 py-1 text-xs font-medium shadow-sm backdrop-blur-xl">
          {!online ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <WifiOff className="h-3 w-3" />
              Offline
            </span>
          ) : null}
          {pending > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setDrawerOpen(true)}
            >
              <Database className="mr-1 h-3 w-3 text-primary" />
              {pending} pendente{pending === 1 ? "" : "s"}
            </Button>
          ) : time ? (
            <span className="flex items-center gap-1 px-1 text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-success" />
              Tudo sincronizado às {time}
            </span>
          ) : null}
          {failed > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive"
              onClick={() => setDrawerOpen(true)}
            >
              <AlertCircle className="mr-1 h-3 w-3" />
              {failed} com falha
            </Button>
          ) : null}
          {online && pending > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={syncing}
              onClick={() => void sync(true)}
            >
              <RefreshCw className={`mr-1 h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              Sincronizar agora
            </Button>
          ) : null}
        </div>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[88dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Sincronização</DrawerTitle>
            <DrawerDescription>
              {pending} pendente{pending === 1 ? "" : "s"} · {failed} com falha
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-2">
            <Button
              className="w-full"
              disabled={!online || syncing || pending === 0}
              onClick={() => void sync(true)}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Sincronizar agora
            </Button>
          </div>
          <ScrollArea className="max-h-[62dvh] px-4 pb-6">
            <div className="space-y-3 pb-[env(safe-area-inset-bottom)]">
              {queueItems.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
                  {time ? `Tudo sincronizado às ${time}` : "Tudo sincronizado"}
                </div>
              ) : (
                queueItems.map((item) => {
                  const needsAttention = (item.attempts ?? 0) >= 3;
                  return (
                    <div key={item.queueId} className="rounded-lg border bg-card p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant={needsAttention ? "destructive" : "outline"}>
                              {ENTITY_LABELS[item.entity]}
                            </Badge>
                            {needsAttention ? (
                              <span className="text-xs font-semibold text-destructive">
                                Precisa de atenção
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 truncate text-sm font-semibold">{itemName(item)}</p>
                        </div>
                        {item.lastError ? (
                          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                        ) : (
                          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.attempts ?? 0} tentativa{(item.attempts ?? 0) === 1 ? "" : "s"}
                      </p>
                      {item.lastError ? (
                        <p className="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                          {item.lastError}
                        </p>
                      ) : null}
                      <div className="mt-3 grid grid-cols-3 gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!online || syncing}
                          onClick={() => void retry(item)}
                        >
                          <RefreshCw className="mr-1 h-3.5 w-3.5" />
                          Tentar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void viewRecord(item)}
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          Ver
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setDiscarding(item)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Descartar
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
              {attentionItems.length > 0 ? (
                <p className="px-1 text-xs text-muted-foreground">
                  Nada é descartado automaticamente.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      <AlertDialog
        open={discarding !== null}
        onOpenChange={(open) => {
          if (!open) setDiscarding(null);
        }}
      >
        <AlertDialogContent className="mx-4 w-[calc(100%-2rem)] max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar esta operação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta alteração offline não será enviada. O registro salvo no aparelho não será
              apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => void discard()}
            >
              Descartar operação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
