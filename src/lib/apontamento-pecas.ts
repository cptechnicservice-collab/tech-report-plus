import { supabase } from "@/integrations/supabase/client";
import { offlineCacheKeys, readCached, writeCached } from "@/lib/offline";

export type ApontamentoPeca = {
  id: string;
  user_id: string;
  apontamento_id: string;
  peca_id: string | null;
  descricao: string;
  codigo: string | null;
  unidade: string;
  valor_unitario: number;
  quantidade: number;
  foto_data_url: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchApontamentoPecas(): Promise<ApontamentoPeca[]> {
  const { data, error } = await supabase
    .from("apontamento_pecas")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    const cached = await readCached<ApontamentoPeca[]>(offlineCacheKeys.apontamentoPecas);
    if (cached) return cached;
    throw error;
  }

  const result = (data ?? []) as ApontamentoPeca[];
  await writeCached(offlineCacheKeys.apontamentoPecas, result);
  return result;
}