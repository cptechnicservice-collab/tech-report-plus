import { supabase } from "@/integrations/supabase/client";
import { offlineCacheKeys, readCached, writeCached } from "@/lib/offline";

export type Peca = {
  id: string;
  user_id: string;
  descricao: string;
  codigo: string | null;
  unidade: string;
  preco: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchPecas(): Promise<Peca[]> {
  try {
    const { data, error } = await supabase
      .from("pecas")
      .select("*")
      .order("descricao", { ascending: true })
      .abortSignal(AbortSignal.timeout(10_000));
    if (error) throw error;
    const pecas = (data ?? []) as Peca[];
    await writeCached(offlineCacheKeys.pecas, pecas);
    return pecas;
  } catch (error) {
    const cached = await readCached<Peca[]>(offlineCacheKeys.pecas);
    if (cached) return cached;
    throw error;
  }
}