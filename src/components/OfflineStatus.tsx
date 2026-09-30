import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, Clock, RefreshCw, WifiOff, Database, CheckCircle2 } from "lucide-react";

import { 
  getOfflineQueueStatus, 
  subscribeOfflineStatus, 
  syncOfflineQueue, 
  getQueueItems, 
  type QueueItem 
} from "@/lib/offline";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function OfflineStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [firstError, setFirstError] = useState<string>();
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const syncing = useRef(false);
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    setOnline(navigator.onLine);
    void getOfflineQueueStatus().then((status) => {
      setPending(status.pending);
      setFailed(status.failed);
      setFirstError(status.firstError);
    });
    void getQueueItems().then(setQueueItems);
  }, []);

  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const changedKeys = await syncOfflineQueue();
      if (changedKeys.length > 0) {
        await Promise.all(
          changedKeys.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))
        );
      }
    } finally {
      syncing.current = false;
      refresh();
    }
  }, [queryClient, refresh]);

  useEffect(() => {
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    refresh();
    void sync();
    const interval = window.setInterval(() => {
      void getOfflineQueueStatus().then((status) => {
        if (status.pending > 0) void sync();
      });
    }, 60_000);
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", syncWhenVisible);
    const unsubscribe = subscribeOfflineStatus(refresh);
    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [refresh, sync]);

  if (online && pending === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center pt-[env(safe-area-inset-top)]">
      <div className="pointer-events-auto flex min-h-8 items-center rounded-b-xl border border-t-0 border-border bg-card/95 px-3 py-1 text-xs font-medium shadow-sm backdrop-blur-xl transition-all duration-300">
        {!online && (
          <div className="flex items-center gap-1.5 px-1 text-muted-foreground">
            <WifiOff className="h-3 w-3" />
            <span>Offline</span>
          </div>
        )}
        {!online && pending > 0 ? <span className="mx-1.5 h-3 w-px bg-border" /> : null}
        
        {pending > 0 ? (
          <Sheet>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-xs font-medium hover:bg-accent"
              >
                <Database className="mr-1.5 h-3 w-3 text-primary" />
                {pending} {pending === 1 ? "item pendente" : "itens pendentes"}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Fila de Sincronização
                </SheetTitle>
                <SheetDescription>
                  Itens aguardando conexão estável para serem enviados.
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Status Geral</p>
                    <p className="text-xs text-muted-foreground">
                      {online ? "Conectado à internet" : "Sem conexão à internet"}
                    </p>
                  </div>
                  <Badge variant={online ? "default" : "secondary"} className="h-6">
                    {online ? "Online" : "Offline"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Itens na Fila ({queueItems.length})</h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => void sync()}
                    disabled={!online || syncing.current}
                    className="h-8 gap-1.5"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing.current ? "animate-spin" : ""}`} />
                    Sincronizar
                  </Button>
                </div>

                <ScrollArea className="h-[calc(100vh-280px)] pr-4">
                  <div className="space-y-3">
                    {queueItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                        <CheckCircle2 className="mb-2 h-8 w-8 text-primary/50" />
                        <p className="text-sm">Nenhum item pendente</p>
                      </div>
                    ) : (
                      queueItems.map((item) => (
                        <div 
                          key={item.queueId} 
                          className="flex flex-col gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-accent/50"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                                  {item.entity.replace(/_/g, " ")}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {item.recordId.slice(0, 8)}...
                                </span>
                              </div>
                              <p className="font-medium">
                                {item.action === "upsert" ? "Salvar/Atualizar" : "Excluir"}
                              </p>
                            </div>
                            {item.lastError ? (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          
                          {item.lastError && (
                            <div className="mt-1 flex items-center gap-1.5 rounded bg-destructive/10 p-2 text-[11px] text-destructive">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              <span className="line-clamp-2">{item.lastError}</span>
                            </div>
                          )}
                          
                          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{new Date(item.createdAt).toLocaleString()}</span>
                            {item.attempts && item.attempts > 0 && (
                              <span>{item.attempts} {item.attempts === 1 ? "tentativa" : "tentativas"}</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </SheetContent>
          </Sheet>
        ) : null}

        {failed > 0 ? (
          <>
            {(!online || pending > 0) ? <span className="mx-1.5 h-3 w-px bg-border" /> : null}
            <Button
              type="button"
              variant="link"
              className="h-7 p-0 px-2 text-xs font-semibold text-destructive hover:text-destructive/80"
              onClick={() => {
                toast.error(firstError ?? "Erro na sincronização", {
                  description: "Verifique a conexão e tente novamente.",
                  action: online ? { label: "Tentar agora", onClick: () => void sync() } : undefined,
                });
              }}
            >
              <AlertCircle className="mr-1.5 h-3 w-3" />
              {failed} com erro
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
