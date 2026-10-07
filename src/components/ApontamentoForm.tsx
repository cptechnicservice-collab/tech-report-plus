import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FloatingInput, FloatingTextarea } from "@/components/FloatingField";
import { PartPicker, type SelectedPart } from "@/components/PartPicker";
import { TimeWheelField } from "@/components/TimeWheelField";
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
  diaria_tipo: "nenhuma" | "meia" | "inteira";
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

function OptionalSection({
  title,
  initiallyOpen,
  hasValue,
  onClear,
  children,
}: {
  title: string;
  initiallyOpen: boolean;
  hasValue: boolean;
  onClear: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <section className="ios-group">
      <div className="flex min-h-14 items-center gap-2 px-4">
        <Button
          type="button"
          variant="ghost"
          className="h-14 min-w-0 flex-1 justify-start rounded-none px-0 text-sm font-semibold"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          <span className="truncate">{title}</span>
          {!open && hasValue ? <span className="ml-auto text-xs font-normal text-primary">Preenchido</span> : null}
          {!open && !hasValue ? <span className="ml-auto text-xs font-normal text-muted-foreground">Opcional</span> : null}
        </Button>
        {open && hasValue ? (
          <Button type="button" variant="ghost" className="h-10 rounded-lg px-2 text-xs text-muted-foreground" onClick={onClear}>
            Limpar
          </Button>
        ) : null}
      </div>
      {open ? <div className="border-t border-border px-4 pb-4 pt-4">{children}</div> : null}
    </section>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs font-medium text-destructive">{children}</p>;
}

function errorReason(error: unknown) {
  if (error instanceof Error && error.message) return `: ${error.message}`;
  if (error && typeof error === "object" && "message" in error) return `: ${String(error.message)}`;
  return "";
}

export function ApontamentoForm({ apontamento, draft }: { apontamento?: Apontamento; draft?: ApontamentoDraft }) {
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
    const n = (v: string) => (v.trim() ? Number(v.replace(",", ".")) : null);
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

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-brand-header px-1 py-4 text-brand-header-foreground shadow-card">
            <p className="text-[0.65rem] font-semibold text-brand-header-foreground/60">
            Trabalho
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatMinutes(totais.trabalho)}</p>
        </div>
        <div className="ios-group px-1 py-4">
          <p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">
            Viagem
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatMinutes(totais.viagem)}</p>
          <p className="mt-1 text-[0.65rem] text-muted-foreground tabular-nums">
            Retorno KM {formatCurrency(retornoKm)}
          </p>
        </div>
        <div className="ios-group px-1 py-4">
          <p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">
            KM
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{totais.km}</p>
        </div>
      </section>

      <Section title="Identificação">
        <FloatingInput
            id="data"
            label="Data"
            type="date"
            value={form.data}
            onChange={(e) => set("data", e.target.value)}
          />
        <ClienteSelect
          clientes={clientes}
          value={form.cliente_id}
          onChange={(id) => set("cliente_id", id)}
          recentIds={recentIds}
        />
        <FloatingInput
            id="maquina"
            label="Máquina / Serviço (opcional)"
            value={form.maquina_servico}
            onChange={(e) => set("maquina_servico", e.target.value)}
          />
      </Section>

      <OptionalSection
        title="Viagem ida"
        initiallyOpen={Boolean(form.viagem_ida_saida || form.viagem_ida_chegada)}
        hasValue={Boolean(form.viagem_ida_saida || form.viagem_ida_chegada)}
        onClear={() => setForm((prev) => ({ ...prev, viagem_ida_saida: "", viagem_ida_chegada: "" }))}
      >
        <div className="grid grid-cols-2 gap-3">
          <TimeWheelField
            label="Saída"
            value={form.viagem_ida_saida}
            onChange={(v) => set("viagem_ida_saida", v)}
          />
          <TimeWheelField
            label="Chegada"
            value={form.viagem_ida_chegada}
            onChange={(v) => set("viagem_ida_chegada", v)}
          />
        </div>
        {validacoes.viagemIdaIncompleta ? <Warning>Preencha início e fim</Warning> : null}
        {validacoes.viagemIdaDiaSeguinte ? <Warning>Termina no dia seguinte? Total: {formatMinutes(diffMinutes(payload.viagem_ida_saida, payload.viagem_ida_chegada))}</Warning> : null}
      </OptionalSection>

      <Section title="Trabalho (opcional)">
        <div className="grid grid-cols-2 gap-3">
          <TimeWheelField
            label="Início"
            value={form.trabalho_inicio}
            onChange={(v) => set("trabalho_inicio", v)}
          />
          <TimeWheelField label="Fim" value={form.trabalho_fim} onChange={(v) => set("trabalho_fim", v)} />
        </div>
        {validacoes.trabalhoIncompleto ? <Warning>Preencha início e fim</Warning> : null}
        {validacoes.trabalhoHorariosIguais ? <Warning>O fim do trabalho deve ser diferente do início.</Warning> : null}
        {validacoes.trabalhoDiaSeguinte ? <Warning>Termina no dia seguinte? Total: {formatMinutes(totais.trabalho)}</Warning> : null}
        {validacoes.jornadaLonga ? <Warning>Jornada acima de 16h. Confira os horários.</Warning> : null}
      </Section>

      <OptionalSection
        title="Intervalo"
        initiallyOpen={Boolean(form.intervalo_inicio || form.intervalo_fim)}
        hasValue={Boolean(form.intervalo_inicio || form.intervalo_fim)}
        onClear={() => setForm((prev) => ({ ...prev, intervalo_inicio: "", intervalo_fim: "" }))}
      >
        <div className="grid grid-cols-2 gap-3">
          <TimeWheelField label="Início" value={form.intervalo_inicio} onChange={(v) => set("intervalo_inicio", v)} />
          <TimeWheelField label="Fim" value={form.intervalo_fim} onChange={(v) => set("intervalo_fim", v)} />
        </div>
        {validacoes.intervaloIncompleto ? <Warning>Preencha início e fim</Warning> : null}
        {validacoes.intervaloInvalido ? <Warning>Intervalo fora da jornada ou maior que o trabalho. Não será descontado.</Warning> : null}
      </OptionalSection>

      <OptionalSection
        title="Viagem retorno"
        initiallyOpen={Boolean(form.viagem_volta_saida || form.viagem_volta_chegada)}
        hasValue={Boolean(form.viagem_volta_saida || form.viagem_volta_chegada)}
        onClear={() => setForm((prev) => ({ ...prev, viagem_volta_saida: "", viagem_volta_chegada: "" }))}
      >
        <div className="grid grid-cols-2 gap-3">
          <TimeWheelField
            label="Saída"
            value={form.viagem_volta_saida}
            onChange={(v) => set("viagem_volta_saida", v)}
          />
          <TimeWheelField
            label="Chegada"
            value={form.viagem_volta_chegada}
            onChange={(v) => set("viagem_volta_chegada", v)}
          />
        </div>
        {validacoes.viagemVoltaIncompleta ? <Warning>Preencha início e fim</Warning> : null}
        {validacoes.viagemVoltaDiaSeguinte ? <Warning>Termina no dia seguinte? Total: {formatMinutes(diffMinutes(payload.viagem_volta_saida, payload.viagem_volta_chegada))}</Warning> : null}
      </OptionalSection>

      <OptionalSection
        title="Quilometragem"
        initiallyOpen={Boolean(form.km_ida || form.km_volta)}
        hasValue={Boolean(form.km_ida || form.km_volta)}
        onClear={() => setForm((prev) => ({ ...prev, km_ida: "", km_volta: "" }))}
      >
        <div className="grid grid-cols-2 gap-3">
          <FloatingInput
              id="km-ida"
              label="KM total ida"
              inputMode="decimal"
              value={form.km_ida}
              onChange={(event) => set("km_ida", event.target.value)}
            />
          <FloatingInput
              id="km-volta"
              label="KM total volta"
              inputMode="decimal"
              value={form.km_volta}
              onChange={(event) => set("km_volta", event.target.value)}
            />
        </div>
      </OptionalSection>

      <Section title="Despesas">
        <div className="space-y-1.5">
          <Label htmlFor="diaria">Diária</Label>
          <select
            id="diaria"
            value={form.diaria_tipo}
            onChange={(event) => set("diaria_tipo", event.target.value as FormState["diaria_tipo"])}
            className="ios-field h-12 w-full border px-3"
          >
            <option value="nenhuma">Nenhuma</option>
            <option value="meia">Meia diária</option>
            <option value="inteira">Diária inteira</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FloatingInput id="pedagio" label="Pedágio (R$)" inputMode="decimal" value={form.pedagio} onChange={(event) => set("pedagio", event.target.value)} />
          <FloatingInput id="outras-despesas" label="Outras despesas (R$)" inputMode="decimal" value={form.outras_despesas} onChange={(event) => set("outras_despesas", event.target.value)} />
        </div>
        <FloatingInput id="outras-despesas-descricao" label="Descrição (opcional)" value={form.outras_despesas_descricao} onChange={(event) => set("outras_despesas_descricao", event.target.value)} />
      </Section>

      <Section title="Peças utilizadas" hint={pecasSelecionadas.length ? `${pecasSelecionadas.length} item(ns)` : "opcional"}>
        <PartPicker catalog={pecas} selectedId={pecaId} onSelectedIdChange={setPecaId} items={pecasSelecionadas} onItemsChange={setPecasSelecionadas} emptyText="Nenhuma peça vinculada a este apontamento." />
      </Section>

      <Section title="Observações" hint="opcional">
        <FloatingTextarea
          label="Observações"
          value={form.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          rows={4}
        />
      </Section>

      <div className="space-y-2">
        {!validation.success ? <Warning>{validation.error.issues[0]?.message}</Warning> : null}
        <Button
          className="h-14 w-full rounded-2xl text-base font-semibold"
          disabled={!podeSalvar || salvar.isPending}
          onClick={() => salvar.mutate()}
        >
          {apontamento ? "Salvar alterações" : "Salvar apontamento"}
        </Button>
        {!podeSalvar ? (
          <p className="text-center text-xs text-muted-foreground">
            Informe data e cliente. Se preencher trabalho, informe início e fim.
          </p>
        ) : null}
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
      </div>
    </div>
  );
}
