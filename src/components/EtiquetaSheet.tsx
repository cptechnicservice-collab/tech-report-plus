import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Package, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { Cliente } from "@/lib/apontamentos";
import { empresaPadrao, fetchEmpresa } from "@/lib/empresa";
import {
  TAMANHOS,
  TAMANHO_PADRAO,
  enderecoIncompleto,
  linhasDestinatario,
  linhasRemetente,
  porFolha,
  remetenteSemEndereco,
  type EnderecoEtiqueta,
  type RemetenteEtiqueta,
  type TamanhoEtiqueta,
} from "@/lib/etiqueta";

const TAM_KEY = "etiqueta-tamanho";

type Props = {
  cliente: Cliente | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditCliente?: () => void;
};

export function EtiquetaButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className={className ?? "h-11 rounded-xl"}
      onClick={onClick}
      aria-label="Etiqueta de envio"
    >
      <Package className="mr-2 h-4 w-4" /> Etiqueta de envio
    </Button>
  );
}

export function EtiquetaSheet({ cliente, open, onOpenChange, onEditCliente }: Props) {
  const { data: empresa } = useQuery({
    queryKey: ["dados-empresa"],
    queryFn: fetchEmpresa,
    enabled: open,
  });
  const [tamanho, setTamanho] = useState<TamanhoEtiqueta>(TAMANHO_PADRAO);
  const [quantidade, setQuantidade] = useState(1);
  const [inicio, setInicio] = useState(1);
  useEffect(() => {
    const v = localStorage.getItem(TAM_KEY);
    if (v === "grande" || v === "media" || v === "pequena") setTamanho(v);
  }, []);
  const escolherTamanho = (t: TamanhoEtiqueta) => {
    setTamanho(t);
    setInicio(1);
    setQuantidade((q) => Math.min(q, porFolha(t)));
    localStorage.setItem(TAM_KEY, t);
  };
  const max = porFolha(tamanho);
  const cfg = TAMANHOS[tamanho];
  const [file, setFile] = useState<File | null>(null);

  const dest: EnderecoEtiqueta = useMemo(
    () => ({ ...(cliente ?? {}), nome: cliente?.nome ?? "" }),
    [cliente],
  );
  const rem: RemetenteEtiqueta = useMemo(() => {
    const e = empresa ?? empresaPadrao;
    return { ...e, nome: e.nome_fantasia || e.contato, contato: e.contato, email: e.email };
  }, [empresa]);

  useEffect(() => {
    if (!open || !cliente) return;
    let active = true;
    setFile(null);
    void import("@/lib/pdf-etiqueta")
      .then(async ({ buildEtiquetaPdf }) => {
        const doc = await buildEtiquetaPdf(dest, rem, { tamanho, quantidade, inicio });
        const nome = `etiqueta-${(cliente.nome || "cliente").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
        if (active) setFile(new File([doc.output("blob")], nome, { type: "application/pdf" }));
      })
      .catch(() => toast.error("Não foi possível preparar a etiqueta"));
    return () => {
      active = false;
    };
  }, [open, cliente, dest, rem, tamanho, quantidade, inicio]);

  const imprimir = async () => {
    if (!file) return;
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Etiqueta de envio" });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
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
          <DrawerDescription>
            {max} etiquetas por folha A4 · {cfg.descricao}
          </DrawerDescription>
        </DrawerHeader>
        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4"
          data-vaul-no-drag
        >
          {incompleto ? (
            <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className="flex-1">
                <p className="font-semibold">Complete o endereço</p>
                <p className="text-muted-foreground">
                  Faltam dados do cliente. Você pode imprimir assim mesmo.
                </p>
                {onEditCliente ? (
                  <Button variant="link" className="h-auto min-h-0 p-0" onClick={onEditCliente}>
                    Editar cliente
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          {remetenteSemEndereco(rem) ? (
            <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className="flex-1">
                <p className="font-semibold">Seu endereço de remetente está vazio</p>
                <Link
                  to="/dados-empresa"
                  className="inline-flex min-h-11 items-center font-semibold text-primary"
                >
                  Preencher dados da empresa
                </Link>
              </div>
            </div>
          ) : null}
          <div role="group" aria-label="Tamanho" className="grid grid-cols-3 gap-2">
            {(Object.keys(TAMANHOS) as TamanhoEtiqueta[]).map((t) => (
              <Button
                key={t}
                type="button"
                variant={tamanho === t ? "default" : "outline"}
                className="h-auto min-h-14 flex-col rounded-xl py-2"
                aria-pressed={tamanho === t}
                onClick={() => escolherTamanho(t)}
              >
                <span className="font-semibold">{TAMANHOS[t].label}</span>
                <span className="text-xs opacity-80">{TAMANHOS[t].descricao}</span>
              </Button>
            ))}
          </div>
          <div
            className="mx-auto overflow-hidden rounded-sm border border-foreground bg-card p-2 leading-snug text-foreground"
            style={{
              width: `${cfg.w * 2.6}px`,
              maxWidth: "100%",
              aspectRatio: `${cfg.w} / ${cfg.h}`,
              fontSize: tamanho === "grande" ? 11 : 8,
            }}
          >
            <p className="text-center font-bold">DESTINATÁRIO</p>
            <p
              className="line-clamp-2 break-words text-center font-bold uppercase"
              style={{ fontSize: "1.4em" }}
            >
              {dest.nome}
            </p>
            <hr className="my-1 border-foreground" />
            {linhasDestinatario(dest, tamanho === "pequena").map((l) => (
              <p
                key={l.rotulo}
                className={l.destaque ? "font-bold" : ""}
                style={l.destaque ? { fontSize: "1.3em" } : undefined}
              >
                <b>{l.rotulo}</b> {l.valor}
              </p>
            ))}
            <hr className="my-1 border-foreground" />
            <p className="text-center font-bold">REMETENTE</p>
            {linhasRemetente(rem, tamanho !== "pequena").map((l) => (
              <p key={l.texto} className={l.negrito ? "font-bold" : ""}>
                {l.texto}
              </p>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Quantidade</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-11 rounded-xl"
                aria-label="Diminuir"
                disabled={quantidade <= 1}
                onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
              >
                −
              </Button>
              <span className="w-8 text-center text-lg font-semibold" aria-live="polite">
                {quantidade}
              </span>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-11 rounded-xl"
                aria-label="Aumentar"
                onClick={() => setQuantidade((q) => q + 1)}
              >
                +
              </Button>
            </div>
          </div>
          {inicio - 1 + quantidade > max ? (
            <p className="text-xs text-muted-foreground">
              Passa de uma folha: serão geradas {Math.ceil((inicio - 1 + quantidade) / max)} folhas.
            </p>
          ) : null}
          <div className="space-y-2">
            <span className="text-sm font-medium">Começar na posição {inicio}</span>
            <div
              className="mx-auto grid w-44 gap-1"
              style={{ gridTemplateColumns: `repeat(${cfg.cols}, 1fr)` }}
              role="group"
              aria-label="Posição inicial na folha"
            >
              {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Posição ${n}`}
                  aria-pressed={inicio === n}
                  onClick={() => setInicio(n)}
                  className={`min-h-8 rounded border text-xs ${n === inicio ? "bg-primary text-primary-foreground" : n < inicio ? "bg-muted text-muted-foreground" : "bg-card"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DrawerFooter className="shrink-0 border-t border-border bg-card">
          <p className="text-xs text-muted-foreground">
            Imprima em tamanho real (100%), sem "ajustar à página".
          </p>
          <Button
            className="h-14 w-full rounded-xl text-base font-semibold"
            disabled={!file}
            onClick={() => void imprimir()}
          >
            <Printer className="mr-2 h-5 w-5" />{" "}
            {file ? "Imprimir / Compartilhar PDF" : "Preparando..."}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
