import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Download, FilePenLine, FileText, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { PageShell, Section } from "@/components/PageShell";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateBR, normalizeSearchText } from "@/lib/apontamentos";
import { formatCurrency } from "@/lib/financeiro";
import { deleteRelatorioOffline } from "@/lib/offline";
import { generateClientReport } from "@/lib/pdf-report";
import { fetchRelatoriosSalvos, type RelatorioSalvo } from "@/lib/relatorios";

export const Route = createFileRoute("/_authenticated/relatorios-salvos")({
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
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState<"ultimos" | "30" | "60" | "todos">("ultimos");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: relatorios = [], isLoading } = useQuery({ queryKey: ["relatorios-salvos"], queryFn: fetchRelatoriosSalvos });
  const relatoriosVisiveis = useMemo(() => {
    const term = normalizeSearchText(busca);
    const agora = new Date();
    const limiteDias = periodo === "30" ? 30 : periodo === "60" ? 60 : null;
    return [...relatorios]
      .filter((item) => {
        if (term && !normalizeSearchText(item.cliente_nome).includes(term)) return false;
        if (limiteDias == null) return true;
        const limite = new Date(agora);
        limite.setDate(limite.getDate() - limiteDias);
        return new Date(item.created_at) >= limite;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, periodo === "ultimos" ? 12 : undefined);
  }, [busca, periodo, relatorios]);

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
                      <p className="min-w-0 font-semibold leading-snug">{item.cliente_nome}</p>
                      <p className="shrink-0 text-base font-bold tabular-nums text-primary">{formatCurrency(item.total_geral)}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{formatDateBR(item.inicio)} a {formatDateBR(item.fim)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Serviços {formatCurrency(item.total_servicos)} · Peças {formatCurrency(item.total_pecas)}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 pl-[3.25rem]">
                  <Button asChild variant="outline" className="h-10 rounded-xl"><Link to="/relatorio" search={{ relatorio: item.id }}><FilePenLine className="mr-2 h-4 w-4" />Editar</Link></Button>
                  <Button variant="secondary" size="icon" className="h-10 w-10 rounded-xl" aria-label={generatingId === item.id ? "Gerando PDF" : "Gerar PDF"} title="Gerar PDF" disabled={generatingId === item.id} onClick={() => void generate(item)}><Download className="h-4 w-4" /></Button>
                  <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-destructive" aria-label="Excluir relatório"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl"><AlertDialogHeader><AlertDialogTitle>Excluir relatório?</AlertDialogTitle><AlertDialogDescription>O relatório salvo de {item.cliente_nome} será removido. Os apontamentos originais não serão apagados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => remove.mutate(item.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </PageShell>
  );
}