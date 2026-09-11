import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, X } from "lucide-react";
import { toast } from "sonner";

import { Section } from "@/components/PageShell";
import { ClienteSelect } from "@/components/ClienteSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  calcularTotais,
  fetchApontamentos,
  fetchClientes,
  formatMinutes,
  normalizeTime,
  todayISO,
  type Apontamento,
} from "@/lib/apontamentos";

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
  km_inicial: string;
  km_final: string;
  observacoes: string;
};

function initialState(a?: Apontamento): FormState {
  return {
    data: a?.data ?? todayISO(),
    cliente_id: a?.cliente_id ?? null,
    maquina_servico: a?.maquina_servico ?? "",
    viagem_ida_saida: normalizeTime(a?.viagem_ida_saida),
    viagem_ida_chegada: normalizeTime(a?.viagem_ida_chegada),
    trabalho_inicio: normalizeTime(a?.trabalho_inicio),
    trabalho_fim: normalizeTime(a?.trabalho_fim),
    intervalo_inicio: normalizeTime(a?.intervalo_inicio),
    intervalo_fim: normalizeTime(a?.intervalo_fim),
    viagem_volta_saida: normalizeTime(a?.viagem_volta_saida),
    viagem_volta_chegada: normalizeTime(a?.viagem_volta_chegada),
    km_inicial: a?.km_inicial != null ? String(a.km_inicial) : "",
    km_final: a?.km_final != null ? String(a.km_final) : "",
    observacoes: a?.observacoes ?? "",
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
          className="h-12 w-full justify-start rounded-xl px-3 text-base font-normal tabular-nums"
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
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-lg">
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
    <section className="card-surface overflow-hidden">
      <div className="flex min-h-14 items-center gap-2 px-4">
        <Button
          type="button"
          variant="ghost"
          className="h-11 min-w-0 flex-1 justify-start rounded-xl px-0 text-sm font-semibold"
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
      {open ? <div className="border-t border-border px-4 pb-4 pt-3">{children}</div> : null}
    </section>
  );
}

export function ApontamentoForm({ apontamento }: { apontamento?: Apontamento }) {
  const [form, setForm] = useState<FormState>(() => initialState(apontamento));
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: fetchClientes });
  const { data: apontamentos = [] } = useQuery({
    queryKey: ["apontamentos"],
    queryFn: fetchApontamentos,
  });

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
      km_inicial: n(form.km_inicial),
      km_final: n(form.km_final),
      observacoes: form.observacoes.trim() || null,
    };
  }, [form]);

  const totais = useMemo(() => calcularTotais(payload), [payload]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (apontamento) {
        const { error } = await supabase
          .from("apontamentos")
          .update(payload)
          .eq("id", apontamento.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("apontamentos").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apontamentos"] });
      toast.success(apontamento ? "Apontamento atualizado" : "Apontamento salvo");
      navigate({ to: "/historico" });
    },
    onError: () => toast.error("Não foi possível salvar"),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      if (!apontamento) return;
      const { error } = await supabase.from("apontamentos").delete().eq("id", apontamento.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apontamentos"] });
      toast.success("Apontamento excluído");
      navigate({ to: "/historico" });
    },
    onError: () => toast.error("Não foi possível excluir"),
  });

  const podeSalvar = Boolean(form.cliente_id && form.data && form.trabalho_inicio && form.trabalho_fim);

  return (
    <div className="space-y-4">
      <section className="card-surface grid grid-cols-3 divide-x divide-border p-4 text-center">
        <div className="px-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Trabalho
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatMinutes(totais.trabalho)}</p>
        </div>
        <div className="px-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Viagem
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatMinutes(totais.viagem)}</p>
        </div>
        <div className="px-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
            KM
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{totais.km}</p>
        </div>
      </section>

      <Section title="Identificação">
        <div className="space-y-1.5">
          <Label htmlFor="data">Data</Label>
          <Input
            id="data"
            type="date"
            value={form.data}
            onChange={(e) => set("data", e.target.value)}
            className="h-12 rounded-xl"
          />
        </div>
        <ClienteSelect
          clientes={clientes}
          value={form.cliente_id}
          onChange={(id) => set("cliente_id", id)}
          recentIds={recentIds}
        />
        <div className="space-y-1.5">
          <Label htmlFor="maquina">Máquina / Serviço (opcional)</Label>
          <Input
            id="maquina"
            value={form.maquina_servico}
            onChange={(e) => set("maquina_servico", e.target.value)}
            className="h-12 rounded-xl"
            placeholder="Ex.: Serra fita 600 — manutenção"
          />
        </div>
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
      </OptionalSection>

      <Section title="Trabalho">
        <div className="grid grid-cols-2 gap-3">
          <TimeField
            label="Início"
            value={form.trabalho_inicio}
            onChange={(v) => set("trabalho_inicio", v)}
          />
          <TimeField label="Fim" value={form.trabalho_fim} onChange={(v) => set("trabalho_fim", v)} />
        </div>
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
      </OptionalSection>

      <OptionalSection
        title="Quilometragem"
        initiallyOpen={Boolean(form.km_inicial || form.km_final)}
        hasValue={Boolean(form.km_inicial || form.km_final)}
        onClear={() => setForm((prev) => ({ ...prev, km_inicial: "", km_final: "" }))}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs text-muted-foreground">KM inicial</Label>
            <Input
              inputMode="decimal"
              value={form.km_inicial}
              onChange={(e) => set("km_inicial", e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs text-muted-foreground">KM final</Label>
            <Input
              inputMode="decimal"
              value={form.km_final}
              onChange={(e) => set("km_final", e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
        </div>
      </OptionalSection>

      <Section title="Observações" hint="opcional">
        <Textarea
          value={form.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          rows={4}
          className="rounded-xl"
          placeholder="Peças usadas, pendências, contatos no local..."
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
            Informe data, cliente e os horários de início e fim do trabalho.
          </p>
        ) : null}
        {apontamento ? (
          <Button
            variant="ghost"
            className="h-12 w-full rounded-2xl text-destructive"
            disabled={excluir.isPending}
            onClick={() => excluir.mutate()}
          >
            Excluir apontamento
          </Button>
        ) : null}
      </div>
    </div>
  );
}
