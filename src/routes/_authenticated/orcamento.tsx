import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, FileText, PackagePlus, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ClienteSelect } from "@/components/ClienteSelect";
import { PageShell, Section } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchClientes, fetchValores, todayISO, type Cliente } from "@/lib/apontamentos";
import { formatCurrency, valorVigente } from "@/lib/financeiro";
import { resizeImage } from "@/lib/image-resize";
import { saveOrcamentoOffline } from "@/lib/offline";
import { calcularTotaisOrcamento, fetchOrcamentos, formasPagamentoOrcamento, itemOrcamentoSomado, proximoNumeroOrcamento, type DescontoTipo, type FormaPagamentoOrcamento, type OrcamentoItem, type OrcamentoItemTipo, type OrcamentoStatus, type UnidadeOrcamento } from "@/lib/orcamentos";
import { generateQuotePdf } from "@/lib/pdf-report";
import { fetchPecas } from "@/lib/pecas";

export const Route = createFileRoute("/_authenticated/orcamento")({
  validateSearch: (search: Record<string, unknown>) => ({ id: typeof search["id"] === "string" ? search["id"] : undefined }),
  head: () => ({ meta: [
    { title: "Editar orçamento — CP TECHNIC Horas" },
    { name: "description", content: "Monte um orçamento de produtos e serviços para um cliente." },
    { property: "og:title", content: "Editar orçamento — CP TECHNIC Horas" },
    { property: "og:description", content: "Editor privado de orçamento." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: OrcamentoPage,
});

type DraftItem = Omit<OrcamentoItem, "user_id" | "created_at" | "updated_at"> & { quantidadeTexto: string; valorTexto: string };
const numberValue = (value: string) => Number(value.replace(",", ".")) || 0;
const newItem = (orcamentoId: string): DraftItem => ({ id: crypto.randomUUID(), orcamento_id: orcamentoId, peca_id: null, tipo: "produto", nome: "", codigo: null, quantidade: 1, quantidadeTexto: "1", unidade: "un", valor_unitario: 0, valorTexto: "", foto_data_url: null, ordem: 0 });

function OrcamentoPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: orcamentos = [] } = useQuery({ queryKey: ["orcamentos"], queryFn: fetchOrcamentos });
  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: fetchClientes });
  const { data: pecas = [] } = useQuery({ queryKey: ["pecas"], queryFn: fetchPecas });
  const { data: valores = [] } = useQuery({ queryKey: ["valores"], queryFn: fetchValores });
  const source = orcamentos.find((entry) => entry.id === search.id);
  const idRef = useRef(search.id ?? crypto.randomUUID());
  const initialized = useRef<string | null>(null);
  const [numero, setNumero] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [data, setData] = useState(todayISO());
  const [validade, setValidade] = useState("15");
  const [status, setStatus] = useState<OrcamentoStatus>("rascunho");
  const [descontoTipo, setDescontoTipo] = useState<DescontoTipo>("valor");
  const [desconto, setDesconto] = useState("");
  const [formas, setFormas] = useState<FormaPagamentoOrcamento[]>([]);
  const [condicoes, setCondicoes] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<DraftItem[]>([]);
  const [pecaId, setPecaId] = useState("");

  useEffect(() => {
    if (source && initialized.current !== source.id) {
      initialized.current = source.id; idRef.current = source.id; setNumero(source.numero); setClienteId(source.cliente_id); setData(source.data); setValidade(String(source.validade_dias)); setStatus(source.status); setDescontoTipo(source.desconto_tipo); setDesconto(source.desconto_valor ? String(source.desconto_valor).replace(".", ",") : ""); setFormas(source.formas_pagamento); setCondicoes(source.condicoes_pagamento ?? ""); setObservacoes(source.observacoes ?? ""); setItens(source.itens.map((item) => ({ ...item, quantidadeTexto: String(item.quantidade).replace(".", ","), valorTexto: String(item.valor_unitario).replace(".", ",") })));
    } else if (!search.id && !numero && orcamentos.length >= 0) setNumero(proximoNumeroOrcamento(orcamentos));
  }, [numero, orcamentos, search.id, source]);

  const numericItems = useMemo(() => itens.map((item) => ({ ...item, quantidade: numberValue(item.quantidadeTexto), valor_unitario: numberValue(item.valorTexto) })), [itens]);
  const totals = useMemo(() => calcularTotaisOrcamento(numericItems, descontoTipo, numberValue(desconto)), [desconto, descontoTipo, numericItems]);
  const cliente = clientes.find((entry) => entry.id === clienteId) ?? source?.cliente_snapshot;
  const valid = Boolean(numero.trim() && cliente && data && Number(validade) >= 0 && numericItems.length > 0 && numericItems.every((item) => item.nome.trim() && (!itemOrcamentoSomado(item) || item.quantidade > 0) && item.valor_unitario >= 0));

  const payload = () => {
    if (!cliente) throw new Error("Selecione o cliente.");
    return { id: idRef.current, numero: numero.trim(), cliente_id: cliente.id, cliente_snapshot: structuredClone(cliente) as Cliente, data, validade_dias: Number(validade), desconto_tipo: descontoTipo, desconto_valor: numberValue(desconto), formas_pagamento: formas, condicoes_pagamento: condicoes.trim() || null, observacoes: observacoes.trim() || null, status, total_produtos: totals.produtos, total_servicos: totals.servicos, subtotal: totals.subtotal, total: totals.total, ...(source ? { created_at: source.created_at } : {}), itens: numericItems.map(({ quantidadeTexto: _q, valorTexto: _v, ...item }, index) => ({ ...item, ordem: index })) };
  };
  const save = useMutation({ mutationFn: () => saveOrcamentoOffline(payload()), onSuccess: (result) => { void queryClient.invalidateQueries({ queryKey: ["orcamentos"] }); toast.success(result.queued ? "Orçamento salvo no aparelho" : "Orçamento salvo"); void navigate({ to: "/orcamentos" }); }, onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar") });
  const addCatalogItem = () => { const part = pecas.find((entry) => entry.id === pecaId); if (!part) return; setItens((current) => [...current, { ...newItem(idRef.current), peca_id: part.id, nome: part.descricao, codigo: part.codigo, unidade: part.unidade === "unidade" ? "un" : (part.unidade as UnidadeOrcamento), valor_unitario: part.preco, valorTexto: String(part.preco).replace(".", ",") }]); setPecaId(""); };
  const addServiceItem = (nome: string, unidade: UnidadeOrcamento, valor: number) => {
    setItens((current) => [...current, { ...newItem(idRef.current), tipo: "servico", nome, unidade, valor_unitario: valor, valorTexto: String(valor).replace(".", ",") }]);
  };
  const tarifa = valorVigente(data, valores);
  const servicosRapidos = [
    ["Hora trabalhada", "h", tarifa?.valor_hora_trabalhada ?? 0],
    ["Hora de viagem", "h", tarifa?.valor_hora_viagem ?? 0],
    ["Diária inteira", "un", tarifa?.valor_diaria_inteira ?? 0],
    ["Meia diária", "un", tarifa?.valor_meia_diaria ?? 0],
  ] as const;
  const patchItem = (itemId: string, patch: Partial<DraftItem>) => setItens((current) => current.map((item) => item.id === itemId ? { ...item, ...patch } : item));
  const selectPhoto = async (itemId: string, file?: File) => { if (!file) return; try { patchItem(itemId, { foto_data_url: await resizeImage(file) }); } catch { toast.error("Não foi possível usar essa foto"); } };
  const generate = async () => { if (!valid) return; try { await generateQuotePdf({ ...payload(), user_id: "", created_at: source?.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString(), itens: numericItems.map(({ quantidadeTexto: _q, valorTexto: _v, ...item }) => ({ ...item, user_id: "", created_at: "", updated_at: "" })) }); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível gerar o PDF"); } };

  return <PageShell title={source ? "Editar orçamento" : "Novo orçamento"} subtitle={numero || "Numeração automática"} backTo="/orcamentos">
    <Section title="Dados do orçamento">
      <div className="grid grid-cols-2 gap-3"><Field label="Número" value={numero} onChange={setNumero} /><div className="space-y-1.5"><Label>Data</Label><Input type="date" value={data} onChange={(event) => setData(event.target.value)} className="h-12 rounded-xl" /></div></div>
      <ClienteSelect clientes={clientes} value={clienteId} onChange={setClienteId} />
      <div className="grid grid-cols-2 gap-3"><Field label="Validade (dias)" value={validade} onChange={setValidade} inputMode="numeric" /><div className="space-y-1.5"><Label>Status</Label><select value={status} onChange={(event) => setStatus(event.target.value as OrcamentoStatus)} className="ios-field h-12 w-full border px-3"><option value="rascunho">Rascunho</option><option value="enviado">Enviado</option><option value="aprovado">Aprovado</option><option value="recusado">Recusado</option></select></div></div>
    </Section>
    <Section title="Itens" hint={`${itens.length} item(ns)`}>
      <div className="grid grid-cols-[minmax(0,1fr)_3rem] gap-2"><select value={pecaId} onChange={(event) => setPecaId(event.target.value)} className="ios-field h-12 min-w-0 border px-3"><option value="">Adicionar do catálogo</option>{pecas.map((part) => <option key={part.id} value={part.id}>{part.descricao}</option>)}</select><Button size="icon" className="h-12 w-12 rounded-xl" disabled={!pecaId} onClick={addCatalogItem}><PackagePlus className="h-5 w-5" /></Button></div>
      <div className="grid grid-cols-2 gap-2">{servicosRapidos.map(([nome, unidade, valor]) => <Button key={nome} type="button" variant="outline" className="h-auto min-h-12 justify-start rounded-xl px-3 py-2 text-left" onClick={() => addServiceItem(nome, unidade, valor)}><span><span className="block text-sm font-medium">{nome}</span><span className="block text-xs text-muted-foreground">{formatCurrency(valor)}{unidade === "h" ? "/h" : ""}</span></span></Button>)}</div>
      <Button variant="outline" className="h-11 w-full rounded-xl" onClick={() => setItens((current) => [...current, newItem(idRef.current)])}><Plus className="mr-2 h-4 w-4" />Item livre</Button>
      <div className="space-y-3">{itens.map((item, index) => { const somarItem = itemOrcamentoSomado(item); return <div key={item.id} className="space-y-3 border-t pt-3 first:border-0 first:pt-0"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Item {index + 1}</p><Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => setItens((current) => current.filter((entry) => entry.id !== item.id))}><Trash2 className="h-4 w-4" /></Button></div><div className="grid grid-cols-2 gap-2"><select value={item.tipo} onChange={(event) => patchItem(item.id, { tipo: event.target.value as OrcamentoItemTipo })} className="ios-field h-11 border px-3"><option value="produto">Produto</option><option value="servico">Serviço</option></select><select value={item.unidade} onChange={(event) => patchItem(item.id, { unidade: event.target.value as UnidadeOrcamento })} className="ios-field h-11 border px-3">{["un", "h", "km", "pç", "cj"].map((unit) => <option key={unit}>{unit}</option>)}</select></div><Input value={item.nome} onChange={(event) => patchItem(item.id, { nome: event.target.value })} placeholder="Nome do produto ou serviço" className="h-11 rounded-xl" /><Input value={item.codigo ?? ""} onChange={(event) => patchItem(item.id, { codigo: event.target.value || null })} placeholder="Código (opcional)" className="h-11 rounded-xl" /><div className={somarItem ? "grid grid-cols-2 gap-2" : "grid grid-cols-1"}>{somarItem ? <Field label="Quantidade" value={item.quantidadeTexto} onChange={(value) => patchItem(item.id, { quantidadeTexto: value })} inputMode="decimal" /> : null}<Field label={somarItem ? "Valor unitário" : "Valor por hora"} value={item.valorTexto} onChange={(value) => patchItem(item.id, { valorTexto: value })} inputMode="decimal" /></div><div className="flex items-center gap-2">{item.foto_data_url ? <img src={item.foto_data_url} alt="Foto do item" className="h-14 w-14 rounded-lg border object-cover" /> : null}<Button asChild variant="ghost" className="h-10 rounded-xl"><label><Camera className="mr-2 h-4 w-4" />{item.foto_data_url ? "Trocar foto" : "Adicionar foto"}<input type="file" accept="image/*" className="sr-only" onChange={(event) => void selectPhoto(item.id, event.target.files?.[0])} /></label></Button>{item.foto_data_url ? <Button size="icon" variant="ghost" className="text-destructive" onClick={() => patchItem(item.id, { foto_data_url: null })}><Trash2 className="h-4 w-4" /></Button> : null}</div><p className="text-right text-sm font-semibold tabular-nums">{somarItem ? formatCurrency(numberValue(item.quantidadeTexto) * numberValue(item.valorTexto)) : `${formatCurrency(numberValue(item.valorTexto))}/h`}</p></div>; })}</div>
    </Section>
    <Section title="Totais"><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Desconto</Label><select value={descontoTipo} onChange={(event) => setDescontoTipo(event.target.value as DescontoTipo)} className="ios-field h-12 w-full border px-3"><option value="valor">Em reais</option><option value="percentual">Percentual</option></select></div><Field label={descontoTipo === "valor" ? "Valor (R$)" : "Percentual (%)"} value={desconto} onChange={setDesconto} inputMode="decimal" /></div><dl className="space-y-2 text-sm"><Total label="Produtos" value={totals.produtos} /><Total label="Serviços" value={totals.servicos} /><Total label="Subtotal" value={totals.subtotal} /><Total label="Desconto" value={-totals.desconto} /><div className="flex justify-between border-t pt-3 text-lg font-bold"><dt>Total</dt><dd className="text-primary">{formatCurrency(totals.total)}</dd></div></dl></Section>
    <Section title="Pagamento e observações"><div className="grid grid-cols-2 gap-2">{formasPagamentoOrcamento.map((forma) => <label key={forma} className="flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-3 text-sm"><Checkbox checked={formas.includes(forma)} onCheckedChange={(checked) => setFormas((current) => checked ? [...current, forma] : current.filter((entry) => entry !== forma))} />{forma}</label>)}</div><Textarea value={condicoes} onChange={(event) => setCondicoes(event.target.value)} placeholder="Condições de pagamento" className="rounded-xl" /><Textarea value={observacoes} onChange={(event) => setObservacoes(event.target.value)} placeholder="Observações gerais" className="rounded-xl" /></Section>
    <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="h-14 rounded-xl" disabled={!valid} onClick={() => void generate()}><FileText className="mr-2 h-5 w-5" />Gerar PDF</Button><Button className="h-14 rounded-xl" disabled={!valid || save.isPending} onClick={() => save.mutate()}><Save className="mr-2 h-5 w-5" />{save.isPending ? "Salvando..." : "Salvar"}</Button></div>
  </PageShell>;
}

function Field({ label, value, onChange, inputMode }: { label: string; value: string; onChange: (value: string) => void; inputMode?: "numeric" | "decimal" }) { return <div className="space-y-1.5"><Label>{label}</Label><Input value={value} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} className="h-12 rounded-xl" /></div>; }
function Total({ label, value }: { label: string; value: number }) { return <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="tabular-nums">{formatCurrency(value)}</dd></div>; }