import { supabase } from "@/integrations/supabase/client";

export type Cliente = {
  id: string;
  nome: string;
  cidade: string | null;
  cnpj: string | null;
  contato: string | null;
  telefone: string | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type Apontamento = {
  id: string;
  data: string;
  cliente_id: string;
  maquina_servico: string | null;
  viagem_ida_saida: string | null;
  viagem_ida_chegada: string | null;
  trabalho_inicio: string | null;
  trabalho_fim: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  viagem_volta_saida: string | null;
  viagem_volta_chegada: string | null;
  km_inicial: number | null;
  km_final: number | null;
  observacoes: string | null;
  sync_status: string;
  synced_at: string | null;
  external_row_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ApontamentoComCliente = Apontamento & { clientes: Cliente | null };

/** minutos desde 00:00 para "HH:MM" ou "HH:MM:SS" */
function toMinutes(value?: string | null): number | null {
  if (!value) return null;
  const [h, m] = value.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

/** diferença em minutos, tratando virada de meia-noite */
export function diffMinutes(start?: string | null, end?: string | null): number {
  const a = toMinutes(start);
  const b = toMinutes(end);
  if (a === null || b === null) return 0;
  return b >= a ? b - a : b + 24 * 60 - a;
}

export function formatMinutes(total: number): string {
  const safe = Math.max(0, Math.round(total));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function normalizeTime(value?: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

export type Totais = { trabalho: number; viagem: number; km: number };

export function calcularTotais(a: Partial<Apontamento>): Totais {
  const intervalo = diffMinutes(a.intervalo_inicio, a.intervalo_fim);
  const bruto = diffMinutes(a.trabalho_inicio, a.trabalho_fim);
  const trabalho = bruto > 0 ? Math.max(0, bruto - intervalo) : 0;
  const viagem =
    diffMinutes(a.viagem_ida_saida, a.viagem_ida_chegada) +
    diffMinutes(a.viagem_volta_saida, a.viagem_volta_chegada);
  const kmI = a.km_inicial ?? null;
  const kmF = a.km_final ?? null;
  const km = kmI !== null && kmF !== null && kmF >= kmI ? kmF - kmI : 0;
  return { trabalho, viagem, km };
}

export function somarTotais(lista: Partial<Apontamento>[]): Totais {
  return lista.reduce<Totais>(
    (acc, item) => {
      const t = calcularTotais(item);
      return {
        trabalho: acc.trabalho + t.trabalho,
        viagem: acc.viagem + t.viagem,
        km: acc.km + t.km,
      };
    },
    { trabalho: 0, viagem: 0, km: 0 },
  );
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/* ---------- queries ---------- */

export async function fetchClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Cliente[];
}

export async function fetchApontamentos(): Promise<ApontamentoComCliente[]> {
  const { data, error } = await supabase
    .from("apontamentos")
    .select("*, clientes(*)")
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ApontamentoComCliente[];
}

export async function fetchApontamento(id: string): Promise<ApontamentoComCliente> {
  const { data, error } = await supabase
    .from("apontamentos")
    .select("*, clientes(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Apontamento não encontrado");
  return data as unknown as ApontamentoComCliente;
}
