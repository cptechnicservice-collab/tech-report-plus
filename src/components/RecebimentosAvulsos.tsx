import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FloatingInput, FloatingSelect, FloatingTextarea } from "@/components/FloatingField";
import { Section } from "@/components/PageShell";
import { fetchClientes, formatDateBR, normalizeSearchText, todayISO } from "@/lib/apontamentos";
import { formatCurrency } from "@/lib/financeiro";
import { formasPagamento } from "@/lib/relatorios";
import { isDecimalBRInput, parseDecimalBR } from "@/lib/decimal-br";
import { deleteRecebimentoAvulsoOffline, filtrarRecebimentosAvulsos, recebimentosAvulsosQuery, saveRecebimentoAvulsoOffline, totalRecebimentosAvulsos, type RecebimentoAvulso } from "@/lib/recebimentos-avulsos";

export function RecebimentoAvulsoEditor({ record, open, onOpenChange }: { record?: RecebimentoAvulso; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [clienteId, setClienteId] = useState(record?.cliente_id ?? "");
  const [valor, setValor] = useState(record ? String(record.valor).replace(".", ",") : "");
  const [data, setData] = useState(record?.data_recebimento ?? todayISO());
  const [forma, setForma] = useState(record?.forma_pagamento ?? "pix");
  const [observacao, setObservacao] = useState(record?.observacao ?? "");
  const [id] = useState(() => record?.id ?? crypto.randomUUID());
  const queryClient = useQueryClient();
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: fetchClientes });
  const salvar = useMutation({
    networkMode: "always",
    mutationFn: () => saveRecebimentoAvulsoOffline({ id, cliente_id: clienteId, valor: parseDecimalBR(valor) ?? 0, data_recebimento: data, forma_pagamento: forma || null, observacao: observacao.trim() || null, ...(record ? { created_at: record.created_at } : {}) }),
    onSuccess: async ({ queued }) => {
      await queryClient.invalidateQueries({ queryKey: ["recebimentos-avulsos"] });
      toast.success(queued ? "Recebimento salvo no aparelho. Sincronização pendente." : "Recebimento salvo.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });
  return <Dialog open={open} onOpenChange={(next) => { if (!salvar.isPending) onOpenChange(next); }}>
    <DialogContent keyboardPosition="bottom" onOpenAutoFocus={(event) => event.preventDefault()} className="bottom-0 top-auto max-h-[90dvh] rounded-t-3xl rounded-b-none p-5 sm:max-w-lg">
      <DialogHeader><DialogTitle>{record ? "Editar recebimento avulso" : "Novo recebimento avulso"}</DialogTitle><DialogDescription className="sr-only">Recebimento independente por cliente</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); salvar.mutate(); }}>
        <FloatingSelect label="Cliente" value={clienteId} onChange={(event) => setClienteId(event.target.value)} required>
          <option value="">Selecione o cliente</option>
          {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
        </FloatingSelect>
        <FloatingInput label="Valor recebido (R$)" inputMode="decimal" value={valor} onChange={(event) => { if (isDecimalBRInput(event.target.value)) setValor(event.target.value); }} required />
        <FloatingInput label="Data do recebimento" type="date" value={data} onChange={(event) => setData(event.target.value)} required />
        <FloatingSelect label="Forma de pagamento" value={forma} onChange={(event) => setForma(event.target.value)}>
          <option value="">Não informada</option>{formasPagamento.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </FloatingSelect>
        <FloatingTextarea label="Observação" value={observacao} onChange={(event) => setObservacao(event.target.value)} />
        <Button type="submit" className="h-12 w-full rounded-xl" disabled={salvar.isPending}><Save className="mr-2 h-5 w-5" />{salvar.isPending ? "Salvando..." : "Salvar recebimento"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}

export function NovoRecebimentoAvulsoButton() {
  const [open, setOpen] = useState(false);
  return <><Button variant="outline" className="h-12 w-full rounded-xl" onClick={() => setOpen(true)}><Plus className="mr-2 h-5 w-5" />Novo recebimento avulso</Button>{open ? <RecebimentoAvulsoEditor open onOpenChange={setOpen} /> : null}</>;
}

export function RecebimentosAvulsosSection({ clienteId, periodo, inicio, fim, busca = "", editable = true }: { clienteId?: string | undefined; periodo?: string | undefined; inicio?: string | undefined; fim?: string | undefined; busca?: string; editable?: boolean }) {
  const { data: items = [], isLoading, error } = useQuery(recebimentosAvulsosQuery());
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: fetchClientes });
  const [editing, setEditing] = useState<RecebimentoAvulso | null>(null);
  const [deleting, setDeleting] = useState<RecebimentoAvulso | null>(null);
  const [visible, setVisible] = useState(20);
  const queryClient = useQueryClient();
  const excluir = useMutation({
    networkMode: "always",
    mutationFn: deleteRecebimentoAvulsoOffline,
    onSuccess: async ({ queued }) => { await queryClient.invalidateQueries({ queryKey: ["recebimentos-avulsos"] }); setDeleting(null); toast.success(queued ? "Exclusão salva no aparelho." : "Recebimento excluído."); },
    onError: (error) => toast.error(error.message),
  });
  const nome = (item: RecebimentoAvulso) => clientes.find((cliente) => cliente.id === item.cliente_id)?.nome ?? "Cliente";
  const filtered = filtrarRecebimentosAvulsos(items, { clienteId, periodo, inicio, fim }).filter((item) => !busca || normalizeSearchText(nome(item)).includes(normalizeSearchText(busca)));
  return <Section title="Recebimentos avulsos" hint={formatCurrency(totalRecebimentosAvulsos(filtered))}>
    {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : error ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar os recebimentos.</p> : filtered.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum recebimento avulso no período.</p> : <ul className="divide-y divide-border">
      {filtered.slice(0, visible).map((item) => <li key={item.id} className="py-3">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{nome(item)}</p><p className="mt-1 text-xs text-muted-foreground">Recebimento avulso · {formatDateBR(item.data_recebimento)}</p><p className="text-xs text-muted-foreground">{formasPagamento.find((forma) => forma.value === item.forma_pagamento)?.label ?? item.forma_pagamento ?? "Não informada"}</p></div><p className="shrink-0 text-sm font-bold tabular-nums text-success">{formatCurrency(item.valor)}</p></div>
        {item.observacao ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.observacao}</p> : null}
        {editable ? <div className="mt-2 flex justify-end gap-2"><Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Editar recebimento de ${nome(item)}`} onClick={() => setEditing(item)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" aria-label={`Excluir recebimento de ${nome(item)}`} onClick={() => setDeleting(item)}><Trash2 className="h-4 w-4" /></Button></div> : null}
      </li>)}
    </ul>}
    {filtered.length > visible ? <Button variant="outline" className="w-full" onClick={() => setVisible((count) => count + 20)}>Mostrar mais</Button> : null}
    <Button asChild variant="outline" className="w-full"><Link to="/recebimentos-avulsos" search={{ novo: true }}>Novo recebimento avulso</Link></Button>
    {editing ? <RecebimentoAvulsoEditor key={editing.id} record={editing} open onOpenChange={(open) => { if (!open) setEditing(null); }} /> : null}
    <Dialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !excluir.isPending) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>Excluir recebimento avulso?</DialogTitle><DialogDescription>{deleting ? `${nome(deleting)} · ${formatCurrency(deleting.valor)}` : ""}</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" disabled={excluir.isPending} onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="destructive" disabled={excluir.isPending} onClick={() => { if (deleting) excluir.mutate(deleting.id); }}>Excluir</Button></div></DialogContent></Dialog>
  </Section>;
}