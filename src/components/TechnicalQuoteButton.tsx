import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { jsPDF } from "jspdf";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ValorVigencia } from "@/lib/financeiro";
import type { DadosEmpresa } from "@/lib/empresa";
import { offlineCacheKeys, readCached } from "@/lib/offline.cache";
import { createTechnicalQuotePdf, shareTechnicalQuotePdf } from "@/lib/pdf-technical-quote";

export function TechnicalQuoteButton() {
  const queryClient = useQueryClient();
  const [doc, setDoc] = useState<jsPDF | null>(null);
  const [error, setError] = useState(false);
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    let active = true;
    async function prepare() {
      try {
        const [cachedRates, empresa] = await Promise.all([
          readCached<ValorVigencia[]>(offlineCacheKeys.valores),
          readCached<DadosEmpresa>(offlineCacheKeys.empresa),
        ]);
        const pdf = await createTechnicalQuotePdf({
          valores: queryClient.getQueryData<ValorVigencia[]>(["valores"]) ?? cachedRates ?? [],
          logo: empresa?.logo_data_url,
        });
        if (active) setDoc(pdf);
      } catch { if (active) setError(true); }
    }
    void prepare();
    return () => { active = false; };
  }, [queryClient]);
  const share = async () => {
    if (!doc) { if (error) toast.error("Não foi possível preparar o PDF. Abra Orçamentos novamente."); return; }
    setSharing(true);
    try { await shareTechnicalQuotePdf(doc); }
    catch { toast.error("Não foi possível compartilhar o PDF."); }
    finally { setSharing(false); }
  };
  return <Button className="h-14 w-full rounded-xl text-base" disabled={(!doc && !error) || sharing} onClick={() => void share()} aria-busy={!doc && !error}><FileText className="mr-2 h-5 w-5" />Orçamento (PDF)</Button>;
}