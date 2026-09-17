import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getOfflineQueueStatus, subscribeOfflineStatus, syncOfflineQueue } from "@/lib/offline";
import { Button } from "@/components/ui/button";

export function OfflineStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [firstError, setFirstError] = useState<string>();
  const syncing = useRef(false);
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    setOnline(navigator.onLine);
    void getOfflineQueueStatus().then((status) => {
      setPending(status.pending);
      setFailed(status.failed);
      setFirstError(status.firstError);
    });
  }, []);

  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      await syncOfflineQueue();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clientes"] }),
        queryClient.invalidateQueries({ queryKey: ["apontamentos"] }),
        queryClient.invalidateQueries({ queryKey: ["valores"] }),
        queryClient.invalidateQueries({ queryKey: ["agendamentos"] }),
        queryClient.invalidateQueries({ queryKey: ["pecas"] }),
        queryClient.invalidateQueries({ queryKey: ["relatorios-salvos"] }),
        queryClient.invalidateQueries({ queryKey: ["dados-empresa"] }),
        queryClient.invalidateQueries({ queryKey: ["orcamentos"] }),
      ]);
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
      <div className="pointer-events-auto flex min-h-8 items-center rounded-b-xl border border-t-0 border-border bg-card/95 px-3 py-1 text-xs font-medium shadow-sm backdrop-blur-xl">
        {!online ? "Offline" : null}
        {!online && pending > 0 ? " · " : null}
        {pending > 0 ? `${pending} pendente${pending === 1 ? "" : "s"} de envio` : null}
        {failed > 0 ? (
          <>
            {(!online || pending > 0) ? " · " : null}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-xs font-semibold text-destructive"
              onClick={() => {
                toast.error(firstError ?? "Não foi possível enviar um item.", {
                  action: online ? { label: "Tentar novamente", onClick: () => void sync() } : undefined,
                });
              }}
            >
              {failed} com erro
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}