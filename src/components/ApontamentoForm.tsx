import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { FloatingInput, FloatingTextarea } from "@/components/FloatingField";
import { PartPicker, type SelectedPart } from "@/components/PartPicker";
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
import { deleteApontamentoOffline, saveApontamentoOffline, saveApontamentoPecasOffline } from "@/lib/offline";

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

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftHour, setDraftHour] = useState("");
  const [draftMinute, setDraftMinute] = useState("");

  const showPicker = () => {
    const [hour = "", minute = ""] = value.split(":");
    setDraftHour(hour);
    setDraftMinute(minute);
    setOpen(true);
  };

  const confirm = () => {
    if (!draftHour || !draftMinute) return;
    onChange(`${draftHour}:${draftMinute}`);
    setOpen(false);
  };

  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full justify-start rounded-xl border-input bg-card px-3 text-base font-normal tabular-nums"
          aria-label={`${label}: ${value || "vazio"}`}
          onClick={showPicker}
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value || "--:--"}
          </span>
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 h-10 w-10 rounded-lg text-muted-foreground"
            aria-label={`Limpar ${label.toLowerCase()}`}
            onClick={(event) => {
              event.stopPropagation();
              onChange("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/25 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={`Selecionar ${label.toLowerCase()}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold">{label}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full"
                aria-label="Cancelar seleção de horário"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <select
                aria-label="Hora"
                value={draftHour}
                onChange={(event) => setDraftHour(event.target.value)}
                className="h-14 rounded-xl border border-input bg-background px-3 text-center text-lg tabular-nums"
              >
                <option value="">Hora</option>
                {Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0")).map(
                  (hour) => <option key={hour} value={hour}>{hour}</option>,
                )}
              </select>
              <span className="text-xl font-semibold">:</span>
              <select
                aria-label="Minuto"
                value={draftMinute}
                onChange={(event) => setDraftMinute(event.target.value)}
                className="h-14 rounded-xl border border-input bg-background px-3 text-center text-lg tabular-nums"
              >
                <option value="">Min</option>
                {Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0")).map(
                  (minute) => <option key={minute} value={minute}>{minute}</option>,
                )}
              </select>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" variant="ghost" className="h-12 rounded-xl" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" className="h-12 rounded-xl" disabled={!draftHour || !draftMinute} onClick={confirm}>
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
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
  const { data: apontamentoPecas = [] } = useQuery({ queryKey: ["apontamento-pecas"], queryFn: fetchApontamentoPecas });

  if (apontamento && !partsInitialized && apontamentoPecas.length > 0) {
    setPecasSelecionadas(apontamentoPecas.filter((item) => item.apontamento_id === apontamento.id).map((item) => ({
      id: item.id, peca_id: item.peca_id, descricao: item.descricao, codigo: item.codigo, unidade: item.unidade,
      preco: item.valor_unitario, foto_data_url: item.foto_data_url, quantidade: item.quantidade,
    })));
    setPartsInitialized(true);
  }

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
      km_inicial: null,
      km_final: null,
      km_total: null,
      km_ida: n(form.km_ida),
      km_volta: n(form.km_volta),
      observacoes: form.observacoes.trim() || null,
      diaria_tipo: form.diaria_tipo,
      pedagio: n(form.pedagio),
      outras_despesas: n(form.outras_despesas),
      outras_despesas_descricao: form.outras_despesas_descricao.trim() || null,
    };
  }, [form]);

  const totais = useMemo(() => calcularTotais(payload), [payload]);
  const validacoes = useMemo(() => validarApontamento(payload), [payload]);
  const valorAtual = useMemo(() => valorVigente(form.data, valores), [form.data, valores]);
  const retornoKm = totais.km * (valorAtual?.valor_km ?? 0);

  const salvar = useMutation({
    mutationFn: async () => {
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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["apontamentos"] });
      queryClient.invalidateQueries({ queryKey: ["apontamento-pecas"] });
      toast.success(
        result.queued
          ? "Salvo no aparelho — será enviado quando houver conexão"
          : apontamento
            ? "Apontamento atualizado"
            : "Apontamento salvo",
      );
      navigate({ to: "/historico" });
    },
    onError: (error) => toast.error(`Não foi possível salvar${errorReason(error)}`),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      if (!apontamento) return;
      return deleteApontamentoOffline(apontamento.id);
    },
    onSuccess: (result) => {
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
      pecasSelecionadas.every((part) => typeof part.quantidade === "number" && part.quantidade > 0),
  );

  return (
    <div className="space-y-4">
      <section className="ios-group grid grid-cols-3 divide-x divide-border py-4 text-center">
        <div className="px-1">
           <p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">
            Trabalho
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatMinutes(totais.trabalho)}</p>
        </div>
        <div className="px-1">
          <p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">
            Viagem
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatMinutes(totais.viagem)}</p>
          <p className="mt-1 text-[0.65rem] text-muted-foreground tabular-nums">
            Retorno KM {formatCurrency(retornoKm)}
          </p>
        </div>
        <div className="px-1">
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
          <TimeField
            label="Saída"
            value={form.viagem_ida_saida}
            onChange={(v) => set("viagem_ida_saida", v)}
          />
          <TimeField
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
          <TimeField
            label="Início"
            value={form.trabalho_inicio}
            onChange={(v) => set("trabalho_inicio", v)}
          />
          <TimeField label="Fim" value={form.trabalho_fim} onChange={(v) => set("trabalho_fim", v)} />
        </div>
        {validacoes.trabalhoIncompleto ? <Warning>Preencha início e fim</Warning> : null}
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
          <TimeField label="Início" value={form.intervalo_inicio} onChange={(v) => set("intervalo_inicio", v)} />
          <TimeField label="Fim" value={form.intervalo_fim} onChange={(v) => set("intervalo_fim", v)} />
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
          <TimeField
            label="Saída"
            value={form.viagem_volta_saida}
            onChange={(v) => set("viagem_volta_saida", v)}
          />
          <TimeField
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
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="km-ida" className="text-xs text-muted-foreground">KM total ida</Label>
            <Input
              id="km-ida"
              inputMode="decimal"
              value={form.km_ida}
              onChange={(event) => set("km_ida", event.target.value)}
              className="h-12 rounded-xl"
              placeholder="Ex.: 265"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="km-volta" className="text-xs text-muted-foreground">KM total volta</Label>
            <Input
              id="km-volta"
              inputMode="decimal"
              value={form.km_volta}
              onChange={(event) => set("km_volta", event.target.value)}
              className="h-12 rounded-xl"
              placeholder="Ex.: 265"
            />
          </div>
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
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="pedagio">Pedágio (R$)</Label>
            <Input id="pedagio" inputMode="decimal" placeholder="0,00" value={form.pedagio} onChange={(event) => set("pedagio", event.target.value)} />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="outras-despesas">Outras despesas (R$)</Label>
            <Input id="outras-despesas" inputMode="decimal" placeholder="0,00" value={form.outras_despesas} onChange={(event) => set("outras_despesas", event.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="outras-despesas-descricao">Descrição (opcional)</Label>
          <Input id="outras-despesas-descricao" value={form.outras_despesas_descricao} onChange={(event) => set("outras_despesas_descricao", event.target.value)} placeholder="Ex.: estacionamento" />
        </div>
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
