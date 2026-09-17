import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Download, FilePenLine, FileText, HandCoins, ReceiptText, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { PageShell, Section } from "@/components/PageShell";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { formatDateBR, normalizeSearchText } from "@/lib/apontamentos";
import { formatCurrency } from "@/lib/financeiro";
import { deleteRelatorioOffline, saveRelatorioOffline } from "@/lib/offline";
import { generateClientReport, generatePaymentReceipt } from "@/lib/pdf-report";
import { fetchRelatoriosSalvos, formasPagamento, saldoRelatorio, statusPagamento, type FormaPagamento, type PagamentoStatus, type RelatorioSalvo } from "@/lib/relatorios";

export const Route = createFileRoute("/_authenticated/relatorios-salvos")({
  validateSearch: (search: Record<string, unknown>): { status?: PagamentoStatus } => {
    const value = search["status"];
    return value === "pendente" || value === "parcial" || value === "pago" ? { status: value } : {};
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
  const [status, setStatus] = useState<"todos" | PagamentoStatus>(search.status ?? "todos");
  const [recebimento, setRecebimento] = useState<RelatorioSalvo | null>(null);
  const [valorRecebido, setValorRecebido] = useState("");
  const [dataRecebimento, setDataRecebimento] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("pix");
  const queryClient = useQueryClient();
  const { data: relatorios = [], isLoading } = useQuery({ queryKey: ["relatorios-salvos"], queryFn: fetchRelatoriosSalvos });
  const relatoriosVisiveis = useMemo(() => {
    const term = normalizeSearchText(busca);
    const agora = new Date();
    const limiteDias = periodo === "30" ? 30 : periodo === "60" ? 60 : null;
    return [...relatorios]
      .filter((item) => {
        if (term && !normalizeSearchText(item.cliente_nome).includes(term)) return false;
        if (status !== "todos" && item.pagamento_status !== status) return false;
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
        {(["todos", "pendente", "parcial", "pago"] as const).map((value) => (
          <Button key={value} type="button" size="sm" variant={status === value ? "default" : "outline"} className="shrink-0 rounded-full px-4" aria-selected={status === value} onClick={() => setStatus(value)}>
            {value === "todos" ? "Todos" : statusInfo[value].label}
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
                    <p className="mt-1 text-xs text-muted-foreground">Serviços {formatCurrency(item.total_servicos)} · Peças {formatCurrency(item.total_pecas)}</p>
                    {item.pagamento_status !== "pago" ? <p className="mt-1 text-xs font-medium text-warning-foreground">Saldo {formatCurrency(saldoRelatorio(item))}</p> : null}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 pl-[3.25rem]">
                  <Button asChild variant="outline" className="h-10 rounded-xl"><Link to="/relatorio" search={{ relatorio: item.id }}><FilePenLine className="mr-2 h-4 w-4" />Editar</Link></Button>
                  <Button variant="outline" className="h-10 rounded-xl" onClick={() => openRecebimento(item)}><HandCoins className="mr-2 h-4 w-4" />Recebimento</Button>
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
    </PageShell>
  );
}