import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-xl"
      />
    </div>
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

      <Section title="Viagem ida" hint="opcional">
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
      </Section>

      <Section title="Trabalho">
        <div className="grid grid-cols-2 gap-3">
          <TimeField
            label="Início"
            value={form.trabalho_inicio}
            onChange={(v) => set("trabalho_inicio", v)}
          />
          <TimeField label="Fim" value={form.trabalho_fim} onChange={(v) => set("trabalho_fim", v)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TimeField
            label="Intervalo início"
            value={form.intervalo_inicio}
            onChange={(v) => set("intervalo_inicio", v)}
          />
          <TimeField
            label="Intervalo fim"
            value={form.intervalo_fim}
            onChange={(v) => set("intervalo_fim", v)}
          />
        </div>
      </Section>

      <Section title="Viagem retorno" hint="opcional">
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
      </Section>

      <Section title="Quilometragem" hint="opcional">
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
      </Section>

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
