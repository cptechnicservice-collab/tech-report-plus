import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, Copy, Plus } from "lucide-react";
import { toast } from "sonner";

import { Section } from "@/components/PageShell";
import { ClienteSelect } from "@/components/ClienteSelect";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FloatingInput, FloatingTextarea } from "@/components/FloatingField";
import { PartPicker, type SelectedPart } from "@/components/PartPicker";
import { TimeWheelField } from "@/components/TimeWheelField";
import { ParecidoSheet, type ParecidoOpcoes } from "@/components/ParecidoSheet";
import { Progress } from "@/components/ui/progress";
import {
  calcularTotais,
  diffMinutes,
  fetchApontamentos,
  fetchClientes,
  fetchValores,
  formatMinutes,
  normalizeTime,
  todayISO,
  validarApontamento,
  type Apontamento,
} from "@/lib/apontamentos";
import { formatCurrency, valorVigente } from "@/lib/financeiro";
import { fetchPecas } from "@/lib/pecas";
import { fetchApontamentoPecas } from "@/lib/apontamento-pecas";
import { deleteApontamentoOffline, saveAgendamentoOffline, saveApontamentoOffline, saveApontamentoPecasOffline } from "@/lib/offline";
import { fetchAgendamento } from "@/lib/agenda";
import { fetchOrcamento } from "@/lib/orcamentos";
import { useFormDraft } from "@/hooks/use-form-draft";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { apontamentoValidationSchema, assertApontamentoValid } from "@/lib/apontamento-validation";
import { isDecimalBRInput, parseDecimalBR } from "@/lib/decimal-br";
import { selecionarRefeicao, type DiariaTipo } from "@/lib/refeicoes";

type FormState = {
  data: string;
  cliente_id: string | null;
  maquina_servico: string;
  viagem_ida_saida: string;
  viagem_ida_chegada: string;
  trabalho_inicio: string;
  trabalho_fim: string;
  intervalo_inicio: string;
  intervalo_fim: string;
  viagem_volta_saida: string;
  viagem_volta_chegada: string;
  km_ida: string;
  km_volta: string;
  observacoes: string;
  diaria_tipo: DiariaTipo;
  pedagio: string;
  outras_despesas: string;
  outras_despesas_descricao: string;
};

type ApontamentoDraft = {
  data?: string | undefined;
  clienteId?: string | undefined;
  servico?: string | undefined;
  agendaId?: string | undefined;
  orcamentoId?: string | undefined;
  parecidoId?: string | undefined;
};

function initialState(a?: Apontamento, draft?: ApontamentoDraft): FormState {
  return {
    data: a?.data ?? draft?.data ?? todayISO(),
    cliente_id: a?.cliente_id ?? draft?.clienteId ?? null,
    maquina_servico: a?.maquina_servico ?? draft?.servico ?? "",
    viagem_ida_saida: normalizeTime(a?.viagem_ida_saida),
    viagem_ida_chegada: normalizeTime(a?.viagem_ida_chegada),
    trabalho_inicio: normalizeTime(a?.trabalho_inicio),
    trabalho_fim: normalizeTime(a?.trabalho_fim),
    intervalo_inicio: normalizeTime(a?.intervalo_inicio),
    intervalo_fim: normalizeTime(a?.intervalo_fim),
    viagem_volta_saida: normalizeTime(a?.viagem_volta_saida),
    viagem_volta_chegada: normalizeTime(a?.viagem_volta_chegada),
    km_ida: a?.km_ida != null
      ? String(a.km_ida)
      : a?.km_total != null
        ? String(a.km_total)
        : a?.km_inicial != null && a?.km_final != null && a.km_final >= a.km_inicial
          ? String(a.km_final - a.km_inicial)
          : "",
    km_volta: a?.km_volta != null ? String(a.km_volta) : "",
    observacoes: a?.observacoes ?? "",
    diaria_tipo: (a?.diaria_tipo as FormState["diaria_tipo"] | undefined) ?? "nenhuma",
    pedagio: a?.pedagio != null ? String(a.pedagio) : "",
    outras_despesas: a?.outras_despesas != null ? String(a.outras_despesas) : "",
    outras_despesas_descricao: a?.outras_despesas_descricao ?? "",
  };
}

function FilledBadge() {
  return <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.68rem] font-medium text-primary"><Check className="h-3 w-3" /> Preenchido</span>;
}

function OptionalSection({
  id,
  title,
  addLabel,
  hasValue,
  onClear,
  children,
}: {
  id: string;
  title: string;
  addLabel: string;
  hasValue: boolean;
  onClear: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(hasValue);
  useEffect(() => { if (hasValue) setOpen(true); }, [hasValue]);

  if (!open) {
    return (
      <button id={id} type="button" onClick={() => setOpen(true)} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground">
        <Plus className="h-4 w-4" /> {addLabel}
      </button>
    );
  }
  return (
    <section id={id} className="ios-group">
      <div className="flex min-h-12 items-center gap-2 px-4">
        <span className="text-sm font-semibold">{title}</span>
        {hasValue ? <FilledBadge /> : null}
        <Button type="button" variant="ghost" className="ml-auto h-11 rounded-lg px-2 text-xs text-muted-foreground" onClick={() => { onClear(); setOpen(false); }}>
          {hasValue ? "Limpar" : "Fechar"}
        </Button>
      </div>
      <div className="border-t border-border px-4 pb-4 pt-4">{children}</div>
    </section>
  );
}

function SectionTitle({ title, filled, hint }: { title: string; filled?: boolean; hint?: string }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
      <h2 className="text-sm font-semibold">{title}</h2>
      {filled ? <FilledBadge /> : hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

type StepError = { anchor: string; message: string };

function pairErrors(form: FormState): StepError[] {
  const pairs: [keyof FormState, keyof FormState, string, string, string][] = [
    ["viagem_ida_saida", "viagem_ida_chegada", "sec-ida", "Informe a saída da viagem de ida", "Informe a chegada da viagem de ida"],
    ["trabalho_inicio", "trabalho_fim", "sec-trabalho", "Informe o início do trabalho", "Informe o fim do trabalho"],
    ["intervalo_inicio", "intervalo_fim", "sec-intervalo", "Informe o início do intervalo", "Informe o fim do intervalo"],
    ["viagem_volta_saida", "viagem_volta_chegada", "sec-volta", "Informe a saída da viagem de retorno", "Informe a chegada da viagem de retorno"],
  ];
  const errors: StepError[] = [];
  for (const [start, end, anchor, startMsg, endMsg] of pairs) {
    if (form[end] && !form[start]) errors.push({ anchor, message: startMsg });
    else if (form[start] && !form[end]) errors.push({ anchor, message: endMsg });
  }
  return errors;
}

function Warning({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs font-medium text-destructive">{children}</p>;
}

function errorReason(error: unknown) {
  if (error instanceof Error && error.message) return `: ${error.message}`;
  if (error && typeof error === "object" && "message" in error) return `: ${String(error.message)}`;
  return "";
}

export function ApontamentoForm({ apontamento, draft, step = 1, onStepChange }: { apontamento?: Apontamento; draft?: ApontamentoDraft; step?: 1 | 2; onStepChange?: (step: 1 | 2) => void }) {
  const [parecidoOpen, setParecidoOpen] = useState(false);
  const [parecidoInitial, setParecidoInitial] = useState<string | undefined>(undefined);
  const [showErrors, setShowErrors] = useState(false);
  const [form, setForm] = useState<FormState>(() => initialState(apontamento, draft));
  const [pecaId, setPecaId] = useState("");
  const [pecasSelecionadas, setPecasSelecionadas] = useState<SelectedPart[]>([]);
  const [partsInitialized, setPartsInitialized] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: fetchClientes });
  const { data: apontamentos = [] } = useQuery({
    queryKey: ["apontamentos"],
    queryFn: fetchApontamentos,
  });
  const { data: valores = [] } = useQuery({ queryKey: ["valores"], queryFn: fetchValores });
  const { data: pecas = [] } = useQuery({ queryKey: ["pecas"], queryFn: fetchPecas });
  const { data: apontamentoPecas = [], isFetched: partsFetched } = useQuery({ queryKey: ["apontamento-pecas"], queryFn: fetchApontamentoPecas });
  const { data: sourceAgenda } = useQuery({ queryKey: ["agendamento", draft?.agendaId], queryFn: () => fetchAgendamento(draft?.agendaId ?? ""), enabled: Boolean(draft?.agendaId) });
  const { data: sourceQuote, isFetched: sourceQuoteFetched } = useQuery({ queryKey: ["orcamento", draft?.orcamentoId], queryFn: () => fetchOrcamento(draft?.orcamentoId ?? ""), enabled: Boolean(draft?.orcamentoId) });
  const draftReady = apontamento ? partsFetched && partsInitialized : draft?.orcamentoId ? sourceQuoteFetched && partsInitialized : true;
  const draftState = useMemo(() => ({ form, pecasSelecionadas }), [form, pecasSelecionadas]);
  const { clearDraft, isDirty } = useFormDraft({ key: `apontamento:${apontamento?.id ?? draft?.agendaId ?? draft?.orcamentoId ?? "novo"}`, value: draftState, restore: (saved) => { setForm(saved.form); setPecasSelecionadas(saved.pecasSelecionadas); }, enabled: draftReady });
  useUnsavedChanges(isDirty);

  useEffect(() => {
    if (!apontamento || !partsFetched || partsInitialized) return;
    setPecasSelecionadas(apontamentoPecas.filter((item) => item.apontamento_id === apontamento.id).map((item) => ({
      id: item.id, peca_id: item.peca_id, descricao: item.descricao, codigo: item.codigo, unidade: item.unidade,
      preco: item.valor_unitario, foto_data_url: item.foto_data_url, quantidade: item.quantidade,
    })));
    setPartsInitialized(true);
  }, [apontamento, apontamentoPecas, partsFetched, partsInitialized]);

  useEffect(() => {
    if (!sourceQuote || apontamento || partsInitialized) return;
    setPecasSelecionadas(sourceQuote.itens.filter((item) => item.tipo === "produto").map((item) => ({ id: crypto.randomUUID(), peca_id: item.peca_id, descricao: item.nome, codigo: item.codigo, unidade: item.unidade, preco: item.valor_unitario, foto_data_url: item.foto_data_url, quantidade: item.quantidade })));
    setPartsInitialized(true);
  }, [apontamento, partsInitialized, sourceQuote]);

  const [parecidoHandled, setParecidoHandled] = useState(false);
  useEffect(() => {
    if (parecidoHandled || !draft?.parecidoId || !apontamentos.some((a) => a.id === draft.parecidoId)) return;
    setParecidoHandled(true);
    setParecidoInitial(draft.parecidoId);
    setParecidoOpen(true);
  }, [apontamentos, draft?.parecidoId, parecidoHandled]);

  const aplicarParecido = (origem: (typeof apontamentos)[number], opcoes: ParecidoOpcoes) => {
    const base = initialState(origem);
    setForm((prev) => ({
      ...prev,
      cliente_id: origem.cliente_id,
      maquina_servico: origem.maquina_servico ?? "",
      ...(opcoes.km ? { km_ida: base.km_ida, km_volta: base.km_volta } : {}),
      ...(opcoes.despesas ? { diaria_tipo: base.diaria_tipo, pedagio: base.pedagio, outras_despesas: base.outras_despesas, outras_despesas_descricao: base.outras_despesas_descricao } : {}),
      ...(opcoes.observacoes ? { observacoes: base.observacoes } : {}),
    }));
    toast.success("Dados do atendimento aplicados");
  };

  const recentIds = useMemo(() => {
    const ids: string[] = [];
    for (const a of apontamentos) {
      if (!ids.includes(a.cliente_id)) ids.push(a.cliente_id);
    }
    return ids.slice(0, 5);
  }, [apontamentos]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const payload = useMemo(() => {
    const t = (v: string) => (v ? v : null);
    const n = parseDecimalBR;
    return {
      data: form.data,
      cliente_id: form.cliente_id as string,
      maquina_servico: form.maquina_servico.trim() || null,
      viagem_ida_saida: t(form.viagem_ida_saida),
      viagem_ida_chegada: t(form.viagem_ida_chegada),
      trabalho_inicio: t(form.trabalho_inicio),
      trabalho_fim: t(form.trabalho_fim),
      intervalo_inicio: t(form.intervalo_inicio),
      intervalo_fim: t(form.intervalo_fim),
      viagem_volta_saida: t(form.viagem_volta_saida),
      viagem_volta_chegada: t(form.viagem_volta_chegada),
      km_inicial: apontamento?.km_inicial ?? null,
      km_final: apontamento?.km_final ?? null,
      km_total: null,
      km_ida: n(form.km_ida),
      km_volta: n(form.km_volta),
      observacoes: form.observacoes.trim() || null,
      diaria_tipo: form.diaria_tipo,
      pedagio: n(form.pedagio),
      outras_despesas: n(form.outras_despesas),
      outras_despesas_descricao: form.outras_despesas_descricao.trim() || null,
    };
  }, [form, apontamento?.km_inicial, apontamento?.km_final]);

  const totais = useMemo(() => calcularTotais(payload), [payload]);
  const validacoes = useMemo(() => validarApontamento(payload), [payload]);
  const validation = useMemo(() => apontamentoValidationSchema.safeParse(payload), [payload]);
  const valorAtual = useMemo(() => valorVigente(form.data, valores), [form.data, valores]);
  const retornoKm = totais.km * (valorAtual?.valor_km ?? 0);

  const salvar = useMutation({
    mutationFn: async () => {
      assertApontamentoValid(payload);
      const id = apontamento?.id ?? crypto.randomUUID();
      const saved = await saveApontamentoOffline({
        ...payload,
        id,
        sync_status: "pending",
        synced_at: null,
        external_row_id: apontamento?.external_row_id ?? null,
        user_id: apontamento?.user_id ?? null,
      });
      const parts = await saveApontamentoPecasOffline(id, pecasSelecionadas.map((part) => ({
        id: part.id,
        apontamento_id: id,
        peca_id: part.peca_id,
        descricao: part.descricao,
        codigo: part.codigo,
        unidade: part.unidade,
        valor_unitario: part.preco,
        quantidade: Number(part.quantidade),
        foto_data_url: part.foto_data_url,
      })));
      return { ...saved, queued: saved.queued || parts.queued };
    },
    onSuccess: async (result) => {
      clearDraft();
      queryClient.invalidateQueries({ queryKey: ["apontamentos"] });
      queryClient.invalidateQueries({ queryKey: ["apontamento-pecas"] });
      toast.success(
        result.queued
          ? "Salvo no aparelho — será enviado quando houver conexão"
          : apontamento
            ? "Apontamento atualizado"
            : "Apontamento salvo",
      );
      if (sourceAgenda && !sourceAgenda.concluido && window.confirm("Apontamento salvo. Marcar este agendamento como concluído?")) {
        await saveAgendamentoOffline({ id: sourceAgenda.id, cliente_id: sourceAgenda.cliente_id, data: sourceAgenda.data, data_fim: sourceAgenda.data_fim, horario: sourceAgenda.horario, maquina_servico: sourceAgenda.maquina_servico, observacoes: sourceAgenda.observacoes, concluido: true });
        await queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      }
      await navigate({ to: "/historico" });
    },
    onError: (error) => toast.error(`Não foi possível salvar${errorReason(error)}`),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      if (!apontamento) return;
      return deleteApontamentoOffline(apontamento.id);
    },
    onSuccess: (result) => {
      clearDraft();
      queryClient.invalidateQueries({ queryKey: ["apontamentos"] });
      toast.success(result?.queued ? "Exclusão salva no aparelho — será enviada quando houver conexão" : "Apontamento excluído");
      navigate({ to: "/historico" });
    },
    onError: (error) => toast.error(`Não foi possível excluir${errorReason(error)}`),
  });

  const podeSalvar = Boolean(
    form.cliente_id &&
      form.data &&
      !validacoes.trabalhoIncompleto &&
      validation.success &&
      pecasSelecionadas.every((part) => typeof part.quantidade === "number" && part.quantidade > 0),
  );

  const step1Errors = useMemo<StepError[]>(() => {
    const errors: StepError[] = [];
    if (!form.data) errors.push({ anchor: "sec-cliente", message: "Informe a data" });
    if (!form.cliente_id) errors.push({ anchor: "sec-cliente", message: "Selecione o cliente" });
    errors.push(...pairErrors(form));
    if (validacoes.trabalhoHorariosIguais) errors.push({ anchor: "sec-trabalho", message: "O fim do trabalho deve ser diferente do início" });
    return errors;
  }, [form, validacoes.trabalhoHorariosIguais]);
  const errorFor = (anchor: string) => (showErrors ? step1Errors.filter((e) => e.anchor === anchor) : []);

  const continuar = () => {
    if (step1Errors.length) {
      setShowErrors(true);
      document.getElementById(step1Errors[0]!.anchor)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    onStepChange?.(2);
    window.scrollTo({ top: 0 });
  };

  const despesasPreenchidas = form.diaria_tipo !== "nenhuma" || Boolean(form.pedagio || form.outras_despesas || form.outras_despesas_descricao);
  const footerClass = "sticky z-30 -mx-4 space-y-2 border-t border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur bottom-[calc(5.25rem+env(safe-area-inset-bottom))]";

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between px-1 text-xs">
          <span className="font-semibold">{step === 1 ? "1 de 2 · Atendimento" : "2 de 2 · Complementos"}</span>
          {step === 2 ? <button type="button" className="min-h-11 px-1 text-primary" onClick={() => onStepChange?.(1)}>Editar atendimento</button> : null}
        </div>
        <Progress value={step === 1 ? 50 : 100} className="h-1.5" />
      </div>

      {step === 1 ? (
        <>
          <section id="sec-cliente">
            <SectionTitle title="Identificação" />
            <div className="ios-group space-y-4 p-4">
              <FloatingInput id="data" label="Data" type="date" value={form.data} onChange={(e) => set("data", e.target.value)} />
              <ClienteSelect clientes={clientes} value={form.cliente_id} onChange={(id) => set("cliente_id", id)} recentIds={recentIds} />
              {!apontamento && apontamentos.length ? (
                <button type="button" className="-mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-primary" onClick={() => { setParecidoInitial(undefined); setParecidoOpen(true); }}>
                  <Copy className="h-4 w-4" /> Usar atendimento parecido
                </button>
              ) : null}
              <FloatingInput id="maquina" label="Máquina / Serviço (opcional)" value={form.maquina_servico} onChange={(e) => set("maquina_servico", e.target.value)} />
              {errorFor("sec-cliente").map((e) => <Warning key={e.message}>{e.message}</Warning>)}
            </div>
          </section>

          <OptionalSection id="sec-ida" title="Viagem ida" addLabel="Adicionar viagem de ida" hasValue={Boolean(form.viagem_ida_saida || form.viagem_ida_chegada)} onClear={() => setForm((prev) => ({ ...prev, viagem_ida_saida: "", viagem_ida_chegada: "" }))}>
            <div className="grid grid-cols-2 gap-3">
              <TimeWheelField label="Saída" value={form.viagem_ida_saida} onChange={(v) => set("viagem_ida_saida", v)} />
              <TimeWheelField label="Chegada" value={form.viagem_ida_chegada} onChange={(v) => set("viagem_ida_chegada", v)} />
            </div>
            {errorFor("sec-ida").map((e) => <Warning key={e.message}>{e.message}</Warning>)}
            {validacoes.viagemIdaDiaSeguinte ? <Warning>Termina no dia seguinte? Total: {formatMinutes(diffMinutes(payload.viagem_ida_saida, payload.viagem_ida_chegada))}</Warning> : null}
          </OptionalSection>

          <section id="sec-trabalho">
            <SectionTitle title="Trabalho" filled={Boolean(form.trabalho_inicio && form.trabalho_fim)} hint="opcional" />
            <div className="ios-group space-y-1 p-4">
              <div className="grid grid-cols-2 gap-3">
                <TimeWheelField label="Início" value={form.trabalho_inicio} onChange={(v) => set("trabalho_inicio", v)} />
                <TimeWheelField label="Fim" value={form.trabalho_fim} onChange={(v) => set("trabalho_fim", v)} />
              </div>
              {errorFor("sec-trabalho").map((e) => <Warning key={e.message}>{e.message}</Warning>)}
              {validacoes.trabalhoDiaSeguinte ? <Warning>Termina no dia seguinte? Total: {formatMinutes(totais.trabalho)}</Warning> : null}
              {validacoes.jornadaLonga ? <Warning>Jornada acima de 16h. Confira os horários.</Warning> : null}
            </div>
          </section>

          <OptionalSection id="sec-intervalo" title="Intervalo" addLabel="Adicionar intervalo" hasValue={Boolean(form.intervalo_inicio || form.intervalo_fim)} onClear={() => setForm((prev) => ({ ...prev, intervalo_inicio: "", intervalo_fim: "" }))}>
            <div className="grid grid-cols-2 gap-3">
              <TimeWheelField label="Início" value={form.intervalo_inicio} onChange={(v) => set("intervalo_inicio", v)} />
              <TimeWheelField label="Fim" value={form.intervalo_fim} onChange={(v) => set("intervalo_fim", v)} />
            </div>
            {errorFor("sec-intervalo").map((e) => <Warning key={e.message}>{e.message}</Warning>)}
            {validacoes.intervaloInvalido ? <Warning>Intervalo fora da jornada ou maior que o trabalho. Não será descontado.</Warning> : null}
          </OptionalSection>

          <OptionalSection id="sec-volta" title="Viagem retorno" addLabel="Adicionar viagem de retorno" hasValue={Boolean(form.viagem_volta_saida || form.viagem_volta_chegada)} onClear={() => setForm((prev) => ({ ...prev, viagem_volta_saida: "", viagem_volta_chegada: "" }))}>
            <div className="grid grid-cols-2 gap-3">
              <TimeWheelField label="Saída" value={form.viagem_volta_saida} onChange={(v) => set("viagem_volta_saida", v)} />
              <TimeWheelField label="Chegada" value={form.viagem_volta_chegada} onChange={(v) => set("viagem_volta_chegada", v)} />
            </div>
            {errorFor("sec-volta").map((e) => <Warning key={e.message}>{e.message}</Warning>)}
            {validacoes.viagemVoltaDiaSeguinte ? <Warning>Termina no dia seguinte? Total: {formatMinutes(diffMinutes(payload.viagem_volta_saida, payload.viagem_volta_chegada))}</Warning> : null}
          </OptionalSection>

          <div className={footerClass}>
            <div className="flex justify-around text-xs text-muted-foreground tabular-nums">
              <span>Trabalho <strong className="text-sm text-foreground">{formatMinutes(totais.trabalho)}</strong></span>
              <span>Viagem <strong className="text-sm text-foreground">{formatMinutes(totais.viagem)}</strong></span>
            </div>
            <Button type="button" className="h-14 w-full rounded-2xl text-base font-semibold" onClick={continuar}>
              Continuar · KM e despesas
            </Button>
          </div>
        </>
      ) : (
        <>
          <section>
            <SectionTitle title="Quilometragem" filled={Boolean(form.km_ida || form.km_volta)} hint="opcional" />
            <div className="ios-group grid grid-cols-2 gap-3 p-4">
              <FloatingInput id="km-ida" label="KM total ida" inputMode="decimal" value={form.km_ida} onChange={(event) => { if (isDecimalBRInput(event.target.value)) set("km_ida", event.target.value); }} />
              <FloatingInput id="km-volta" label="KM total volta" inputMode="decimal" value={form.km_volta} onChange={(event) => { if (isDecimalBRInput(event.target.value)) set("km_volta", event.target.value); }} />
            </div>
          </section>

          <section>
            <SectionTitle title="Despesas" filled={despesasPreenchidas} hint="opcional" />
            <div className="ios-group space-y-4 p-4">
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Alimentação</p>
                <div className="grid grid-cols-2 gap-3">
                  {(["almoco", "janta"] as const).map((refeicao) => (
                    <Label key={refeicao} htmlFor={`refeicao-${refeicao}`} className="ios-field flex min-h-12 cursor-pointer items-center gap-3 border px-3">
                      <Checkbox
                        id={`refeicao-${refeicao}`}
                        checked={form.diaria_tipo === "inteira" || form.diaria_tipo === (refeicao === "almoco" ? "meia" : "janta")}
                        onCheckedChange={(checked) => set("diaria_tipo", selecionarRefeicao(form.diaria_tipo, refeicao, checked === true))}
                        className="h-5 w-5"
                      />
                      {refeicao === "almoco" ? "Almoço" : "Janta"}
                    </Label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FloatingInput id="pedagio" label="Pedágio (R$)" inputMode="decimal" value={form.pedagio} onChange={(event) => { if (isDecimalBRInput(event.target.value)) set("pedagio", event.target.value); }} />
                <FloatingInput id="outras-despesas" label="Outras despesas (R$)" inputMode="decimal" value={form.outras_despesas} onChange={(event) => { if (isDecimalBRInput(event.target.value)) set("outras_despesas", event.target.value); }} />
              </div>
              <FloatingInput id="outras-despesas-descricao" label="Descrição (opcional)" value={form.outras_despesas_descricao} onChange={(event) => set("outras_despesas_descricao", event.target.value)} />
            </div>
          </section>

          <Section title="Peças utilizadas" hint={pecasSelecionadas.length ? `${pecasSelecionadas.length} item(ns)` : "opcional"}>
            <PartPicker catalog={pecas} selectedId={pecaId} onSelectedIdChange={setPecaId} items={pecasSelecionadas} onItemsChange={setPecasSelecionadas} emptyText="Nenhuma peça vinculada a este apontamento." />
          </Section>

          <section>
            <SectionTitle title="Observações" filled={Boolean(form.observacoes.trim())} hint="opcional" />
            <div className="ios-group p-4">
              <FloatingTextarea label="Observações" value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={4} />
            </div>
          </section>

          <section>
            <SectionTitle title="Resumo" />
            <div className="ios-group grid grid-cols-3 gap-2 p-3 text-center">
              <div><p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">Trabalho</p><p className="mt-1 text-lg font-semibold tabular-nums">{formatMinutes(totais.trabalho)}</p></div>
              <div><p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">Viagem</p><p className="mt-1 text-lg font-semibold tabular-nums">{formatMinutes(totais.viagem)}</p></div>
              <div><p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">KM</p><p className="mt-1 text-lg font-semibold tabular-nums">{totais.km}</p><p className="text-[0.65rem] text-muted-foreground tabular-nums">{formatCurrency(retornoKm)}</p></div>
            </div>
          </section>

          {apontamento ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="h-12 w-full rounded-2xl text-destructive" disabled={excluir.isPending}>
                  Excluir apontamento
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="mx-4 w-[calc(100%-2rem)] max-w-sm rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir este apontamento?</AlertDialogTitle>
                  <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => excluir.mutate()}>
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}

          <div className={footerClass}>
            {!validation.success ? <Warning>{validation.error.issues[0]?.message}</Warning> : null}
            {!podeSalvar && validation.success ? <p className="text-center text-xs text-muted-foreground">Confira o atendimento na etapa 1 e as quantidades das peças.</p> : null}
            <Button className="h-14 w-full rounded-2xl text-base font-semibold" disabled={!podeSalvar || salvar.isPending} onClick={() => salvar.mutate()}>
              {apontamento ? "Salvar alterações" : "Salvar apontamento"}
            </Button>
          </div>
        </>
      )}

      <ParecidoSheet open={parecidoOpen} onOpenChange={setParecidoOpen} apontamentos={apontamentos} initialId={parecidoInitial} onApply={aplicarParecido} />
    </div>
  );
}
