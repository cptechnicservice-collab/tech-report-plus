import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Camera, Download, FilePenLine, FileText, HandCoins, ImagePlus, MessageSquareText, Paperclip, Plus, ReceiptText, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { PageShell, Section } from "@/components/PageShell";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { formatDateBR, normalizeSearchText } from "@/lib/apontamentos";
import { formatCurrency } from "@/lib/financeiro";
import { resizeImage } from "@/lib/image-resize";
import { deleteRelatorioOffline, saveRelatorioOffline } from "@/lib/offline";
import { generateClientReport, generatePaymentReceipt } from "@/lib/pdf-report";
import { fetchRelatoriosSalvos, formasPagamento, saldoRelatorio, statusPagamento, type DespesaRelatorio, type FormaPagamento, type PagamentoStatus, type RelatorioSalvo } from "@/lib/relatorios";

type DespesaEditavel = Omit<DespesaRelatorio, "valor"> & { valor: string; anexos: string[] };

const tiposDespesa = [
  { value: "pedagio", label: "Pedágio" },
  { value: "hotel", label: "Hotel" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "combustivel", label: "Combustível" },
  { value: "diversos", label: "Gastos diversos" },
] as const;

export const Route = createFileRoute("/_authenticated/relatorios-salvos")({
  validateSearch: (search: Record<string, unknown>): { status?: PagamentoStatus | "aberto" } => {
    const value = search["status"];
    return value === "aberto" || value === "pendente" || value === "parcial" || value === "pago" ? { status: value } : {};
  },
  head: () => ({ meta: [
    { title: "Relatórios salvos — CP TECHNIC Horas" },
    { name: "description", content: "Consulte relatórios finais salvos por cliente, com peças e valores congelados." },
    { property: "og:title", content: "Relatórios salvos — CP TECHNIC Horas" },
    { property: "og:description", content: "Histórico privado de relatórios finais por cliente." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: RelatoriosSalvos,
});

function RelatoriosSalvos() {
  const search = Route.useSearch();
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState<"ultimos" | "30" | "60" | "todos">("ultimos");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [status, setStatus] = useState<"todos" | "aberto" | PagamentoStatus>(search.status ?? "todos");
  const [recebimento, setRecebimento] = useState<RelatorioSalvo | null>(null);
  const [valorRecebido, setValorRecebido] = useState("");
  const [dataRecebimento, setDataRecebimento] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("pix");
  const [relatorioObservacao, setRelatorioObservacao] = useState<RelatorioSalvo | null>(null);
  const [observacao, setObservacao] = useState("");
  const [despesas, setDespesas] = useState<DespesaEditavel[]>([]);
  const [anexoAberto, setAnexoAberto] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: relatorios = [], isLoading } = useQuery({ queryKey: ["relatorios-salvos"], queryFn: fetchRelatoriosSalvos });
  const relatoriosVisiveis = useMemo(() => {
    const term = normalizeSearchText(busca);
    const agora = new Date();
    const limiteDias = periodo === "30" ? 30 : periodo === "60" ? 60 : null;
    return [...relatorios]
      .filter((item) => {
        if (term && !normalizeSearchText(item.cliente_nome).includes(term)) return false;
        if (status === "aberto" && item.pagamento_status === "pago") return false;
        if (status !== "todos" && status !== "aberto" && item.pagamento_status !== status) return false;
        if (limiteDias == null) return true;
        const limite = new Date(agora);
        limite.setDate(limite.getDate() - limiteDias);
        return new Date(item.created_at) >= limite;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, periodo === "ultimos" ? 12 : undefined);
  }, [busca, periodo, relatorios, status]);

  const filtros = [
    { id: "ultimos", label: "Últimos" },
    { id: "30", label: "30 dias" },
    { id: "60", label: "60 dias" },
    { id: "todos", label: "Todos" },
  ] as const;

  const remove = useMutation({
    mutationFn: deleteRelatorioOffline,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["relatorios-salvos"] });
      toast.success(result.queued ? "Exclusão salva no aparelho" : "Relatório excluído");
    },
    onError: () => toast.error("Não foi possível excluir o relatório"),
  });

  const generate = async (item: RelatorioSalvo) => {
    setGeneratingId(item.id);
    try {
      await generateClientReport(
        item.cliente_snapshot,
        item.apontamentos_snapshot,
        item.valores_snapshot,
        item.pecas_snapshot,
        item.inicio,
        item.fim,
        item.financeiro_snapshot,
        item.observacao_relatorio,
        item.despesas_snapshot,
        item.numero_relatorio,
      );
    } catch (error) {
      toast.error(error instanceof Error ? `Não foi possível gerar o PDF: ${error.message}` : "Não foi possível gerar o PDF");
    } finally {
      setGeneratingId(null);
    }
  };

  const openRecebimento = (item: RelatorioSalvo) => {
    setRecebimento(item);
    setValorRecebido(String(item.valor_recebido > 0 ? item.valor_recebido : item.total_geral).replace(".", ","));
    const today = new Date();
    const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    setDataRecebimento(item.data_recebimento ?? localToday);
    setFormaPagamento(item.forma_pagamento ?? "pix");
  };

  const saveRecebimento = useMutation({
    mutationFn: async () => {
      if (!recebimento) throw new Error("Relatório não encontrado.");
      const value = Number(valorRecebido.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) throw new Error("Informe um valor recebido maior que zero.");
      if (!dataRecebimento) throw new Error("Informe a data do recebimento.");
      return saveRelatorioOffline({
        ...recebimento,
        valor_recebido: value,
        data_recebimento: dataRecebimento,
        forma_pagamento: formaPagamento,
        pagamento_status: statusPagamento(recebimento.total_geral, value),
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["relatorios-salvos"] });
      setRecebimento(null);
      toast.success(result.queued ? "Recebimento salvo no aparelho" : "Recebimento registrado");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível registrar o recebimento"),
  });

  const openObservacao = (item: RelatorioSalvo) => {
    setRelatorioObservacao(item);
    setObservacao(item.observacao_relatorio ?? "");
    setDespesas((item.despesas_snapshot ?? []).map((despesa) => ({
      ...despesa,
      tipo: despesa.tipo ?? "diversos",
      data: despesa.data ?? item.fim,
      anexos: despesa.anexos ?? [],
      valor: String(despesa.valor).replace(".", ","),
    })));
  };

  const addExpensePhotos = async (despesaId: string, files: FileList | null, replaceIndex?: number) => {
    if (!files?.length) return;
    try {
      const photos = await Promise.all(Array.from(files).map((file) => resizeImage(file)));
      setDespesas((current) => current.map((despesa) => {
        if (despesa.id !== despesaId) return despesa;
        if (replaceIndex == null) return { ...despesa, anexos: [...despesa.anexos, ...photos] };
        const anexos = [...despesa.anexos];
        const replacement = photos[0];
        if (replacement) anexos[replaceIndex] = replacement;
        return { ...despesa, anexos };
      }));
    } catch {
      toast.error("Não foi possível usar essa foto");
    }
  };

  const saveObservacao = useMutation({
    mutationFn: async () => {
      if (!relatorioObservacao) throw new Error("Relatório não encontrado.");
      const despesasValidas = despesas.map((despesa) => ({
        id: despesa.id,
        tipo: despesa.tipo ?? "diversos" as const,
        descricao: despesa.descricao.trim(),
        data: despesa.data || relatorioObservacao.fim,
        valor: Number(despesa.valor.replace(",", ".")),
        anexos: despesa.anexos,
      }));
      if (despesasValidas.some((despesa) => !despesa.descricao || !Number.isFinite(despesa.valor) || despesa.valor <= 0)) {
        throw new Error("Preencha a descrição e um valor maior que zero em cada despesa.");
      }
      const totalDespesas = despesasValidas.reduce((total, despesa) => total + despesa.valor, 0);
      const totalGeral = relatorioObservacao.total_servicos + relatorioObservacao.total_pecas + totalDespesas;
      return saveRelatorioOffline({
        ...relatorioObservacao,
        observacao_relatorio: observacao.trim(),
        despesas_snapshot: despesasValidas,
        total_despesas: totalDespesas,
        total_geral: totalGeral,
        pagamento_status: statusPagamento(totalGeral, relatorioObservacao.valor_recebido),
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["relatorios-salvos"] });
      setRelatorioObservacao(null);
      toast.success(result.queued ? "Informações salvas no aparelho" : "Observação e despesas salvas");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar as informações"),
  });

  const generateReceipt = async (item: RelatorioSalvo) => {
    if (!item.data_recebimento || !item.forma_pagamento || item.valor_recebido <= 0) return;
    setGeneratingId(`recibo-${item.id}`);
    try {
      await generatePaymentReceipt({
        cliente: item.cliente_snapshot,
        inicio: item.inicio,
        fim: item.fim,
        valorRecebido: item.valor_recebido,
        formaPagamento: formasPagamento.find((option) => option.value === item.forma_pagamento)?.label ?? "Outro",
        dataRecebimento: item.data_recebimento,
      });
    } catch (error) {
      toast.error(error instanceof Error ? `Não foi possível gerar o recibo: ${error.message}` : "Não foi possível gerar o recibo");
    } finally {
      setGeneratingId(null);
    }
  };

  const statusInfo: Record<PagamentoStatus, { label: string; className: string }> = {
    pendente: { label: "Pendente", className: "bg-warning/15 text-warning-foreground" },
    parcial: { label: "Parcial", className: "bg-info/15 text-info" },
    pago: { label: "Pago", className: "bg-success/15 text-success" },
  };

  return (
    <PageShell title="Relatórios salvos" subtitle={`${relatorios.length} documento(s)`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar cliente" className="h-14 rounded-xl bg-card pl-12 pr-12 shadow-card" />
        {busca ? <Button type="button" variant="ghost" size="icon" aria-label="Limpar busca" onClick={() => setBusca("")} className="absolute right-1.5 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full"><X className="h-4 w-4" /></Button> : null}
      </div>

      <div className="-mx-4 border-b border-border bg-card px-4">
        <div className="grid grid-cols-4" role="tablist" aria-label="Período dos relatórios">
          {filtros.map((filtro) => (
            <Button
              key={filtro.id}
              type="button"
              variant="ghost"
              role="tab"
              aria-selected={periodo === filtro.id}
              className={`relative h-12 rounded-none px-1 text-sm font-medium ${periodo === filtro.id ? "text-primary" : "text-muted-foreground"}`}
              onClick={() => setPeriodo(filtro.id)}
            >
              {filtro.label}
              {periodo === filtro.id ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" /> : null}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Status do pagamento">
        {(["todos", "aberto", "pendente", "parcial", "pago"] as const).map((value) => (
          <Button key={value} type="button" size="sm" variant={status === value ? "default" : "outline"} className="shrink-0 rounded-full px-4" aria-selected={status === value} onClick={() => setStatus(value)}>
            {value === "todos" ? "Todos" : value === "aberto" ? "Em aberto" : statusInfo[value].label}
          </Button>
        ))}
      </div>

      {isLoading ? <p className="px-1 text-sm text-muted-foreground">Carregando...</p> : relatoriosVisiveis.length === 0 ? (
        <div className="ios-group px-5 py-10 text-center"><FileText className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 font-semibold">Nenhum relatório salvo</p><p className="mt-1 text-sm text-muted-foreground">Salve um relatório para consultá-lo aqui.</p></div>
      ) : (
        <Section title="Documentos" hint={`${relatoriosVisiveis.length} exibido(s)`}>
          <ul className="-my-4 divide-y divide-border">
            {relatoriosVisiveis.map((item) => (
              <li key={item.id} className="py-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><CalendarRange className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="font-semibold leading-snug">{item.cliente_nome}</p><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ${statusInfo[item.pagamento_status].className}`}>{statusInfo[item.pagamento_status].label}</span></div>
                      <p className="shrink-0 text-base font-bold tabular-nums text-primary">{formatCurrency(item.total_geral)}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{formatDateBR(item.inicio)} a {formatDateBR(item.fim)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Serviços {formatCurrency(item.total_servicos)} · Peças {formatCurrency(item.total_pecas)}{item.total_despesas > 0 ? ` · Despesas ${formatCurrency(item.total_despesas)}` : ""}</p>
                    {item.pagamento_status !== "pago" ? <p className="mt-1 text-xs font-medium text-warning-foreground">Saldo {formatCurrency(saldoRelatorio(item))}</p> : null}
                    {item.observacao_relatorio ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">Obs.: {item.observacao_relatorio}</p> : null}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 pl-[3.25rem]">
                  <Button asChild variant="outline" className="h-10 rounded-xl"><Link to="/relatorio" search={{ relatorio: item.id }}><FilePenLine className="mr-2 h-4 w-4" />Editar</Link></Button>
                  <Button variant="outline" className="h-10 rounded-xl" onClick={() => openRecebimento(item)}><HandCoins className="mr-2 h-4 w-4" />Recebimento</Button>
                    <Button variant="outline" className="h-10 rounded-xl" onClick={() => openObservacao(item)}><MessageSquareText className="mr-2 h-4 w-4" />Obs. e despesas</Button>
                  <Button variant="secondary" className="h-10 rounded-xl" disabled={generatingId === item.id} onClick={() => void generate(item)}><Download className="mr-2 h-4 w-4" />Relatório</Button>
                  {item.valor_recebido > 0 ? <Button variant="secondary" className="h-10 rounded-xl" disabled={generatingId === `recibo-${item.id}`} onClick={() => void generateReceipt(item)}><ReceiptText className="mr-2 h-4 w-4" />Recibo</Button> : <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" className="h-10 rounded-xl text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</Button></AlertDialogTrigger><AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl"><AlertDialogHeader><AlertDialogTitle>Excluir relatório?</AlertDialogTitle><AlertDialogDescription>O relatório salvo de {item.cliente_nome} será removido. Os apontamentos originais não serão apagados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => remove.mutate(item.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
                  {item.valor_recebido > 0 ? <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" className="col-span-2 h-10 rounded-xl text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</Button></AlertDialogTrigger><AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl"><AlertDialogHeader><AlertDialogTitle>Excluir relatório?</AlertDialogTitle><AlertDialogDescription>O relatório salvo de {item.cliente_nome} será removido. Os apontamentos originais não serão apagados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => remove.mutate(item.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Drawer open={Boolean(recebimento)} onOpenChange={(open) => { if (!open) setRecebimento(null); }}>
        <DrawerContent className="mx-auto max-w-lg rounded-t-3xl pb-[max(env(safe-area-inset-bottom),1rem)]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Registrar recebimento</DrawerTitle>
            <DrawerDescription>{recebimento?.cliente_nome} · Total {recebimento ? formatCurrency(recebimento.total_geral) : ""}</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4">
            <div className="space-y-1.5"><Label htmlFor="payment-value">Valor recebido</Label><Input id="payment-value" inputMode="decimal" value={valorRecebido} onChange={(event) => setValorRecebido(event.target.value)} className="h-12 rounded-xl" /></div>
            <div className="space-y-1.5"><Label htmlFor="payment-date">Data</Label><Input id="payment-date" type="date" value={dataRecebimento} onChange={(event) => setDataRecebimento(event.target.value)} className="h-12 rounded-xl" /></div>
            <div className="space-y-1.5"><Label htmlFor="payment-method">Forma de pagamento</Label><select id="payment-method" value={formaPagamento} onChange={(event) => setFormaPagamento(event.target.value as FormaPagamento)} className="ios-field h-12 w-full border px-3">{formasPagamento.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          </div>
          <DrawerFooter>
            <Button className="h-12 rounded-xl" disabled={saveRecebimento.isPending} onClick={() => saveRecebimento.mutate()}>{saveRecebimento.isPending ? "Salvando..." : "Confirmar recebimento"}</Button>
            <DrawerClose asChild><Button variant="ghost" className="h-11 rounded-xl">Cancelar</Button></DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      <Dialog open={Boolean(relatorioObservacao)} onOpenChange={(open) => { if (!open) setRelatorioObservacao(null); }}>
        <DialogContent className="bottom-3 left-3 right-3 top-[max(env(safe-area-inset-top),0.75rem)] flex w-auto max-w-lg translate-x-0 translate-y-0 grid-rows-none flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:left-1/2 sm:right-auto sm:w-[calc(100%-2rem)] sm:-translate-x-1/2">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-4 pr-12 text-left">
            <DialogTitle>Observação e despesas</DialogTitle>
            <DialogDescription>{relatorioObservacao?.cliente_nome} · informações do PDF final</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5">
            <div>
              <Label htmlFor="saved-report-note">Observação</Label>
              <Textarea id="saved-report-note" className="mt-1.5" value={observacao} onChange={(event) => setObservacao(event.target.value)} placeholder="Detalhes gerais do relatório" rows={4} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-sm font-semibold">Despesas adicionais</p><p className="text-xs text-muted-foreground">Hotel, pedágio ou outras despesas</p></div>
                <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-full" aria-label="Adicionar despesa" onClick={() => setDespesas((current) => [...current, { id: crypto.randomUUID(), tipo: "diversos", descricao: "", data: relatorioObservacao?.fim ?? "", valor: "", anexos: [] }])}><Plus className="h-4 w-4" /></Button>
              </div>
              {despesas.length === 0 ? <p className="rounded-xl bg-secondary px-3 py-4 text-center text-sm text-muted-foreground">Nenhuma despesa adicionada.</p> : (
                <div className="space-y-3">
                  {despesas.map((despesa, index) => (
                    <div key={despesa.id} className="space-y-3 rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">Despesa {index + 1}</p>{despesa.anexos.length > 0 ? <span className="inline-flex items-center gap-1 text-xs font-medium text-primary"><Paperclip className="h-3.5 w-3.5" />{despesa.anexos.length}</span> : null}<Button type="button" variant="ghost" size="icon" className="ml-auto h-9 w-9 rounded-full text-destructive" aria-label={`Remover despesa ${index + 1}`} onClick={() => setDespesas((current) => current.filter((item) => item.id !== despesa.id))}><Trash2 className="h-4 w-4" /></Button></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1"><Label htmlFor={`expense-type-${despesa.id}`}>Tipo</Label><select id={`expense-type-${despesa.id}`} value={despesa.tipo ?? "diversos"} onChange={(event) => setDespesas((current) => current.map((item) => item.id === despesa.id ? { ...item, tipo: event.target.value as DespesaRelatorio["tipo"] } : item))} className="ios-field h-11 w-full border px-3">{tiposDespesa.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}</select></div>
                        <div className="space-y-1"><Label htmlFor={`expense-date-${despesa.id}`}>Data</Label><Input id={`expense-date-${despesa.id}`} type="date" value={despesa.data ?? ""} onChange={(event) => setDespesas((current) => current.map((item) => item.id === despesa.id ? { ...item, data: event.target.value } : item))} className="h-11 rounded-xl" /></div>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                        <div className="space-y-1"><Label htmlFor={`expense-description-${despesa.id}`}>Descrição</Label><Input id={`expense-description-${despesa.id}`} value={despesa.descricao} onChange={(event) => setDespesas((current) => current.map((item) => item.id === despesa.id ? { ...item, descricao: event.target.value } : item))} placeholder="Hotel" className="h-11 rounded-xl" /></div>
                        <div className="space-y-1"><Label htmlFor={`expense-value-${despesa.id}`}>Valor</Label><Input id={`expense-value-${despesa.id}`} type="text" inputMode="decimal" value={despesa.valor} onChange={(event) => { const value = event.target.value; if (/^\d*[,.]?\d{0,2}$/.test(value)) setDespesas((current) => current.map((item) => item.id === despesa.id ? { ...item, valor: value } : item)); }} placeholder="0,00" className="h-11 rounded-xl text-right tabular-nums" /></div>
                      </div>
                      {despesa.anexos.length > 0 ? <div className="grid grid-cols-3 gap-2">{despesa.anexos.map((anexo, anexoIndex) => <div key={`${despesa.id}-${anexoIndex}`} className="relative aspect-square overflow-hidden rounded-lg border bg-muted"><Button type="button" variant="ghost" className="h-full w-full rounded-none p-0" aria-label={`Visualizar comprovante ${anexoIndex + 1}`} onClick={() => setAnexoAberto(anexo)}><img src={anexo} alt={`Comprovante ${anexoIndex + 1}`} className="h-full w-full object-cover" /></Button><div className="absolute bottom-1 right-1 flex gap-1"><Button asChild type="button" variant="secondary" size="icon" className="h-7 w-7 rounded-full shadow"><label aria-label={`Substituir comprovante ${anexoIndex + 1}`}><ImagePlus className="h-3.5 w-3.5" /><input type="file" accept="image/*" className="sr-only" onChange={(event) => void addExpensePhotos(despesa.id, event.target.files, anexoIndex)} /></label></Button><Button type="button" variant="destructive" size="icon" className="h-7 w-7 rounded-full shadow" aria-label={`Excluir comprovante ${anexoIndex + 1}`} onClick={() => setDespesas((current) => current.map((item) => item.id === despesa.id ? { ...item, anexos: item.anexos.filter((_, photoIndex) => photoIndex !== anexoIndex) } : item))}><Trash2 className="h-3.5 w-3.5" /></Button></div></div>)}</div> : null}
                      <div className="grid grid-cols-2 gap-2"><Button asChild type="button" variant="outline" className="h-10 rounded-xl"><label><Camera className="mr-2 h-4 w-4" />Câmera<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => void addExpensePhotos(despesa.id, event.target.files)} /></label></Button><Button asChild type="button" variant="outline" className="h-10 rounded-xl"><label><ImagePlus className="mr-2 h-4 w-4" />Galeria<input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => void addExpensePhotos(despesa.id, event.target.files)} /></label></Button></div>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-border pt-3 text-sm font-bold"><span>Total das despesas</span><span className="tabular-nums text-primary">{formatCurrency(despesas.reduce((total, despesa) => total + (Number(despesa.valor.replace(",", ".")) || 0), 0))}</span></div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-border bg-card px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:flex-row">
            <Button variant="ghost" className="h-11 rounded-xl sm:order-first" onClick={() => setRelatorioObservacao(null)}>Cancelar</Button>
            <Button className="h-11 rounded-xl" disabled={saveObservacao.isPending} onClick={() => saveObservacao.mutate()}>{saveObservacao.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(anexoAberto)} onOpenChange={(open) => { if (!open) setAnexoAberto(null); }}>
        <DialogContent className="!inset-0 !left-0 !top-0 h-[100dvh] max-h-none w-screen max-w-none !translate-x-0 !translate-y-0 border-0 bg-foreground p-0 text-background sm:!inset-auto sm:!left-1/2 sm:!top-1/2 sm:h-auto sm:max-h-[90dvh] sm:w-[calc(100%-2rem)] sm:max-w-3xl sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:rounded-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Comprovante</DialogTitle><DialogDescription>Visualização ampliada do comprovante</DialogDescription></DialogHeader>
          {anexoAberto ? <img src={anexoAberto} alt="Comprovante ampliado" className="h-full w-full object-contain" /> : null}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}