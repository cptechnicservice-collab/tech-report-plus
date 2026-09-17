import { supabase } from "@/integrations/supabase/client";
import { offlineCacheKeys, readCached, saveEmpresaOffline, writeCached } from "@/lib/offline";

export type DadosEmpresa = {
  id: string;
  user_id: string;
  nome_fantasia: string;
  cnpj: string;
  email: string;
  contato: string;
  telefone: string | null;
  logo_data_url: string | null;
  created_at: string;
  updated_at: string;
};

export const empresaPadrao = {
  nome_fantasia: "CP-Technic HOMAG",
  cnpj: "46.696.388/0001-08",
  email: "clarelcapavan@gmail.com",
  contato: "Clarel Pavan",
  telefone: null,
  logo_data_url: null,
};

export async function fetchEmpresa(): Promise<DadosEmpresa | null> {
  try {
    const { data, error } = await supabase.from("dados_empresa").select("*").maybeSingle();
    if (error) throw error;
    if (data) await writeCached(offlineCacheKeys.empresa, data);
    return data as DadosEmpresa | null;
  } catch (error) {
    const cached = await readCached<DadosEmpresa>(offlineCacheKeys.empresa);
    if (cached) return cached;
    throw error;
  }
}

export async function ensureEmpresa(): Promise<DadosEmpresa> {
  const current = await fetchEmpresa();
  if (current) return current;
  return (await saveEmpresaOffline({ id: crypto.randomUUID(), ...empresaPadrao })).record;
}