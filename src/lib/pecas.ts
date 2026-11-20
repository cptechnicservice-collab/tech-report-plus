import { supabase } from "@/integrations/supabase/client";
import { offlineCacheKeys, readCached, writeCached } from "@/lib/offline";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { cacheCompleteRecord, measureList, mergeListCache } from "@/lib/list-cache";
import { isRecordPending } from "@/lib/offline.queue";

export type Peca = {
  id: string;
  user_id: string;
  descricao: string;
  codigo: string | null;
  unidade: string;
  preco: number;
  observacoes: string | null;
  foto_data_url: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchPecas(): Promise<Peca[]> {
  const start = performance.now();
  try {
    const pecas = await fetchAllPages(() => supabase
      .from("pecas")
      .select("id,user_id,descricao,codigo,unidade,preco,observacoes,created_at,updated_at")
      .order("descricao", { ascending: true })
      .order("id", { ascending: true })
      .abortSignal(AbortSignal.timeout(10_000)));
    measureList("pecas", pecas, start);
    const rows = await mergeListCache(offlineCacheKeys.pecas, "pecas", pecas);
    return rows.map((row) => ({ ...row, foto_data_url: null }));
  } catch (error) {
    const cached = await readCached<Peca[]>(offlineCacheKeys.pecas);
    if (cached) return cached;
    throw error;
  }
}

export async function fetchPeca(id: string): Promise<Peca> {
  const cached = (await readCached<Peca[]>(offlineCacheKeys.pecas))?.find((item) => item.id === id);
  if (cached && await isRecordPending("pecas", id)) return cached;
  try {
    const { data, error } = await supabase.from("pecas").select("*").eq("id", id).single();
    if (error) throw error;
    await cacheCompleteRecord(offlineCacheKeys.pecas, data);
    return data;
  } catch (error) {
    if (cached && "foto_data_url" in cached) return cached;
    throw error;
  }
}