import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Circle, FileText, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FloatingInput, FloatingTextarea } from "@/components/FloatingField";
import { deleteLembreteOffline, lembretesQuery, saveLembreteOffline, type Lembrete } from "@/lib/lembretes";
import { formatDateBR, todayISO } from "@/lib/apontamentos";

export function LembretesPainel() {
  const { data: lembretes = [], isLoading, isError } = useQuery(lembretesQuery());
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lembrete | null>(null);
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [deleting, setDeleting] = useState<Lembrete | null>(null);
  const active = lembretes.filter((item) => !item.concluido);
  const completed = lembretes.filter((item) => item.concluido);
  const visible = showCompleted ? lembretes : active;
  const start = (item: Lembrete | null = null, preset = "") => {
    setEditing(item); setTitulo(item?.titulo ?? preset); setData(item?.data_prevista ?? ""); setOpen(true);
  };
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["lembretes"] });
  const save = async () => {
    setBusy(true);
    try {
      const result = await saveLembreteOffline({ id: editing?.id ?? crypto.randomUUID(), titulo, data_prevista: data || null, concluido: editing?.concluido ?? false });
      await refresh(); setOpen(false);
      toast.success(result.queued ? "Lembrete salvo no aparelho; sincronização pendente." : "Lembrete salvo.");
    } catch { toast.error("Não foi possível salvar. Confira o lembrete e a data."); }
    finally { setBusy(false); }
  };
  const toggle = async (item: Lembrete) => {
    setBusy(true);
    try { await saveLembreteOffline({ ...item, concluido: !item.concluido }); await refresh(); }
    catch { toast.error("Não foi possível atualizar o lembrete."); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try { await deleteLembreteOffline(deleting.id); await refresh(); setDeleting(null); }
    catch { toast.error("Não foi possível excluir o lembrete."); }
    finally { setBusy(false); }
  };

  return (
    <section className="space-y-3" aria-label="Lembretes">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><Bell className="h-5 w-5 text-primary" />Lembretes {active.length > 0 ? <span className="text-sm text-muted-foreground">({active.length})</span> : null}</h2>
        <Button variant="outline" size="sm" onClick={() => start()}><Plus className="mr-1 h-4 w-4" />Novo lembrete</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" className="h-auto min-h-10 whitespace-normal text-left" onClick={() => start(null, "Fazer nota fiscal — Incolar")}><FileText className="mr-2 h-4 w-4 shrink-0" />Nota fiscal · Incolar</Button>
        <Button variant="secondary" size="sm" className="min-h-10" onClick={() => start(null, "Revisão")}><Wrench className="mr-2 h-4 w-4" />Revisão</Button>
      </div>
      {isLoading ? <p className="py-3 text-sm text-muted-foreground">Carregando lembretes...</p> : isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar os lembretes.</p> : visible.length === 0 ? <p className="py-3 text-sm text-muted-foreground">Nenhum lembrete pendente.</p> : (
        <ul className="divide-y divide-border">
          {visible.map((item) => (
            <li key={item.id} className="flex items-start gap-1 py-3">
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" disabled={busy} aria-label={`${item.concluido ? "Reabrir" : "Concluir"} lembrete ${item.titulo}`} onClick={() => void toggle(item)}>
                {item.concluido ? <Check className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-primary" />}
              </Button>
              <div className="min-w-0 flex-1 pt-2">
                <p className={`break-words text-sm font-medium ${item.concluido ? "text-muted-foreground line-through" : "text-foreground"}`}>{item.titulo}</p>
                {item.data_prevista ? <p className={`mt-1 text-xs ${!item.concluido && item.data_prevista < todayISO() ? "text-destructive" : "text-muted-foreground"}`}>{formatDateBR(item.data_prevista)}{!item.concluido && item.data_prevista === todayISO() ? " · Hoje" : !item.concluido && item.data_prevista < todayISO() ? " · Atrasado" : ""}</p> : null}
              </div>
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={`Editar lembrete ${item.titulo}`} disabled={busy} onClick={() => start(item)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground" aria-label={`Excluir lembrete ${item.titulo}`} disabled={busy} onClick={() => setDeleting(item)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
      {completed.length > 0 ? <Button variant="ghost" size="sm" onClick={() => setShowCompleted(!showCompleted)}>{showCompleted ? "Ocultar concluídos" : `Concluídos (${completed.length})`}</Button> : null}
      <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-2xl" onOpenAutoFocus={(event) => event.preventDefault()}>
          <DialogHeader><DialogTitle>{editing ? "Editar lembrete" : "Novo lembrete"}</DialogTitle><DialogDescription>Tarefa e data prevista</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
            <FloatingTextarea label="Lembrete" value={titulo} onChange={(event) => setTitulo(event.target.value)} maxLength={300} required />
            <FloatingInput label="Data prevista (opcional)" type="date" value={data} onChange={(event) => setData(event.target.value)} />
            <Button type="submit" className="h-12 w-full" disabled={busy || !titulo.trim()}>{busy ? "Salvando..." : "Salvar lembrete"}</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={deleting !== null} onOpenChange={(value) => { if (!value && !busy) setDeleting(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-2xl">
          <DialogHeader><DialogTitle>Excluir lembrete?</DialogTitle><DialogDescription className="break-words">{deleting?.titulo}</DialogDescription></DialogHeader>
          <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={() => void remove()}>Excluir</Button></div>
        </DialogContent>
      </Dialog>
    </section>
  );
}