import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Copy, FileText, Plus, Search, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";

import { PageShell, Section } from "@/components/PageShell";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateBR, normalizeSearchText } from "@/lib/apontamentos";
import { formatCurrency } from "@/lib/financeiro";
import { deleteOrcamentoOffline, saveOrcamentoOffline } from "@/lib/offline";
import { fetchOrcamentos, proximoNumeroOrcamento, type OrcamentoStatus } from "@/lib/orcamentos";
import { generateQuotePdf } from "@/lib/pdf-report";
import { fetchPecas } from "@/lib/pecas";

export const Route = createFileRoute("/_authenticated/orcamentos")({
  head: () => ({ meta: [
    { title: "Orçamentos — CP TECHNIC Horas" },
    { name: "description", content: "Crie, acompanhe e compartilhe orçamentos de produtos e serviços." },
    { property: "og:title", content: "Orçamentos — CP TECHNIC Horas" },
    { property: "og:description", content: "Orçamentos privados de produtos e serviços." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: OrcamentosPage,
});

const statusInfo: Record<OrcamentoStatus, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  enviado: { label: "Enviado", className: "bg-info/15 text-info" },
  aprovado: { label: "Aprovado", className: "bg-success/15 text-success" },
  recusado: { label: "Recusado", className: "bg-destructive/10 text-destructive" },
};

function OrcamentosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: orcamentos = [], isLoading } = useQuery({ queryKey: ["orcamentos"], queryFn: fetchOrcamentos });
  const { data: pecas = [] } = useQuery({ queryKey: ["pecas"], queryFn: fetchPecas });
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"todos" | OrcamentoStatus>("todos");
  const list = useMemo(() => orcamentos.filter((item) => (status === "todos" || item.status === status) && normalizeSearchText(item.cliente_snapshot.nome).includes(normalizeSearchText(busca))), [busca, orcamentos, status]);
  const remove = useMutation({ mutationFn: deleteOrcamentoOffline, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["orcamentos"] }); toast.success("Orçamento excluído"); } });
  const withCatalogPhotos = (item: (typeof orcamentos)[number]) => ({
    ...item,
    itens: item.itens.map((entry) => ({
      ...entry,
      foto_data_url: entry.foto_data_url ?? pecas.find((peca) => peca.id === entry.peca_id || (entry.codigo && peca.codigo === entry.codigo))?.foto_data_url ?? null,
    })),
  });
  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const original = orcamentos.find((item) => item.id === id);
      const source = original ? withCatalogPhotos(original) : undefined;
      if (!source) throw new Error("Orçamento não encontrado");
      const newId = crypto.randomUUID();
      const { created_at: _created, updated_at: _updated, user_id: _user, itens: sourceItems, ...copy } = source;
      return saveOrcamentoOffline({ ...copy, id: newId, numero: proximoNumeroOrcamento(orcamentos), status: "rascunho", itens: sourceItems.map(({ created_at: _ic, updated_at: _iu, user_id: _ii, ...item }) => ({ ...item, id: crypto.randomUUID(), orcamento_id: newId })) });
    },
    onSuccess: (result) => { void queryClient.invalidateQueries({ queryKey: ["orcamentos"] }); void navigate({ to: "/orcamento", search: { id: result.record.id } }); toast.success("Orçamento duplicado"); },
  });
  return (
    <PageShell title="Orçamentos" subtitle={`${orcamentos.length} documento(s)`} backTo="/mais" action={<Button asChild className="rounded-full px-4"><Link to="/orcamento" search={{ id: undefined }}><Plus className="mr-1 h-5 w-5" />Novo</Link></Button>}>
      <Button asChild variant="secondary" className="h-12 w-full rounded-xl"><Link to="/orcamento-horas"><Clock3 className="mr-2 h-5 w-5" />Orçamento Horas</Link></Button>
      <div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar cliente" className="h-14 rounded-xl bg-card pl-12 shadow-card" /></div>
      <div className="flex gap-2 overflow-x-auto pb-1">{(["todos", "rascunho", "enviado", "aprovado", "recusado"] as const).map((value) => <Button key={value} size="sm" variant={status === value ? "default" : "outline"} className="shrink-0 rounded-full" onClick={() => setStatus(value)}>{value === "todos" ? "Todos" : statusInfo[value].label}</Button>)}</div>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : list.length === 0 ? <div className="ios-group px-5 py-10 text-center"><FileText className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 font-semibold">Nenhum orçamento</p></div> : <Section title="Documentos"><ul className="-my-3 divide-y divide-border">{list.map((item) => <li key={item.id} className="py-4">
        <Link to="/orcamento" search={{ id: item.id }} className="block press"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{item.cliente_snapshot.nome}</p><p className="mt-1 text-xs text-muted-foreground">Nº {item.numero} · {formatDateBR(item.data)}</p><span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusInfo[item.status].className}`}>{statusInfo[item.status].label}</span></div><p className="font-bold tabular-nums text-primary">{formatCurrency(item.total)}</p></div></Link>
      <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="secondary" className="h-10 rounded-xl" onClick={() => void generateQuotePdf(withCatalogPhotos(item))}><FileText className="mr-2 h-4 w-4" />PDF</Button><Button variant="outline" className="h-10 rounded-xl" onClick={() => duplicate.mutate(item.id)}><Copy className="mr-2 h-4 w-4" />Duplicar</Button>{item.status === "aprovado" ? <Button asChild variant="outline" className="col-span-2 h-10 rounded-xl"><Link to="/novo" search={{ data: undefined, cliente: item.cliente_id ?? undefined, servico: item.itens.map((entry) => entry.nome).join(", ") }}><Wrench className="mr-2 h-4 w-4" />Gerar apontamento</Link></Button> : null}<AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" className="col-span-2 h-10 rounded-xl text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</Button></AlertDialogTrigger><AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl"><AlertDialogHeader><AlertDialogTitle>Excluir orçamento?</AlertDialogTitle><AlertDialogDescription>O orçamento {item.numero} será removido.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => remove.mutate(item.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
      </li>)}</ul></Section>}
    </PageShell>
  );
}