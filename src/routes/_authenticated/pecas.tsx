import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/PageShell";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizeSearchText } from "@/lib/apontamentos";
import { resizeImage } from "@/lib/image-resize";
import { deletePecaOffline, savePecaOffline } from "@/lib/offline";
import { fetchPecas, type Peca } from "@/lib/pecas";

export const Route = createFileRoute("/_authenticated/pecas")({
  head: () => ({ meta: [
    { title: "Catálogo de Peças — CP TECHNIC Horas" },
    { name: "description", content: "Consulte e cadastre peças, códigos, unidades e preços." },
    { property: "og:title", content: "Catálogo de Peças — CP TECHNIC Horas" },
    { property: "og:description", content: "Catálogo privado de peças para serviços técnicos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Pecas,
});

type Draft = { descricao: string; codigo: string; unidade: string; preco: string; observacoes: string; foto_data_url: string | null };
const emptyDraft: Draft = { descricao: "", codigo: "", unidade: "unidade", preco: "", observacoes: "", foto_data_url: null };

function draftFrom(item: Peca): Draft {
  return { descricao: item.descricao, codigo: item.codigo ?? "", unidade: item.unidade, preco: String(item.preco).replace(".", ","), observacoes: item.observacoes ?? "", foto_data_url: item.foto_data_url };
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function errorReason(error: unknown) {
  if (error instanceof Error && error.message) return `: ${error.message}`;
  if (error && typeof error === "object" && "message" in error) return `: ${String(error.message)}`;
  return "";
}

function Pecas() {
  const [busca, setBusca] = useState("");
  const [editing, setEditing] = useState<Peca | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const queryClient = useQueryClient();
  const { data: pecas = [], isLoading } = useQuery({ queryKey: ["pecas"], queryFn: fetchPecas });
  const lista = useMemo(() => {
    const term = normalizeSearchText(busca);
    if (!term) return pecas;
    return pecas.filter((item) => normalizeSearchText(`${item.descricao} ${item.codigo ?? ""}`).includes(term));
  }, [busca, pecas]);
  const parsedPrice = Number(draft.preco.replace(/\./g, "").replace(",", "."));

  const save = useMutation({
    mutationFn: () => savePecaOffline({
      id: editing && editing !== "new" ? editing.id : crypto.randomUUID(),
      descricao: draft.descricao.trim(), codigo: draft.codigo.trim() || null,
      unidade: draft.unidade.trim() || "unidade", preco: parsedPrice,
      observacoes: draft.observacoes.trim() || null, foto_data_url: draft.foto_data_url,
    }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["pecas"] });
      setEditing(null);
      toast.success(result.queued ? "Salvo no aparelho — será enviado quando houver conexão" : "Peça salva");
    },
    onError: (error) => toast.error(`Não foi possível salvar${errorReason(error)}`),
  });
  const remove = useMutation({
    mutationFn: deletePecaOffline,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["pecas"] });
      toast.success(result.queued ? "Exclusão salva no aparelho" : "Peça excluída");
    },
    onError: (error) => toast.error(`Não foi possível excluir${errorReason(error)}`),
  });
  const openNew = () => { setDraft(emptyDraft); setEditing("new"); };
  const selectPhoto = async (file?: File) => {
    if (!file) return;
    try { const photo = await resizeImage(file); setDraft((current) => ({ ...current, foto_data_url: photo })); }
    catch { toast.error("Não foi possível usar essa foto"); }
  };

  return (
    <PageShell title="Catálogo de Peças" subtitle={`${pecas.length} peça(s) cadastrada(s)`} action={<Button size="icon" className="rounded-full" aria-label="Cadastrar peça" onClick={openNew}><Plus className="h-5 w-5" /></Button>}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar descrição ou código" className="h-14 rounded-xl bg-card pl-12 pr-12 shadow-card" />
        {busca ? <Button type="button" variant="ghost" size="icon" aria-label="Limpar busca" onClick={() => setBusca("")} className="absolute right-1.5 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full"><X className="h-4 w-4" /></Button> : null}
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : lista.length === 0 ? (
        <div className="ios-group px-5 py-10 text-center"><Package className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 font-semibold">Nenhuma peça encontrada</p><p className="mt-1 text-sm text-muted-foreground">Cadastre uma peça para começar.</p></div>
      ) : (
        <ul className="space-y-3">
          {lista.map((item) => <li key={item.id} className="rounded-xl bg-foreground p-4 text-background shadow-card">
            <div className="flex items-start gap-3">
               {item.foto_data_url ? <img src={item.foto_data_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-background/10 text-primary"><Package className="h-6 w-6" /></span>}
              <div className="min-w-0 flex-1"><p className="font-semibold leading-snug">{item.descricao}</p><p className="mt-0.5 text-sm text-background/65">{item.codigo || "Sem código"}</p></div>
              <div className="flex shrink-0">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-background hover:bg-background/10 hover:text-background" aria-label="Editar peça" onClick={() => { setDraft(draftFrom(item)); setEditing(item); }}><Pencil className="h-4 w-4" /></Button>
                <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-destructive" aria-label="Excluir peça"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl"><AlertDialogHeader><AlertDialogTitle>Excluir peça?</AlertDialogTitle><AlertDialogDescription>“{item.descricao}” será removida do catálogo.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => remove.mutate(item.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3 border-t border-background/10 pt-3"><div><p className="text-xs text-background/60">Preço por {item.unidade}</p><p className="mt-0.5 text-lg font-semibold text-primary">{money(item.preco)}</p></div>{item.observacoes ? <p className="max-w-[48%] truncate text-right text-xs text-background/60">{item.observacoes}</p> : null}</div>
          </li>)}
        </ul>
      )}

      <Button className="sticky bottom-24 z-20 h-14 w-full rounded-xl shadow-lg" onClick={openNew}><Package className="mr-2 h-5 w-5" /> Cadastrar peça</Button>

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="bottom-0 top-auto max-h-[92dvh] max-w-md translate-y-0 overflow-y-auto rounded-t-3xl border-x-0 border-b-0 p-5 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border">
          <DialogHeader><DialogTitle>{editing === "new" ? "Cadastrar peça" : "Editar peça"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {draft.foto_data_url ? <img src={draft.foto_data_url} alt="Foto da peça" className="h-20 w-20 rounded-xl border object-cover" /> : <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border bg-muted text-muted-foreground"><Package className="h-8 w-8" /></span>}
              <div className="flex flex-1 flex-col gap-1">
                <Button asChild variant="outline" className="h-11 rounded-xl"><label><ImagePlus className="mr-2 h-4 w-4" />{draft.foto_data_url ? "Trocar foto" : "Adicionar foto"}<input type="file" accept="image/*" className="sr-only" onChange={(event) => void selectPhoto(event.target.files?.[0])} /></label></Button>
                {draft.foto_data_url ? <Button type="button" variant="ghost" className="h-9 rounded-xl text-destructive" onClick={() => setDraft((current) => ({ ...current, foto_data_url: null }))}><Trash2 className="mr-2 h-4 w-4" />Remover foto</Button> : null}
              </div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="peca-descricao">Descrição</Label><Input id="peca-descricao" value={draft.descricao} onChange={(event) => setDraft({ ...draft, descricao: event.target.value })} className="h-12 rounded-xl" autoFocus /></div>
            <div className="space-y-1.5"><Label htmlFor="peca-codigo">Código (opcional)</Label><Input id="peca-codigo" value={draft.codigo} onChange={(event) => setDraft({ ...draft, codigo: event.target.value })} className="h-12 rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="peca-unidade">Unidade</Label><Input id="peca-unidade" value={draft.unidade} onChange={(event) => setDraft({ ...draft, unidade: event.target.value })} placeholder="unidade" className="h-12 rounded-xl" /></div><div className="space-y-1.5"><Label htmlFor="peca-preco">Preço</Label><Input id="peca-preco" value={draft.preco} onChange={(event) => setDraft({ ...draft, preco: event.target.value })} placeholder="0,00" inputMode="decimal" className="h-12 rounded-xl" /></div></div>
            <div className="space-y-1.5"><Label htmlFor="peca-observacoes">Observações (opcional)</Label><Textarea id="peca-observacoes" value={draft.observacoes} onChange={(event) => setDraft({ ...draft, observacoes: event.target.value })} rows={3} className="rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-2"><Button variant="ghost" className="h-12 rounded-xl" onClick={() => setEditing(null)}>Cancelar</Button><Button className="h-12 rounded-xl" disabled={!draft.descricao.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0 || save.isPending} onClick={() => save.mutate()}>Salvar</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}