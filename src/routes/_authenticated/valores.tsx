import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageShell, Section } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchValores, formatDateBR, todayISO } from "@/lib/apontamentos";
import { formatCurrency, type ValorVigencia } from "@/lib/financeiro";
import { saveValorOffline } from "@/lib/offline";

export const Route = createFileRoute("/_authenticated/valores")({
  head: () => ({ meta: [
    { title: "Valores — CP TECHNIC Horas" },
    { name: "description", content: "Cadastre os valores de horas, viagens, quilometragem e diárias por data de vigência." },
    { property: "og:title", content: "Valores — CP TECHNIC Horas" },
    { property: "og:description", content: "Histórico de valores usados nos apontamentos da CP TECHNIC." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Valores,
});

type Draft = Pick<ValorVigencia, "vigencia"> & Record<
  "valor_hora_trabalhada" | "valor_hora_viagem" | "valor_km" | "valor_diaria_inteira" | "valor_meia_diaria",
  string
>;

const blank = (): Draft => ({
  vigencia: todayISO(),
  valor_hora_trabalhada: "",
  valor_hora_viagem: "",
  valor_km: "",
  valor_diaria_inteira: "",
  valor_meia_diaria: "",
});

const numberValue = (value: string) => Number(value.replace(",", ".")) || 0;

function Valores() {
  const [draft, setDraft] = useState<Draft>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: valores = [] } = useQuery({ queryKey: ["valores"], queryFn: fetchValores });
  const maisRecente = useMemo(() => valores[0], [valores]);

  const salvar = useMutation({
    mutationFn: () => saveValorOffline({
      id: editingId ?? crypto.randomUUID(),
      vigencia: draft.vigencia,
      valor_hora_trabalhada: numberValue(draft.valor_hora_trabalhada),
      valor_hora_viagem: numberValue(draft.valor_hora_viagem),
      valor_km: numberValue(draft.valor_km),
      valor_diaria_inteira: numberValue(draft.valor_diaria_inteira),
      valor_meia_diaria: numberValue(draft.valor_meia_diaria),
      user_id: null,
    }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["valores"] });
      toast.success(result.queued ? "Salvo no aparelho — será enviado quando houver conexão" : "Novos valores salvos");
      setDraft(blank());
      setEditingId(null);
    },
    onError: (error) => toast.error(error instanceof Error ? `Não foi possível salvar: ${error.message}` : "Não foi possível salvar"),
  });

  const edit = (valor: ValorVigencia) => {
    setEditingId(valor.id);
    setDraft({
      vigencia: valor.vigencia,
      valor_hora_trabalhada: String(valor.valor_hora_trabalhada),
      valor_hora_viagem: String(valor.valor_hora_viagem),
      valor_km: String(valor.valor_km),
      valor_diaria_inteira: String(valor.valor_diaria_inteira),
      valor_meia_diaria: String(valor.valor_meia_diaria),
    });
  };

  const fields = [
    ["valor_hora_trabalhada", "Hora trabalhada", "R$/h"],
    ["valor_hora_viagem", "Hora de viagem", "R$/h"],
    ["valor_km", "Quilômetro", "R$/km"],
    ["valor_diaria_inteira", "Diária inteira", "R$"],
    ["valor_meia_diaria", "Meia diária", "R$"],
  ] as const;

  return (
    <PageShell title="Valores" subtitle={maisRecente ? `Última vigência: ${formatDateBR(maisRecente.vigencia)}` : "Defina os valores cobrados"}>
      <Section title="Novos valores">
        <div className="space-y-1.5">
          <Label htmlFor="vigencia">Data de vigência</Label>
          <Input id="vigencia" type="date" value={draft.vigencia} onChange={(event) => setDraft({ ...draft, vigencia: event.target.value })} />
        </div>
        {fields.map(([key, label, suffix]) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={key}>{label} ({suffix})</Label>
            <Input id={key} inputMode="decimal" placeholder="0,00" value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
          </div>
        ))}
        <Button className="h-14 w-full rounded-2xl text-base font-semibold" disabled={!draft.vigencia || salvar.isPending} onClick={() => salvar.mutate()}>
          {editingId ? "Salvar alterações" : "Salvar novos valores"}
        </Button>
      </Section>

      <Section title="Histórico" hint={`${valores.length} alteração(ões)`}>
        {valores.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum valor cadastrado.</p> : (
          <ul className="-my-1 divide-y divide-border">
            {valores.map((valor) => (
              <li key={valor.id}>
                <Button type="button" variant="ghost" className="h-auto w-full justify-start rounded-none px-0 py-3 text-left font-normal" onClick={() => edit(valor)}>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">Vigência {formatDateBR(valor.vigencia)}</span>
                    <span className="mt-1 block whitespace-normal text-xs leading-5 text-muted-foreground">
                      Trabalho {formatCurrency(valor.valor_hora_trabalhada)}/h · Viagem {formatCurrency(valor.valor_hora_viagem)}/h · KM {formatCurrency(valor.valor_km)}<br />
                      Diária {formatCurrency(valor.valor_diaria_inteira)} · Meia {formatCurrency(valor.valor_meia_diaria)}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PageShell>
  );
}