import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import { ClienteSelect } from "@/components/ClienteSelect";
import { PageShell, Section } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchClientes, fetchValores, todayISO } from "@/lib/apontamentos";
import { formatCurrency, valorVigente } from "@/lib/financeiro";
import { generateHourQuotePdf } from "@/lib/pdf-report";

export const Route = createFileRoute("/_authenticated/orcamento-horas")({
  head: () => ({ meta: [
    { title: "Orçamento de horas — CP TECHNIC Horas" },
    { name: "description", content: "Gere propostas com as tarifas vigentes de atendimento técnico." },
    { property: "og:title", content: "Orçamento de horas — CP TECHNIC Horas" },
    { property: "og:description", content: "Proposta privada de tarifas para atendimento técnico." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: OrcamentoHorasPage,
});

function OrcamentoHorasPage() {
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: fetchClientes });
  const { data: valores = [] } = useQuery({ queryKey: ["valores"], queryFn: fetchValores });
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [data, setData] = useState(todayISO());
  const [numero, setNumero] = useState(() => `H-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`);
  const [maquinaLocal, setMaquinaLocal] = useState("");
  const [validade, setValidade] = useState("30");
  const [formasPagamento, setFormasPagamento] = useState("Boleto / PIX");
  const [condicoesPagamento, setCondicoesPagamento] = useState("A combinar");
  const [observacoes, setObservacoes] = useState("");
  const [generating, setGenerating] = useState(false);
  const cliente = clientes.find((item) => item.id === clienteId);
  const tarifa = useMemo(() => valorVigente(data, valores), [data, valores]);

  const generate = async () => {
    if (!cliente) { toast.error("Selecione o cliente."); return; }
    if (!tarifa) { toast.error("Cadastre valores vigentes para essa data."); return; }
    setGenerating(true);
    try {
      await generateHourQuotePdf({ cliente, data, numero: numero.trim(), maquinaLocal: maquinaLocal.trim(), validadeDias: Number(validade) || 30, valor: tarifa, observacoes, formasPagamento, condicoesPagamento });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o PDF");
    } finally {
      setGenerating(false);
    }
  };

  const rows = tarifa ? [
    ["Hora trabalhada", `${formatCurrency(tarifa.valor_hora_trabalhada)}/h`],
    ["Hora viajada", `${formatCurrency(tarifa.valor_hora_viagem)}/h`],
    ["Quilometragem", `${formatCurrency(tarifa.valor_km)}/km`],
    ["Diária inteira", formatCurrency(tarifa.valor_diaria_inteira)],
    ["Meia diária", formatCurrency(tarifa.valor_meia_diaria)],
  ] : [];

  return <PageShell title="Orçamento de horas" subtitle="Tarifas atualizadas" backTo="/orcamentos">
    <Section title="Dados do orçamento">
      <ClienteSelect clientes={clientes} value={clienteId} onChange={setClienteId} />
      <div className="grid grid-cols-2 gap-3"><Field label="Número" value={numero} onChange={setNumero} /><div className="space-y-1.5"><Label>Data</Label><Input type="date" value={data} onChange={(event) => setData(event.target.value)} className="h-12 rounded-xl" /></div></div>
      <Field label="Máquina / Local" value={maquinaLocal} onChange={setMaquinaLocal} />
      <Field label="Validade (dias)" value={validade} onChange={setValidade} inputMode="numeric" />
    </Section>
    <Section title="Valores vigentes" hint={tarifa ? `Desde ${tarifa.vigencia.split("-").reverse().join("/")}` : "Não cadastrados"}>
      {rows.length ? <dl className="divide-y divide-border">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3 py-3 first:pt-0 last:pb-0"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>)}</dl> : <p className="text-sm text-muted-foreground">Nenhum valor vigente para esta data.</p>}
    </Section>
    <Section title="Pagamento e observações">
      <Field label="Formas de pagamento" value={formasPagamento} onChange={setFormasPagamento} />
      <Field label="Condições de pagamento" value={condicoesPagamento} onChange={setCondicoesPagamento} />
      <Textarea value={observacoes} onChange={(event) => setObservacoes(event.target.value)} placeholder="Observações adicionais" className="min-h-24 rounded-xl" />
    </Section>
    <Button className="h-14 w-full rounded-xl" disabled={!cliente || !tarifa || !numero.trim() || generating} onClick={() => void generate()}><FileText className="mr-2 h-5 w-5" />{generating ? "Gerando..." : "Gerar PDF"}</Button>
  </PageShell>;
}

function Field({ label, value, onChange, inputMode }: { label: string; value: string; onChange: (value: string) => void; inputMode?: "numeric" }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input value={value} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} className="h-12 rounded-xl" /></div>;
}