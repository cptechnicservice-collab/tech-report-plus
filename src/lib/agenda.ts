import { supabase } from "@/integrations/supabase/client";
import type { Cliente } from "@/lib/apontamentos";
import { offlineCacheKeys, readCached, writeCached } from "@/lib/offline";

export type Agendamento = {
  id: string;
  user_id: string;
  cliente_id: string;
  data: string;
  data_fim: string | null;
  horario: string | null;
  maquina_servico: string | null;
  observacoes: string | null;
  concluido: boolean;
  created_at: string;
  updated_at: string;
};

export type AgendamentoComCliente = Agendamento & { clientes: Cliente | null };

export async function fetchAgendamentos(): Promise<AgendamentoComCliente[]> {
  const { data, error } = await supabase
    .from("agendamentos")
    .select("*, clientes(*)")
    .order("data", { ascending: true })
    .order("horario", { ascending: true, nullsFirst: false });

  if (error) {
    const cached = await readCached<AgendamentoComCliente[]>(offlineCacheKeys.agendamentos);
    if (cached) return cached;
    throw error;
  }

  const result = (data ?? []) as unknown as AgendamentoComCliente[];
  await writeCached(offlineCacheKeys.agendamentos, result);
  return result;
}

export async function fetchAgendamento(id: string): Promise<AgendamentoComCliente> {
  const { data, error } = await supabase.from("agendamentos").select("*, clientes(*)").eq("id", id).maybeSingle();
  if (data) return data as unknown as AgendamentoComCliente;
  const cached = await readCached<AgendamentoComCliente[]>(offlineCacheKeys.agendamentos);
  const item = cached?.find((entry) => entry.id === id);
  if (item) return item;
  if (error) throw error;
  throw new Error("Agendamento não encontrado");
}