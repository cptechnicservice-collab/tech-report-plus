import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, CalendarIcon, Check, Clock3, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { FloatingInput, FloatingTextarea } from "@/components/FloatingField";
import { ClienteSelect } from "@/components/ClienteSelect";
import { PageShell, Section } from "@/components/PageShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchAgendamentos, type AgendamentoComCliente } from "@/lib/agenda";
import { fetchClientes, fetchValores, formatDateBR, normalizeTime, todayISO } from "@/lib/apontamentos";
import { valorVigente } from "@/lib/financeiro";
import { deleteAgendamentoOffline, saveAgendamentoOffline } from "@/lib/offline";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda de atendimentos — CP TECHNIC Horas" },
      { name: "description", content: "Organize atendimentos por cliente e inicie apontamentos direto da agenda." },
      { property: "og:title", content: "Agenda de atendimentos — CP TECHNIC Horas" },
      { property: "og:description", content: "Agenda prática de visitas e serviços técnicos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Agenda,
});

type Draft = {
  clienteId: string | null;
  data: string;
  dataFim: string;
  horario: string;
  servico: string;
  observacoes: string;
};

const emptyDraft = (): Draft => ({
  clienteId: null,
  data: todayISO(),
  dataFim: todayISO(),
  horario: "",
  servico: "",
  observacoes: "",
});

function draftFrom(item: AgendamentoComCliente): Draft {
  return {
    clienteId: item.cliente_id,
    data: item.data,
    dataFim: item.data_fim ?? item.data,
    horario: normalizeTime(item.horario),
    servico: item.maquina_servico ?? "",
    observacoes: item.observacoes ?? "",
  };
}

function toISODate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: (date: Date) => boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="ios-field h-12 w-full justify-start px-3 text-left font-normal">
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            {format(parseISO(value), "dd/MM/yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={parseISO(value)}
            onSelect={(date) => { if (date) onChange(toISODate(date)); }}
            disabled={disabled}
            locale={ptBR}
            initialFocus
            className="pointer-events-auto p-3"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function periodLabel(item: AgendamentoComCliente) {
  const end = item.data_fim ?? item.data;
  return end === item.data
    ? formatDateBR(item.data)
    : `${formatDateBR(item.data)} até ${formatDateBR(end)}`;
}

function errorReason(error: unknown) {
  if (error instanceof Error && error.message) return `: ${error.message}`;
  if (error && typeof error === "object" && "message" in error) return `: ${String(error.message)}`;
  return "";
}

function Agenda() {
  const [editing, setEditing] = useState<AgendamentoComCliente | "new" | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const queryClient = useQueryClient();
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: fetchClientes });
  const { data: agendamentos = [], isLoading } = useQuery({ queryKey: ["agendamentos"], queryFn: fetchAgendamentos });
  const { data: valores = [] } = useQuery({ queryKey: ["valores"], queryFn: fetchValores });

  const visible = useMemo(
    () => agendamentos.filter((item) => showCompleted || !item.concluido),
    [agendamentos, showCompleted],
  );
  const groups = useMemo(() => {
    const grouped = new Map<string, AgendamentoComCliente[]>();
    for (const item of visible) grouped.set(item.data, [...(grouped.get(item.data) ?? []), item]);
    return [...grouped.entries()];
  }, [visible]);
  const invalidPeriod = draft.dataFim < draft.data;
  const temValorVigente = !!valorVigente(todayISO(), valores);

  const save = useMutation({
    mutationFn: () => saveAgendamentoOffline({
      id: editing && editing !== "new" ? editing.id : crypto.randomUUID(),
      cliente_id: draft.clienteId as string,
      data: draft.data,
      data_fim: draft.dataFim,
      horario: draft.horario || null,
      maquina_servico: draft.servico.trim() || null,
      observacoes: draft.observacoes.trim() || null,
      concluido: editing && editing !== "new" ? editing.concluido : false,
    }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      setEditing(null);
      toast.success(result.queued ? "Salvo no aparelho — será enviado quando houver conexão" : "Agendamento salvo");
    },
    onError: (error) => toast.error(`Não foi possível salvar${errorReason(error)}`),
  });

  const updateCompleted = useMutation({
    mutationFn: (item: AgendamentoComCliente) => saveAgendamentoOffline({
      id: item.id,
      cliente_id: item.cliente_id,
      data: item.data,
      data_fim: item.data_fim ?? item.data,
      horario: item.horario,
      maquina_servico: item.maquina_servico,
      observacoes: item.observacoes,
      concluido: !item.concluido,
    }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["agendamentos"] }),
    onError: (error) => toast.error(`Não foi possível atualizar${errorReason(error)}`),
  });

  const remove = useMutation({
    mutationFn: deleteAgendamentoOffline,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      toast.success(result.queued ? "Exclusão salva no aparelho" : "Agendamento excluído");
    },
    onError: (error) => toast.error(`Não foi possível excluir${errorReason(error)}`),
  });

  const openNew = () => {
    setDraft(emptyDraft());
    setEditing("new");
  };

  return (
    <PageShell
      title="Agenda"
      subtitle={`${agendamentos.filter((item) => !item.concluido).length} atendimento(s) pendente(s)`}
      action={<Button size="icon" className="rounded-full" aria-label="Novo agendamento" onClick={openNew}><Plus className="h-5 w-5" /></Button>}
    >
      {!temValorVigente && (
        <div className="mx-4 mb-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800 dark:border-orange-900/30 dark:bg-orange-900/10 dark:text-orange-400">
          <p className="font-semibold text-orange-900 dark:text-orange-300">Valores não configurados</p>
          <p>Os cálculos financeiros não estarão disponíveis nos apontamentos. <Link to="/valores" className="underline font-medium">Configurar agora</Link></p>
        </div>
      )}
      <div className="ios-group flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><CalendarCheck className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Próximos atendimentos</p>
            <p className="truncate text-xs text-muted-foreground">Organizados por data e horário</p>
          </div>
        </div>
        <Button variant="ghost" className="shrink-0 px-2 text-xs" onClick={() => setShowCompleted((value) => !value)}>
          {showCompleted ? "Ocultar feitos" : "Ver feitos"}
        </Button>
      </div>

      {isLoading ? <p className="px-1 text-sm text-muted-foreground">Carregando...</p> : groups.length === 0 ? (
        <div className="ios-group px-5 py-8 text-center">
          <CalendarCheck className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">Agenda livre</p>
          <p className="mt-1 text-sm text-muted-foreground">Toque em + para agendar um atendimento.</p>
        </div>
      ) : groups.map(([date, items]) => (
        <Section key={date} title={date === todayISO() ? `Hoje · ${formatDateBR(date)}` : formatDateBR(date)}>
          <ul className="-my-2 divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className={`py-3 ${item.concluido ? "opacity-55" : ""}`}>
                <div className="flex items-start gap-3">
                  <Button
                    type="button"
                    variant={item.concluido ? "secondary" : "outline"}
                    size="icon"
                    className="mt-0.5 h-10 w-10 shrink-0 rounded-full"
                    aria-label={item.concluido ? "Marcar como pendente" : "Marcar como concluído"}
                    onClick={() => updateCompleted.mutate(item)}
                  >
                    {item.concluido ? <Check className="h-5 w-5 text-success" /> : <span className="h-4 w-4 rounded-full border-2 border-muted-foreground" />}
                  </Button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-semibold ${item.concluido ? "line-through" : ""}`}>{item.clientes?.nome ?? "Cliente"}</p>
                        {item.horario ? <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-primary"><Clock3 className="h-3.5 w-3.5" />{normalizeTime(item.horario)}</p> : null}
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Editar agendamento" onClick={() => { setDraft(draftFrom(item)); setEditing(item); }}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-destructive" aria-label="Excluir agendamento"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl">
                            <AlertDialogHeader><AlertDialogTitle>Excluir agendamento?</AlertDialogTitle><AlertDialogDescription>Esta ação removerá o atendimento da agenda.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => remove.mutate(item.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    {item.data_fim && item.data_fim !== item.data ? <p className="mt-1 text-xs font-medium text-primary">{periodLabel(item)}</p> : null}
                    {item.maquina_servico ? <p className="mt-2 text-sm text-muted-foreground">{item.maquina_servico}</p> : null}
                    {item.observacoes ? <p className="mt-1 text-xs text-muted-foreground">{item.observacoes}</p> : null}
                    {!item.concluido ? (
                      <Button asChild variant="secondary" className="mt-3 h-10 rounded-xl px-3">
                        <Link to="/novo" search={{ data: item.data, cliente: item.cliente_id, servico: item.maquina_servico ?? undefined }}>
                          <Play className="mr-1.5 h-4 w-4" /> Iniciar apontamento
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="bottom-0 top-auto max-h-[92dvh] max-w-md translate-y-0 overflow-y-auto rounded-t-3xl border-x-0 border-b-0 p-5 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border">
          <DialogHeader><DialogTitle>{editing === "new" ? "Novo agendamento" : "Editar agendamento"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <ClienteSelect clientes={clientes} value={draft.clienteId} onChange={(clienteId) => setDraft((current) => ({ ...current, clienteId }))} />
            <div className="grid grid-cols-2 gap-3">
              <DateField
                label="Início"
                value={draft.data}
                onChange={(data) => setDraft((current) => ({ ...current, data, dataFim: current.dataFim < data ? data : current.dataFim }))}
              />
              <DateField
                label="Fim"
                value={draft.dataFim}
                disabled={(date) => toISODate(date) < draft.data}
                onChange={(dataFim) => setDraft((current) => ({ ...current, dataFim }))}
              />
            </div>
            <FloatingInput id="agenda-hora" label="Horário previsto (opcional)" type="time" value={draft.horario} onChange={(event) => setDraft((current) => ({ ...current, horario: event.target.value }))} />
            {invalidPeriod ? <p role="alert" className="text-sm font-medium text-destructive">A data final não pode ser anterior à data de início.</p> : null}
            <FloatingInput id="agenda-servico" label="Máquina / Serviço" value={draft.servico} onChange={(event) => setDraft((current) => ({ ...current, servico: event.target.value }))} />
            <FloatingTextarea id="agenda-obs" label="Observações" value={draft.observacoes} onChange={(event) => setDraft((current) => ({ ...current, observacoes: event.target.value }))} rows={3} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" className="h-12 rounded-xl" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button className="h-12 rounded-xl" disabled={!draft.clienteId || !draft.data || !draft.dataFim || invalidPeriod || save.isPending} onClick={() => save.mutate()}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}