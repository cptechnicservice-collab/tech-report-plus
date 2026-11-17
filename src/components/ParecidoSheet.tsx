import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { formatDateBR, normalizeSearchText, type ApontamentoComCliente } from "@/lib/apontamentos";

export type ParecidoOpcoes = { km: boolean; despesas: boolean; observacoes: boolean };

export function ParecidoSheet({
  open,
  onOpenChange,
  apontamentos,
  initialId,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apontamentos: ApontamentoComCliente[];
  initialId?: string | undefined;
  onApply: (origem: ApontamentoComCliente, opcoes: ParecidoOpcoes) => void;
}) {
  const [busca, setBusca] = useState("");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(initialId ?? null);
  const [opcoes, setOpcoes] = useState<ParecidoOpcoes>({ km: false, despesas: false, observacoes: false });

  useEffect(() => {
    if (open) {
      setSelecionadoId(initialId ?? null);
      setOpcoes({ km: false, despesas: false, observacoes: false });
      setBusca("");
    }
  }, [open, initialId]);

  const lista = useMemo(() => {
    const termo = normalizeSearchText(busca);
    return apontamentos.filter((a) => !termo || normalizeSearchText(a.clientes?.nome ?? "").includes(termo)).slice(0, 30);
  }, [apontamentos, busca]);
  const selecionado = apontamentos.find((a) => a.id === selecionadoId) ?? null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Usar atendimento parecido</DrawerTitle>
          <DrawerDescription>Data e horários nunca são copiados.</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          {selecionado ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-secondary/70 p-3 text-sm">
                <p className="font-semibold">Serão usados:</p>
                <p className="mt-1">Cliente: <strong>{selecionado.clientes?.nome ?? "—"}</strong></p>
                <p>Máquina/serviço: <strong>{selecionado.maquina_servico || "—"}</strong></p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Copiar também (opcional):</p>
                {([["km", "Quilometragem"], ["despesas", "Despesas (alimentação, pedágio, outras)"], ["observacoes", "Observações"]] as const).map(([key, label]) => (
                  <Label key={key} htmlFor={`parecido-${key}`} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-normal">
                    <Checkbox id={`parecido-${key}`} className="h-5 w-5" checked={opcoes[key]} onCheckedChange={(c) => setOpcoes((o) => ({ ...o, [key]: c === true }))} />
                    {label}
                  </Label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={() => setSelecionadoId(null)}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Outro
                </Button>
                <Button type="button" className="h-12 rounded-xl" onClick={() => { onApply(selecionado, opcoes); onOpenChange(false); }}>
                  Usar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente" className="h-12 rounded-xl pl-9" />
              </div>
              {lista.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhum apontamento encontrado.</p> : (
                <ul className="divide-y divide-border">
                  {lista.map((a) => (
                    <li key={a.id}>
                      <button type="button" className="press flex min-h-14 w-full items-center gap-3 py-2 text-left" onClick={() => setSelecionadoId(a.id)}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{a.clientes?.nome ?? "—"}</span>
                          <span className="block truncate text-xs text-muted-foreground">{formatDateBR(a.data)}{a.maquina_servico ? ` · ${a.maquina_servico}` : ""}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
