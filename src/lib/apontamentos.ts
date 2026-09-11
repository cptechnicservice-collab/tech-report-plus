import { supabase } from "@/integrations/supabase/client";
import { offlineCacheKeys, readCached, writeCached } from "@/lib/offline";
import type { ValorVigencia } from "@/lib/financeiro";

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
  km_total: number | null;
  observacoes: string | null;
  diaria_tipo: string;
  pedagio: number | null;
  outras_despesas: number | null;
  outras_despesas_descricao: string | null;
  sync_status: string;
  synced_at: string | null;
  external_row_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ApontamentoComCliente = Apontamento & { clientes: Cliente | null };

/** minutos desde 00:00 para "HH:MM" ou "HH:MM:SS" */
export function toMinutes(value?: string | null): number | null {
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

export type ValidacoesApontamento = {
  trabalhoIncompleto: boolean;
  viagemIdaIncompleta: boolean;
  intervaloIncompleto: boolean;
  viagemVoltaIncompleta: boolean;
  trabalhoDiaSeguinte: boolean;
  viagemIdaDiaSeguinte: boolean;
  viagemVoltaDiaSeguinte: boolean;
  intervaloInvalido: boolean;
  kmInvalido: boolean;
  jornadaLonga: boolean;
};

const pairIncomplete = (start?: string | null, end?: string | null) => Boolean(start) !== Boolean(end);

export function validarApontamento(a: Partial<Apontamento>): ValidacoesApontamento {
  const trabalhoBruto = diffMinutes(a.trabalho_inicio, a.trabalho_fim);
  const trabalhoInicio = toMinutes(a.trabalho_inicio);
  const trabalhoFimBase = toMinutes(a.trabalho_fim);
  const intervaloInicioBase = toMinutes(a.intervalo_inicio);
  const intervaloFimBase = toMinutes(a.intervalo_fim);
  let intervaloInvalido = false;
  if (
    trabalhoInicio !== null &&
    trabalhoFimBase !== null &&
    intervaloInicioBase !== null &&
    intervaloFimBase !== null
  ) {
    const trabalhoFim = trabalhoFimBase < trabalhoInicio ? trabalhoFimBase + 1440 : trabalhoFimBase;
    const intervaloInicio =
      intervaloInicioBase < trabalhoInicio ? intervaloInicioBase + 1440 : intervaloInicioBase;
    let intervaloFim = intervaloFimBase < trabalhoInicio ? intervaloFimBase + 1440 : intervaloFimBase;
    if (intervaloFim < intervaloInicio) intervaloFim += 1440;
    intervaloInvalido =
      intervaloInicio < trabalhoInicio ||
      intervaloFim > trabalhoFim ||
      intervaloFim - intervaloInicio > trabalhoBruto;
  }

  const kmInicial = a.km_inicial ?? null;
  const kmFinal = a.km_final ?? null;
  return {
    trabalhoIncompleto: pairIncomplete(a.trabalho_inicio, a.trabalho_fim),
    viagemIdaIncompleta: pairIncomplete(a.viagem_ida_saida, a.viagem_ida_chegada),
    intervaloIncompleto: pairIncomplete(a.intervalo_inicio, a.intervalo_fim),
    viagemVoltaIncompleta: pairIncomplete(a.viagem_volta_saida, a.viagem_volta_chegada),
    trabalhoDiaSeguinte: trabalhoInicio !== null && trabalhoFimBase !== null && trabalhoFimBase < trabalhoInicio,
    viagemIdaDiaSeguinte:
      (toMinutes(a.viagem_ida_saida) ?? -1) > (toMinutes(a.viagem_ida_chegada) ?? Number.MAX_SAFE_INTEGER),
    viagemVoltaDiaSeguinte:
      (toMinutes(a.viagem_volta_saida) ?? -1) >
      (toMinutes(a.viagem_volta_chegada) ?? Number.MAX_SAFE_INTEGER),
    intervaloInvalido,
    kmInvalido:
      a.km_total == null && kmInicial !== null && kmFinal !== null && kmFinal < kmInicial,
    jornadaLonga: trabalhoBruto > 16 * 60,
  };
}

export function calcularTotais(a: Partial<Apontamento>): Totais {
  const intervalo = diffMinutes(a.intervalo_inicio, a.intervalo_fim);
  const bruto = diffMinutes(a.trabalho_inicio, a.trabalho_fim);
  const validacoes = validarApontamento(a);
  const desconto = validacoes.intervaloIncompleto || validacoes.intervaloInvalido ? 0 : intervalo;
  const trabalho = bruto > 0 ? Math.max(0, bruto - desconto) : 0;
  const viagem =
    diffMinutes(a.viagem_ida_saida, a.viagem_ida_chegada) +
    diffMinutes(a.viagem_volta_saida, a.viagem_volta_chegada);
  const kmI = a.km_inicial ?? null;
  const kmF = a.km_final ?? null;
  const kmDireto = a.km_total ?? null;
  const km = kmDireto !== null && kmDireto >= 0
    ? kmDireto
    : kmI !== null && kmF !== null && kmF >= kmI
      ? kmF - kmI
      : 0;
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
  if (error) {
    const cached = await readCached<Cliente[]>(offlineCacheKeys.clientes);
    if (cached) return cached.sort((a, b) => a.nome.localeCompare(b.nome));
    throw error;
  }
  const result = (data ?? []) as Cliente[];
  await writeCached(offlineCacheKeys.clientes, result);
  return result;
}

export async function fetchApontamentos(): Promise<ApontamentoComCliente[]> {
  const { data, error } = await supabase
    .from("apontamentos")
    .select("*, clientes(*)")
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    const cached = await readCached<ApontamentoComCliente[]>(offlineCacheKeys.apontamentos);
    if (cached) return cached;
    throw error;
  }
  const result = (data ?? []) as unknown as ApontamentoComCliente[];
  await writeCached(offlineCacheKeys.apontamentos, result);
  return result;
}

export async function fetchApontamento(id: string): Promise<ApontamentoComCliente> {
  const { data, error } = await supabase
    .from("apontamentos")
    .select("*, clientes(*)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    const cached = await readCached<ApontamentoComCliente[]>(offlineCacheKeys.apontamentos);
    const item = cached?.find((apontamento) => apontamento.id === id);
    if (item) return item;
    if (error) throw error;
    throw new Error("Apontamento não encontrado");
  }
  return data as unknown as ApontamentoComCliente;
}

export async function fetchValores(): Promise<ValorVigencia[]> {
  const { data, error } = await supabase
    .from("valores_vigencia")
    .select("*")
    .order("vigencia", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    const cached = await readCached<ValorVigencia[]>(offlineCacheKeys.valores);
    if (cached) return cached;
    throw error;
  }
  const result = (data ?? []) as ValorVigencia[];
  await writeCached(offlineCacheKeys.valores, result);
  return result;
}
