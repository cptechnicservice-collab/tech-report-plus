import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Package, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { Cliente } from "@/lib/apontamentos";
import { empresaPadrao, fetchEmpresa } from "@/lib/empresa";
import { enderecoIncompleto, linhasDestinatario, linhasRemetente, type EnderecoEtiqueta } from "@/lib/etiqueta";

type Props = {
  cliente: Cliente | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditCliente?: () => void;
};

export function EtiquetaButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button type="button" variant="outline" className={className ?? "h-11 rounded-xl"} onClick={onClick} aria-label="Etiqueta de envio">
      <Package className="mr-2 h-4 w-4" /> Etiqueta de envio
    </Button>
  );
}

export function EtiquetaSheet({ cliente, open, onOpenChange, onEditCliente }: Props) {
  const { data: empresa } = useQuery({ queryKey: ["dados-empresa"], queryFn: fetchEmpresa, enabled: open });
  const [copias, setCopias] = useState(1);
  const [file, setFile] = useState<File | null>(null);

  const dest: EnderecoEtiqueta = useMemo(() => ({ ...(cliente ?? {}), nome: cliente?.nome ?? "" }), [cliente]);
  const rem: EnderecoEtiqueta = useMemo(() => {
    const e = empresa ?? empresaPadrao;
    return { ...e, nome: e.nome_fantasia || e.contato };
  }, [empresa]);

  useEffect(() => {
    if (!open || !cliente) return;
    let active = true;
    setFile(null);
    void import("@/lib/pdf-etiqueta").then(async ({ buildEtiquetaPdf }) => {
      const doc = await buildEtiquetaPdf(dest, rem, copias);
      const nome = `etiqueta-${(cliente.nome || "cliente").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
      if (active) setFile(new File([doc.output("blob")], nome, { type: "application/pdf" }));
    }).catch(() => toast.error("Não foi possível preparar a etiqueta"));
    return () => { active = false; };
  }, [open, cliente, dest, rem, copias]);

  const imprimir = async () => {
    if (!file) return;
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Etiqueta de envio" }); return; }
      catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(file);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const incompleto = enderecoIncompleto(dest);
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="keyboard-panel">
        <DrawerHeader>
          <DrawerTitle>Etiqueta de envio</DrawerTitle>
          <DrawerDescription>Tamanho A6 (10 × 15 cm), uma por página.</DrawerDescription>
        </DrawerHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-4 pb-6">
          {incompleto ? (
            <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className="flex-1">
                <p className="font-semibold">Complete o endereço</p>
                <p className="text-muted-foreground">Faltam dados do cliente. Você pode imprimir assim mesmo.</p>
                {onEditCliente ? <Button variant="link" className="h-auto min-h-0 p-0" onClick={onEditCliente}>Editar cliente</Button> : null}
              </div>
            </div>
          ) : null}
          <div className="mx-auto aspect-[2/3] w-full max-w-[17rem] rounded-sm border border-foreground bg-card p-3 text-[11px] leading-snug text-foreground">
            <p className="text-center font-bold">DESTINATÁRIO</p>
            <p className="mt-1 break-words text-center text-base font-bold uppercase">{dest.nome}</p>
            <hr className="my-2 border-foreground" />
            {linhasDestinatario(dest).map((l) => (
              <p key={l.rotulo} className={l.destaque ? "text-sm font-bold" : ""}><b>{l.rotulo}</b> {l.valor}</p>
            ))}
            <hr className="my-2 border-foreground" />
            <p className="text-center font-bold">REMETENTE</p>
            <p className="font-bold uppercase">{rem.nome}</p>
            {linhasRemetente(rem).map((l) => <p key={l}>{l}</p>)}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Cópias</span>
            <div className="flex gap-1" role="group" aria-label="Quantidade de cópias">
              {[1, 2, 3, 4].map((n) => (
                <Button key={n} type="button" variant={copias === n ? "default" : "outline"} className="h-11 w-11 rounded-xl" aria-pressed={copias === n} onClick={() => setCopias(n)}>{n}</Button>
              ))}
            </div>
          </div>
          <Button className="h-14 w-full rounded-xl text-base font-semibold" disabled={!file} onClick={() => void imprimir()}>
            <Printer className="mr-2 h-5 w-5" /> {file ? "Imprimir / Compartilhar PDF" : "Preparando..."}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
