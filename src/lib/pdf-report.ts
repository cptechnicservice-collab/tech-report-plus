import {
  calcularTotais,
  formatDateBR,
  formatMinutes,
  normalizeTime,
  somarTotais,
  type ApontamentoComCliente,
  type Cliente,
} from "@/lib/apontamentos";
import { calcularValoresPeriodo, formatCurrency, type TotaisFinanceiros, type ValorVigencia } from "@/lib/financeiro";

export type ReportPartItem = {
  id: string;
  descricao: string;
  codigo: string | null;
  unidade: string;
  preco: number;
  quantidade: number;
};

const range = (start?: string | null, end?: string | null) =>
  start && end ? `${normalizeTime(start)}–${normalizeTime(end)}` : "—";

const filePart = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");

const fileDate = (value: string) => value.split("-").reverse().join("-");

async function shareOrDownloadPdf(doc: { output: (type: "blob") => Blob; save: (filename: string) => void }, filename: string, title: string) {
  const blob = doc.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  doc.save(filename);
}

const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ate999(value: number) {
  if (value === 100) return "cem";
  const parts: string[] = [];
  const centena = Math.floor(value / 100);
  const resto = value % 100;
  if (centena) parts.push(centenas[centena] ?? "");
  if (resto) parts.push(resto < 20 ? unidades[resto] ?? "" : [dezenas[Math.floor(resto / 10)], unidades[resto % 10]].filter(Boolean).join(" e "));
  return parts.join(" e ");
}

function inteiroPorExtenso(value: number) {
  if (value === 0) return "zero";
  const parts: string[] = [];
  const milhoes = Math.floor(value / 1_000_000);
  const milhares = Math.floor((value % 1_000_000) / 1_000);
  const resto = value % 1_000;
  if (milhoes) parts.push(milhoes === 1 ? "um milhão" : `${ate999(milhoes)} milhões`);
  if (milhares) parts.push(milhares === 1 ? "mil" : `${ate999(milhares)} mil`);
  if (resto) parts.push(ate999(resto));
  return parts.join(resto > 0 && resto < 100 ? " e " : " ");
}

export function valorPorExtenso(value: number) {
  const rounded = Math.round(value * 100);
  const reais = Math.floor(rounded / 100);
  const centavos = rounded % 100;
  const realText = `${inteiroPorExtenso(reais)} ${reais === 1 ? "real" : "reais"}`;
  return centavos ? `${realText} e ${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}` : realText;
}

export async function generateClientReport(
  cliente: Cliente,
  apontamentos: ApontamentoComCliente[],
  valores: ValorVigencia[],
  pecas: ReportPartItem[],
  inicio: string,
  fim: string,
  financeiroSalvo?: TotaisFinanceiros,
) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("CP TECHNIC", 12, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Cliente: ${cliente.nome}`, 12, 21);
  const details = [cliente.cidade, cliente.cnpj ? `CNPJ: ${cliente.cnpj}` : null].filter(Boolean).join(" · ");
  if (details) doc.text(details, 12, 26);
  doc.text(`Período: ${formatDateBR(inicio)} a ${formatDateBR(fim)}`, 12, details ? 31 : 26);

  const totals = somarTotais(apontamentos);
  const financial = financeiroSalvo ?? calcularValoresPeriodo(apontamentos, valores);
  const totalPecas = pecas.reduce((total, peca) => total + peca.preco * peca.quantidade, 0);
  const totalComPecas = financial.totalGeral + totalPecas;
  autoTable(doc, {
    startY: details ? 36 : 31,
    margin: { left: 8, right: 8, bottom: 12 },
    styles: { fontSize: 6.8, cellPadding: 1.5, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: [39, 54, 78], textColor: 255 },
    head: [["Data", "Máquina / serviço", "Ida", "Trabalho", "Intervalo", "Retorno", "H. trabalho", "H. viagem", "KM", "Observações"]],
    body: [...apontamentos].sort((a, b) => a.data.localeCompare(b.data)).map((item) => {
      const itemTotals = calcularTotais(item);
      return [
        formatDateBR(item.data),
        item.maquina_servico || "—",
        range(item.viagem_ida_saida, item.viagem_ida_chegada),
        range(item.trabalho_inicio, item.trabalho_fim),
        range(item.intervalo_inicio, item.intervalo_fim),
        range(item.viagem_volta_saida, item.viagem_volta_chegada),
        formatMinutes(itemTotals.trabalho),
        formatMinutes(itemTotals.viagem),
        String(itemTotals.km),
        item.observacoes || "—",
      ];
    }),
    foot: [["TOTAIS", "", "", "", "", "", formatMinutes(totals.trabalho), formatMinutes(totals.viagem), String(totals.km), ""]],
    columnStyles: { 0: { cellWidth: 17 }, 1: { cellWidth: 36 }, 2: { cellWidth: 22 }, 3: { cellWidth: 22 }, 4: { cellWidth: 22 }, 5: { cellWidth: 22 }, 6: { cellWidth: 18 }, 7: { cellWidth: 18 }, 8: { cellWidth: 12 }, 9: { cellWidth: 73 } },
  });

  const reportTable = doc as typeof doc & { lastAutoTable?: { finalY: number } };
  if (pecas.length > 0) {
    autoTable(doc, {
      startY: (reportTable.lastAutoTable?.finalY ?? 35) + 6,
      margin: { left: 76, right: 8, bottom: 32 },
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: [39, 54, 78], textColor: 255 },
      footStyles: { fillColor: [225, 232, 242], textColor: [39, 54, 78], fontStyle: "bold" },
      head: [["Peças utilizadas", "Qtd.", "Valor unit.", "Total"]],
      body: pecas.map((peca) => [
        `${peca.descricao}${peca.codigo ? ` · ${peca.codigo}` : ""}`,
        `${peca.quantidade} ${peca.unidade}`,
        formatCurrency(peca.preco),
        formatCurrency(peca.preco * peca.quantidade),
      ]),
      foot: [["SUBTOTAL PEÇAS", "", "", formatCurrency(totalPecas)]],
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 35, halign: "right" },
        2: { cellWidth: 43, halign: "right" },
        3: { cellWidth: 44, halign: "right" },
      },
    });
  }
  const unitValue = (total: number, quantity: number, suffix = "") =>
    quantity > 0 ? `${formatCurrency(total / quantity)}${suffix}` : "—";
  const financialRows = [
    [
      "Horas trabalhadas",
      formatMinutes(financial.horasTrabalhadas),
      unitValue(financial.valorTrabalho, financial.horasTrabalhadas / 60, "/h"),
      formatCurrency(financial.valorTrabalho),
    ],
    [
      "Horas de viagem",
      formatMinutes(financial.horasViagem),
      unitValue(financial.valorViagem, financial.horasViagem / 60, "/h"),
      formatCurrency(financial.valorViagem),
    ],
    [
      "Deslocamento",
      `${financial.km} km`,
      unitValue(financial.valorKm, financial.km, "/km"),
      formatCurrency(financial.valorKm),
    ],
    ...(financial.diariasInteiras > 0 ? [[
      "Diária inteira",
      String(financial.diariasInteiras),
      unitValue(financial.valorDiariasInteiras, financial.diariasInteiras),
      formatCurrency(financial.valorDiariasInteiras),
    ]] : []),
    ...(financial.meiasDiarias > 0 ? [[
      "Meia diária",
      String(financial.meiasDiarias),
      unitValue(financial.valorMeiasDiarias, financial.meiasDiarias),
      formatCurrency(financial.valorMeiasDiarias),
    ]] : []),
    ...(financial.pedagios > 0 ? [["Pedágios", "—", "—", formatCurrency(financial.pedagios)]] : []),
    ...(financial.outrasDespesas > 0 ? [["Outras despesas", "—", "—", formatCurrency(financial.outrasDespesas)]] : []),
    ["TOTAL DAS PEÇAS", "", "", formatCurrency(totalPecas)],
    ["TOTAL DOS SERVIÇOS", "", "", formatCurrency(financial.totalGeral)],
  ];
  autoTable(doc, {
    startY: (reportTable.lastAutoTable?.finalY ?? 35) + 6,
    margin: { left: 110, right: 8, bottom: 32 },
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [39, 54, 78], textColor: 255 },
    footStyles: { fillColor: [39, 91, 158], textColor: 255, fontStyle: "bold" },
    head: [["Descrição", "Qtd.", "Valor unit.", "Total"]],
    body: financialRows,
    foot: [["TOTAL GERAL", "", "", formatCurrency(totalComPecas)]],
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 29, halign: "right" },
      2: { cellWidth: 43, halign: "right" },
      3: { cellWidth: 44, halign: "right" },
    },
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  const lastPage = doc.getNumberOfPages();
  doc.setPage(lastPage);
  doc.setDrawColor(140);
  doc.line(16, pageHeight - 20, 86, pageHeight - 20);
  doc.line(164, pageHeight - 20, 234, pageHeight - 20);
  doc.setFontSize(8);
  doc.text("Assinatura do técnico", 16, pageHeight - 15);
  doc.text("Responsável do cliente", 164, pageHeight - 15);
  doc.text(`Emissão: ${new Date().toLocaleDateString("pt-BR")}`, 248, pageHeight - 10, { align: "right" });

  const filename = `CPTECHNIC_${filePart(cliente.nome)}_${fileDate(inicio)}_a_${fileDate(fim)}.pdf`;
  await shareOrDownloadPdf(doc, filename, `Relatório CP TECHNIC — ${cliente.nome}`);
}

export async function generatePaymentReceipt(input: {
  cliente: Cliente;
  inicio: string;
  fim: string;
  valorRecebido: number;
  formaPagamento: string;
  dataRecebimento: string;
}) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("CP TECHNIC", 18, 22);
  doc.setFontSize(12);
  doc.text("RECIBO DE PAGAMENTO", 192, 22, { align: "right" });
  doc.setDrawColor(39, 54, 78);
  doc.setLineWidth(0.8);
  doc.line(18, 28, 192, 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Recebemos de ${input.cliente.nome}`, 18, 43);
  const details = [input.cliente.cnpj ? `CNPJ ${input.cliente.cnpj}` : null, input.cliente.cidade].filter(Boolean).join(" · ");
  if (details) doc.text(details, 18, 50);
  doc.text(`referente ao relatório do período de ${formatDateBR(input.inicio)} a ${formatDateBR(input.fim)}.`, 18, details ? 60 : 52);

  const startY = details ? 76 : 68;
  doc.setFillColor(238, 242, 248);
  doc.roundedRect(18, startY, 174, 34, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(formatCurrency(input.valorRecebido), 26, startY + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const extenso = valorPorExtenso(input.valorRecebido);
  doc.text(extenso.charAt(0).toUpperCase() + extenso.slice(1), 26, startY + 24, { maxWidth: 155 });

  doc.setFontSize(11);
  doc.text(`Forma de pagamento: ${input.formaPagamento}`, 18, startY + 50);
  doc.text(`Data do recebimento: ${formatDateBR(input.dataRecebimento)}`, 18, startY + 59);

  doc.line(65, 230, 145, 230);
  doc.setFontSize(9);
  doc.text("CP TECHNIC", 105, 236, { align: "center" });
  doc.text("Assinatura", 105, 242, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Emissão: ${new Date().toLocaleDateString("pt-BR")}`, 192, 281, { align: "right" });

  const filename = `RECIBO_CPTECHNIC_${filePart(input.cliente.nome)}_${fileDate(input.dataRecebimento)}.pdf`;
  await shareOrDownloadPdf(doc, filename, `Recibo CP TECHNIC — ${input.cliente.nome}`);
}