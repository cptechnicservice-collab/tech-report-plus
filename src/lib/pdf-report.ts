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
import { ensureEmpresa, type DadosEmpresa } from "@/lib/empresa";
import type { Orcamento } from "@/lib/orcamentos";
import type { DespesaRelatorio } from "@/lib/relatorios";
import type jsPDF from "jspdf";
import reportLogoAsset from "@/assets/cp-technic-homag-logo.png.asset.json";

export type ReportPartItem = {
  id: string;
  descricao: string;
  codigo: string | null;
  unidade: string;
  preco: number;
  quantidade: number;
  foto_data_url?: string | null;
};

const range = (start?: string | null, end?: string | null) =>
  start && end ? `${normalizeTime(start)}–${normalizeTime(end)}` : "";

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

async function shareOrDownloadBlob(blob: Blob, filename: string, title: string) {
  const file = new File([blob], filename, { type: "application/pdf" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function dataUrlBytes(dataUrl: string) {
  const encoded = dataUrl.split(",")[1];
  if (!encoded) throw new Error("Arquivo PDF inválido.");
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
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
  const joinWithE = resto > 0 && (resto < 100 || resto % 100 === 0);
  return parts.join(joinWithE ? " e " : " ");
}

export function valorPorExtenso(value: number) {
  const rounded = Math.round(value * 100);
  const reais = Math.floor(rounded / 100);
  const centavos = rounded % 100;
  const de = reais >= 1_000_000 && reais % 1_000_000 === 0 ? " de" : "";
  const realText = `${inteiroPorExtenso(reais)}${de} ${reais === 1 ? "real" : "reais"}`;
  return centavos ? `${realText} e ${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}` : realText;
}

type PdfDoc = jsPDF;

async function fallbackLogo() {
  const response = await fetch("/app-icon.png");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
  });
}

async function imageUrlToDataUrl(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
  });
}

async function drawDocumentHeader(doc: PdfDoc, input: { empresa: DadosEmpresa; cliente: Cliente; date: string; title: string }) {
  const width = doc.internal.pageSize.getWidth();
  const logo = input.empresa.logo_data_url ?? await fallbackLogo();
  try { doc.addImage(logo, logo.startsWith("data:image/png") ? "PNG" : "JPEG", 14, 10, 20, 20, undefined, "FAST"); } catch { /* PDF remains usable without an unreadable image. */ }
  doc.setTextColor(34, 45, 62); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(input.empresa.nome_fantasia, 39, 15);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(`CNPJ: ${input.empresa.cnpj}`, 39, 21);
  doc.text(input.empresa.email, width - 14, 15, { align: "right" }); doc.text(`Contato: ${input.empresa.contato}${input.empresa.telefone ? ` · ${input.empresa.telefone}` : ""}`, width - 14, 21, { align: "right" });
  doc.setDrawColor(170); doc.setLineWidth(0.25); doc.line(14, 34, width - 14, 34);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text("DADOS DO CLIENTE", 14, 40);
  doc.setFont("helvetica", "normal"); doc.text(input.cliente.nome, 14, 46); if (input.cliente.cnpj) doc.text(`CPF/CNPJ: ${input.cliente.cnpj}`, 14, 51); doc.text(input.date, width - 14, 46, { align: "right" });
  doc.setFillColor(74, 82, 94); doc.rect(14, 56, width - 28, 9, "F"); doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(input.title, width / 2, 62, { align: "center" }); doc.setTextColor(34, 45, 62);
  return 70;
}

function drawDocumentFooter(doc: PdfDoc, empresa: DadosEmpresa) {
  const width = doc.internal.pageSize.getWidth(); const height = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    doc.setPage(page); doc.setDrawColor(140); doc.line(width / 2 - 38, height - 20, width / 2 + 38, height - 20); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(65, 72, 82); doc.text(empresa.nome_fantasia, width / 2, height - 15, { align: "center" }); doc.text(`Contato: ${empresa.contato}`, width / 2, height - 11, { align: "center" }); doc.text(`${page}/${doc.getNumberOfPages()}`, width - 14, height - 10, { align: "right" });
  }
}

export async function generateClientReport(
  cliente: Cliente,
  apontamentos: ApontamentoComCliente[],
  valores: ValorVigencia[],
  pecas: ReportPartItem[],
  inicio: string,
  fim: string,
  financeiroSalvo?: TotaisFinanceiros,
  observacaoRelatorio = "",
  despesasRelatorio: DespesaRelatorio[] = [],
  numeroRelatorio?: string,
) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const empresa = await ensureEmpresa();
  const colors = {
    petroleum: [18, 50, 67] as [number, number, number],
    petroleumLight: [31, 91, 118] as [number, number, number],
    cyan: [0, 185, 254] as [number, number, number],
    blue: [14, 147, 204] as [number, number, number],
    blueLight: [169, 217, 238] as [number, number, number],
    light: [243, 249, 252] as [number, number, number],
    lightBlue: [229, 242, 249] as [number, number, number],
    text: [30, 44, 54] as [number, number, number],
    text2: [76, 93, 104] as [number, number, number],
    gray: [131, 149, 159] as [number, number, number],
    zebra: [250, 252, 254] as [number, number, number],
    divider: [206, 221, 230] as [number, number, number],
    hairline: [239, 243, 248] as [number, number, number],
  };
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const contentWidth = 186;
  const emittedAt = new Date().toLocaleDateString("pt-BR");
  const currencyNumber = (value: number) => formatCurrency(value).replace(/^R\$\s?/, "");
  const logo = await imageUrlToDataUrl(reportLogoAsset.url);

  doc.setFont("helvetica", "normal");
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 36, "F");
  try {
    const properties = doc.getImageProperties(logo);
    const logoHeight = 27;
    const logoWidth = logoHeight * (properties.width / properties.height);
    doc.addImage(logo, logo.startsWith("data:image/png") ? "PNG" : "JPEG", marginX, 4.5, logoWidth, logoHeight, undefined, "FAST");
  } catch { /* O relatório continua disponível se o logo estiver corrompido. */ }
  const companyX = 43;
  doc.setTextColor(...colors.petroleum);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("CP-Technic Service", companyX, 7.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.3);
  doc.setTextColor(...colors.text);
  doc.text("CP TECHNIC SERVICE MANUTENÇÃO DE", companyX, 12);
  doc.text("MÁQUINAS LTDA", companyX, 15.2);
  doc.text("CNPJ: 46.696.388/0001-08", companyX, 19.2);
  doc.text("Rua Agostino Carini, 181", companyX, 23.2);
  doc.text("Fátima, Bento Gonçalves-RS", companyX, 27.2);
  doc.text("CEP 95702-412", companyX, 31.2);

  const contactX = 121;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...colors.petroleum);
  doc.text("CONTATO", contactX, 8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.text);
  doc.text("clarelcapavan@gmail.com", contactX, 13);
  doc.text("+55 (54) 99129-1187", contactX, 18);
  doc.text("54 991291187", contactX, 23);
  if (numeroRelatorio) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.petroleum);
    doc.text(`Nº ${numeroRelatorio}`, pageWidth - marginX, 8, { align: "right" });
  }

  doc.setFillColor(...colors.petroleum);
  doc.rect(0, 36, pageWidth, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Relatório de atendimento", marginX, 43.5);
  doc.setTextColor(175, 203, 216);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Emitido em ${emittedAt}`, pageWidth - marginX, 43.5, { align: "right" });
  doc.setFillColor(...colors.cyan);
  doc.rect(0, 48, pageWidth, 1.2, "F");

  const infoTop = 49.2;
  doc.setFillColor(...colors.light);
  doc.rect(0, infoTop, pageWidth, 14, "F");
  const infoColumns = [
    { label: "CLIENTE", value: cliente.nome, x: marginX, width: 78 },
    { label: "CIDADE", value: cliente.cidade || "Não informada", x: 94, width: 45 },
    { label: "PERÍODO", value: `${formatDateBR(inicio)} a ${formatDateBR(fim)}`, x: 143, width: 55 },
  ];
  doc.setDrawColor(...colors.divider);
  doc.setLineWidth(0.2);
  doc.line(90, infoTop + 2.5, 90, infoTop + 11.5);
  doc.line(139, infoTop + 2.5, 139, infoTop + 11.5);
  infoColumns.forEach(({ label, value, x, width }) => {
    doc.setTextColor(...colors.gray);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(label, x, infoTop + 5);
    doc.setTextColor(...colors.petroleum);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const fitted = doc.splitTextToSize(value, width) as string[];
    doc.text(fitted[0] ?? "", x, infoTop + 10.5);
  });

  const totals = somarTotais(apontamentos);
  const financial = financeiroSalvo ?? calcularValoresPeriodo(apontamentos, valores);
  const totalPecas = pecas.reduce((total, peca) => total + peca.preco * peca.quantidade, 0);
  const totalDespesas = despesasRelatorio.reduce((total, despesa) => total + despesa.valor, 0);
  const totalComPecas = financial.totalGeral + totalPecas + totalDespesas;
  const sortedEntries = [...apontamentos].sort((a, b) => a.data.localeCompare(b.data));
  autoTable(doc, {
    startY: 67,
    margin: { left: marginX, right: marginX, bottom: 24 },
    theme: "plain",
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.6, overflow: "linebreak", valign: "middle", textColor: colors.text, lineColor: colors.hairline, lineWidth: { bottom: 0.08 } },
    headStyles: { fillColor: colors.lightBlue, textColor: colors.petroleum, fontStyle: "bold", fontSize: 7, lineColor: colors.blueLight, lineWidth: { bottom: 0.3 } },
    footStyles: { fillColor: colors.light, textColor: colors.petroleum, fontStyle: "bold", lineColor: colors.blue, lineWidth: { top: 0.4 } },
    head: [["Data", "Ida", "Trabalho", "Intervalo", "Retorno", "H.\ntrab.", "H.\nviagem", "KM"]],
    body: sortedEntries.map((item) => {
      const itemTotals = calcularTotais(item);
      return [
        "",
        range(item.viagem_ida_saida, item.viagem_ida_chegada),
        range(item.trabalho_inicio, item.trabalho_fim),
        range(item.intervalo_inicio, item.intervalo_fim),
        range(item.viagem_volta_saida, item.viagem_volta_chegada),
        formatMinutes(itemTotals.trabalho),
        formatMinutes(itemTotals.viagem),
        String(itemTotals.km),
      ];
    }),
    foot: [["TOTAIS DO PERÍODO", "", "", "", "", formatMinutes(totals.trabalho), formatMinutes(totals.viagem), String(totals.km)]],
    columnStyles: {
      0: { cellWidth: 23 }, 1: { cellWidth: 27 }, 2: { cellWidth: 27 }, 3: { cellWidth: 27 }, 4: { cellWidth: 27 },
      5: { cellWidth: 20, halign: "right" }, 6: { cellWidth: 20, halign: "right" }, 7: { cellWidth: 15, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index >= 5) data.cell.styles.halign = "right";
      if (data.section === "foot" && data.column.index >= 5) data.cell.styles.halign = "right";
      if (data.section === "body" && data.row.index % 2 === 1) data.cell.styles.fillColor = colors.zebra;
    },
    didDrawCell: (data) => {
      if (data.column.index === 5) {
        doc.setDrawColor(...colors.blueLight);
        doc.setLineWidth(0.4);
        doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
      }
      if (data.section === "body" && data.column.index === 0) {
        const item = sortedEntries[data.row.index];
        if (!item) return;
        const parsed = new Date(`${item.data}T12:00:00`);
        const date = `${String(parsed.getDate()).padStart(2, "0")}/${String(parsed.getMonth() + 1).padStart(2, "0")}`;
        const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(parsed).replace(".", "").toLowerCase();
        const baseline = data.cell.y + data.cell.height / 2 + 1;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...colors.petroleum);
        doc.text(date, data.cell.x + 1.6, baseline);
        const dateWidth = doc.getTextWidth(date);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...colors.gray);
        doc.text(weekday, data.cell.x + 2.6 + dateWidth, baseline);
      }
    },
  });

  const reportTable = doc as typeof doc & { lastAutoTable?: { finalY: number } };
  const note = observacaoRelatorio.trim();
  if (note) {
    const noteStart = (reportTable.lastAutoTable?.finalY ?? 30) + 4;
    const noteLines = doc.splitTextToSize(note, 178) as string[];
    const noteHeight = 10 + noteLines.length * 3.5;
    if (noteStart + noteHeight > pageHeight - 24) doc.addPage();
    const y = noteStart + noteHeight > pageHeight - 24 ? 12 : noteStart;
    doc.setFillColor(...colors.light); doc.roundedRect(marginX, y, contentWidth, noteHeight, 1.5, 1.5, "F");
    doc.setTextColor(...colors.petroleum); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text("OBSERVAÇÃO", marginX + 4, y + 5);
    doc.setTextColor(...colors.text2); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.text(noteLines, marginX + 4, y + 10);
    reportTable.lastAutoTable = { finalY: y + noteHeight };
  }
  if (pecas.length > 0) {
    autoTable(doc, {
      startY: (reportTable.lastAutoTable?.finalY ?? 30) + 4,
      margin: { left: marginX, right: marginX, bottom: 24 },
      theme: "plain",
      styles: { font: "helvetica", fontSize: 7, cellPadding: 1.4, textColor: colors.text, lineColor: colors.hairline, lineWidth: { bottom: 0.08 } },
      headStyles: { fillColor: colors.lightBlue, textColor: colors.petroleum, fontStyle: "bold", lineColor: colors.blueLight, lineWidth: { bottom: 0.3 } },
      footStyles: { fillColor: colors.light, textColor: colors.petroleum, fontStyle: "bold", lineColor: colors.blueLight, lineWidth: { top: 0.4 } },
      head: [["Foto", "Peças utilizadas", "Qtd.", "Valor unit.", "Total"]],
      body: pecas.map((peca) => [
        peca.foto_data_url ? "" : "—",
        `${peca.descricao}${peca.codigo ? ` · ${peca.codigo}` : ""}`,
        `${peca.quantidade} ${peca.unidade}`,
        currencyNumber(peca.preco),
        currencyNumber(peca.preco * peca.quantidade),
      ]),
      foot: [["SUBTOTAL PEÇAS", "", "", "", currencyNumber(totalPecas)]],
      columnStyles: { 0: { cellWidth: 16, halign: "center" }, 1: { cellWidth: 88 }, 2: { cellWidth: 25, halign: "right" }, 3: { cellWidth: 28, halign: "right" }, 4: { cellWidth: 29, halign: "right" } },
      didParseCell: (data) => { if (data.section === "body" && data.column.index === 0 && pecas[data.row.index]?.foto_data_url) data.cell.styles.minCellHeight = 14; },
      didDrawCell: (data) => {
        if (data.section !== "body" || data.column.index !== 0) return;
        const foto = pecas[data.row.index]?.foto_data_url;
        if (!foto) return;
        try { doc.addImage(foto, foto.startsWith("data:image/png") ? "PNG" : "JPEG", data.cell.x + 1, data.cell.y + 1, 12, Math.min(12, data.cell.height - 2), undefined, "FAST"); } catch { /* O PDF continua disponível se uma foto estiver corrompida. */ }
      },
    });
  }
  if (despesasRelatorio.length > 0) {
    autoTable(doc, {
      startY: (reportTable.lastAutoTable?.finalY ?? 30) + 4,
      margin: { left: marginX, right: marginX, bottom: 24 },
      theme: "plain",
      styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.6, textColor: colors.text, lineColor: colors.hairline, lineWidth: { bottom: 0.08 } },
      headStyles: { fillColor: colors.lightBlue, textColor: colors.petroleum, fontStyle: "bold", lineColor: colors.blueLight, lineWidth: { bottom: 0.3 } },
      footStyles: { fillColor: colors.light, textColor: colors.petroleum, fontStyle: "bold", lineColor: colors.blueLight, lineWidth: { top: 0.4 } },
      head: [["Despesas adicionais", "Valor"]],
      body: despesasRelatorio.map((despesa) => [despesa.descricao, currencyNumber(despesa.valor)]),
      foot: [["TOTAL DAS DESPESAS", currencyNumber(totalDespesas)]],
      columnStyles: { 0: { cellWidth: 151 }, 1: { cellWidth: 35, halign: "right" } },
      didParseCell: (data) => {
        if (data.section === "head" && data.column.index === 1) data.cell.styles.halign = "right";
        if (data.section === "body" && data.row.index % 2 === 1) data.cell.styles.fillColor = colors.zebra;
      },
    });
  }
  const unitValue = (total: number, quantity: number, suffix = "") =>
    quantity > 0 ? `${currencyNumber(total / quantity)}${suffix}` : "—";
  const financialRows = [
    [
      "Horas trabalhadas",
      formatMinutes(financial.horasTrabalhadas),
      unitValue(financial.valorTrabalho, financial.horasTrabalhadas / 60, "/h"),
      currencyNumber(financial.valorTrabalho),
    ],
    [
      "Horas de viagem",
      formatMinutes(financial.horasViagem),
      unitValue(financial.valorViagem, financial.horasViagem / 60, "/h"),
      currencyNumber(financial.valorViagem),
    ],
    [
      "Deslocamento",
      `${financial.km} km`,
      unitValue(financial.valorKm, financial.km, "/km"),
      currencyNumber(financial.valorKm),
    ],
    ...(financial.diariasInteiras > 0 ? [[
      "Diária inteira",
      String(financial.diariasInteiras),
      unitValue(financial.valorDiariasInteiras, financial.diariasInteiras),
      currencyNumber(financial.valorDiariasInteiras),
    ]] : []),
    ...(financial.meiasDiarias > 0 ? [[
      "Meia diária",
      String(financial.meiasDiarias),
      unitValue(financial.valorMeiasDiarias, financial.meiasDiarias),
      currencyNumber(financial.valorMeiasDiarias),
    ]] : []),
    ...(financial.pedagios > 0 ? [["Pedágios", "—", "—", currencyNumber(financial.pedagios)]] : []),
    ...(financial.outrasDespesas > 0 ? [["Outras despesas", "—", "—", currencyNumber(financial.outrasDespesas)]] : []),
  ];
  const summaryWidth = 80;
  const summaryHeight = totalDespesas > 0 ? 42 : 36;
  const servicesWidth = 100;
  const servicesEstimatedHeight = (financialRows.length + 2) * 6;
  const lowerBlocksY = pageHeight - 60 - Math.max(summaryHeight, servicesEstimatedHeight);
  const upperContentFinalY = reportTable.lastAutoTable?.finalY ?? 30;
  if (upperContentFinalY + 6 > lowerBlocksY) doc.addPage();
  doc.setPage(doc.getNumberOfPages());
  const valuesStartY = pageHeight - 60 - servicesEstimatedHeight;
  autoTable(doc, {
    startY: valuesStartY,
    margin: { left: marginX, right: pageWidth - marginX - servicesWidth, bottom: 24 },
    theme: "plain",
    tableWidth: servicesWidth,
    styles: { font: "helvetica", fontSize: 6.5, cellPadding: 1.25, textColor: colors.text, lineColor: colors.hairline, lineWidth: { bottom: 0.08 } },
    headStyles: { fillColor: colors.lightBlue, textColor: colors.petroleum, fontStyle: "bold", fontSize: 6.5, lineColor: colors.blueLight, lineWidth: { bottom: 0.3 } },
    footStyles: { fillColor: colors.light, textColor: colors.petroleum, fontStyle: "bold", fontSize: 6.5, lineColor: colors.blueLight, lineWidth: { top: 0.4 } },
    head: [["Valores dos serviços", "Qtd.", "Valor unit.", "Total"]],
    body: financialRows,
    foot: [["TOTAL DOS SERVIÇOS", "", "", currencyNumber(financial.totalGeral)]],
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 17, halign: "right" }, 2: { cellWidth: 22, halign: "right" }, 3: { cellWidth: 21, halign: "right" } },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index > 0) data.cell.styles.halign = "right";
      if (data.section === "body" && data.row.index % 2 === 1) data.cell.styles.fillColor = colors.zebra;
    },
  });
  const cardX = pageWidth - marginX - summaryWidth;
  const cardY = pageHeight - 60 - summaryHeight;
  doc.setDrawColor(...colors.divider);
  doc.setLineWidth(0.2);
  doc.roundedRect(cardX, cardY, summaryWidth, summaryHeight, 2, 2, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...colors.petroleumLight);
  doc.text("RESUMO DOS VALORES", cardX + 5, cardY + 6);
  const summaryRows = [
    ["Serviços", financial.totalGeral],
    ["Peças", totalPecas],
    ...(totalDespesas > 0 ? [["Despesas", totalDespesas] as [string, number]] : []),
  ] as [string, number][];
  summaryRows.forEach(([label, value], index) => {
    const y = cardY + 13 + index * 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.text2);
    doc.text(label, cardX + 5, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.text);
    doc.text(currencyNumber(value), cardX + summaryWidth - 5, y, { align: "right" });
  });
  const totalBandY = cardY + summaryHeight - 13;
  doc.setFillColor(...colors.lightBlue);
  doc.roundedRect(cardX + 0.2, totalBandY, summaryWidth - 0.4, 12.8, 0, 0, "F");
  doc.setDrawColor(...colors.blue);
  doc.setLineWidth(0.5);
  doc.line(cardX, totalBandY, cardX + summaryWidth, totalBandY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...colors.text2);
  doc.text("TOTAL GERAL", cardX + 5, totalBandY + 7.5);
  const totalValue = currencyNumber(totalComPecas);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...colors.petroleum);
  const totalValueWidth = doc.getTextWidth(totalValue) * (15 / 8);
  doc.text("R$", cardX + summaryWidth - 6 - totalValueWidth, totalBandY + 7.5, { align: "right" });
  doc.setFontSize(15);
  doc.text(totalValue, cardX + summaryWidth - 5, totalBandY + 8, { align: "right" });

  const signatureY = pageHeight - 30;
  doc.setDrawColor(...colors.gray);
  doc.setLineWidth(0.2);
  doc.line(12, signatureY, 95, signatureY);
  doc.line(115, signatureY, 198, signatureY);
  doc.setTextColor(...colors.text2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Assinatura do técnico", 12, signatureY + 4);
  doc.text("Responsável do cliente", 115, signatureY + 4);

  const expenseTypeLabel: Record<NonNullable<DespesaRelatorio["tipo"]>, string> = {
    pedagio: "Pedágio",
    hotel: "Hotel",
    alimentacao: "Alimentação",
    combustivel: "Combustível",
    diversos: "Gastos diversos",
  };
  const attachments = despesasRelatorio.flatMap((despesa) =>
    (despesa.anexos ?? []).map((anexo, index) => ({ despesa, anexo, index })),
  );
  const imageAttachments = attachments.filter(({ anexo }) => typeof anexo === "string" || anexo.tipo === "imagem");
  const pdfAttachments = attachments.filter(({ anexo }) => typeof anexo !== "string" && anexo.tipo === "pdf");
  const drawAttachmentHeader = () => {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, 36, "F");
    try {
      const properties = doc.getImageProperties(logo);
      const logoHeight = 27;
      const logoWidth = logoHeight * (properties.width / properties.height);
      doc.addImage(logo, logo.startsWith("data:image/png") ? "PNG" : "JPEG", marginX, 4.5, logoWidth, logoHeight, undefined, "FAST");
    } catch { /* A página continua disponível se o logo estiver corrompido. */ }
    doc.setTextColor(...colors.petroleum);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("CP-Technic Service", companyX, 7.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.3);
    doc.setTextColor(...colors.text);
    doc.text("CP TECHNIC SERVICE MANUTENÇÃO DE", companyX, 12);
    doc.text("MÁQUINAS LTDA", companyX, 15.2);
    doc.text("CNPJ: 46.696.388/0001-08", companyX, 19.2);
    doc.text("Rua Agostino Carini, 181", companyX, 23.2);
    doc.text("Fátima, Bento Gonçalves-RS", companyX, 27.2);
    doc.text("CEP 95702-412", companyX, 31.2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...colors.petroleum);
    doc.text("CONTATO", contactX, 8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.text);
    doc.text("clarelcapavan@gmail.com", contactX, 13);
    doc.text("+55 (54) 99129-1187", contactX, 18);
    doc.text("54 991291187", contactX, 23);
    if (numeroRelatorio) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...colors.petroleum);
      doc.text(`Nº ${numeroRelatorio}`, pageWidth - marginX, 8, { align: "right" });
    }
    doc.setFillColor(...colors.petroleum);
    doc.rect(0, 36, pageWidth, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Anexos - Comprovantes de Despesas", marginX, 43.5);
    doc.setTextColor(175, 203, 216);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Emitido em ${emittedAt}`, pageWidth - marginX, 43.5, { align: "right" });
    doc.setFillColor(...colors.cyan);
    doc.rect(0, 48, pageWidth, 1.2, "F");
  };
  if (imageAttachments.length > 0) {
    const cardWidth = 89;
    const cardHeight = 103;
    const columnGap = 8;
    const rowGap = 8;
    const gridTop = 57;
    imageAttachments.forEach(({ despesa, anexo, index }, attachmentIndex) => {
      const image = typeof anexo === "string" ? anexo : anexo.conteudo;
      if (attachmentIndex % 4 === 0) {
        doc.addPage();
        drawAttachmentHeader();
      }
      const slot = attachmentIndex % 4;
      const column = slot % 2;
      const row = Math.floor(slot / 2);
      const x = marginX + column * (cardWidth + columnGap);
      const y = gridTop + row * (cardHeight + rowGap);
      doc.setDrawColor(...colors.divider);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "S");
      const imageX = x + 3;
      const imageY = y + 3;
      const imageAreaWidth = cardWidth - 6;
      const imageAreaHeight = 77;
      try {
        const properties = doc.getImageProperties(image);
        const scale = Math.min(imageAreaWidth / properties.width, imageAreaHeight / properties.height);
        const drawnWidth = properties.width * scale;
        const drawnHeight = properties.height * scale;
        doc.addImage(
          image,
          image.startsWith("data:image/png") ? "PNG" : "JPEG",
          imageX + (imageAreaWidth - drawnWidth) / 2,
          imageY + (imageAreaHeight - drawnHeight) / 2,
          drawnWidth,
          drawnHeight,
          undefined,
          "FAST",
        );
      } catch {
        doc.setFillColor(...colors.light);
        doc.rect(imageX, imageY, imageAreaWidth, imageAreaHeight, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...colors.gray);
        doc.text("Imagem indisponível", x + cardWidth / 2, imageY + imageAreaHeight / 2, { align: "center" });
      }
      const labelY = y + 84;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...colors.petroleum);
      doc.text(`${expenseTypeLabel[despesa.tipo ?? "diversos"]} · ${despesa.descricao}`, x + 3, labelY, { maxWidth: cardWidth - 6 });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...colors.text2);
      const expenseDate = despesa.data ? formatDateBR(despesa.data) : formatDateBR(fim);
      doc.text(`${expenseDate} · ${formatCurrency(despesa.valor)} · Anexo ${index + 1}`, x + 3, y + 98);
    });
  }

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...colors.gray);
    doc.text("CP TECHNIC — Clarel Pavan", marginX, pageHeight - 8);
    doc.text(`página ${page} de ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: "right" });
  }

  const filename = `CPTECHNIC_${filePart(cliente.nome)}_${fileDate(inicio)}_a_${fileDate(fim)}.pdf`;
  if (pdfAttachments.length === 0) {
    await shareOrDownloadPdf(doc, filename, `Relatório CP TECHNIC — ${cliente.nome}`);
    return;
  }
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.load(doc.output("arraybuffer"));
  for (const { anexo } of pdfAttachments) {
    if (typeof anexo === "string") continue;
    const source = await PDFDocument.load(dataUrlBytes(anexo.conteudo));
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  const mergedBytes = await merged.save();
  await shareOrDownloadBlob(new Blob([mergedBytes as BlobPart], { type: "application/pdf" }), filename, `Relatório CP TECHNIC — ${cliente.nome}`);
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
  const empresa = await ensureEmpresa();
  const startY = await drawDocumentHeader(doc, { empresa, cliente: input.cliente, date: formatDateBR(input.dataRecebimento), title: "RECIBO DE PAGAMENTO" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.text(`Referente ao relatório de ${formatDateBR(input.inicio)} a ${formatDateBR(input.fim)}.`, 18, startY + 5);
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

  drawDocumentFooter(doc, empresa);

  const filename = `RECIBO_CPTECHNIC_${filePart(input.cliente.nome)}_${fileDate(input.dataRecebimento)}.pdf`;
  await shareOrDownloadPdf(doc, filename, `Recibo CP TECHNIC — ${input.cliente.nome}`);
}

export async function generateQuotePdf(orcamento: Orcamento) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const empresa = await ensureEmpresa();
  const startY = await drawDocumentHeader(doc, { empresa, cliente: orcamento.cliente_snapshot, date: formatDateBR(orcamento.data), title: `ORÇAMENTO Nº ${orcamento.numero}` });
  autoTable(doc, {
    startY, margin: { left: 14, right: 14, bottom: 30 }, theme: "striped",
    styles: { fontSize: 8, cellPadding: 2, valign: "middle" }, headStyles: { fillColor: [39, 54, 78], textColor: 255 },
    head: [["Foto", "Nome e código", "Qtd.", "Un.", "Valor unit.", "Valor total"]],
    body: orcamento.itens.map((item) => [item.foto_data_url ? "Foto" : "—", `${item.nome}${item.codigo ? `\nCódigo: ${item.codigo}` : ""}`, String(item.quantidade), item.unidade, formatCurrency(item.valor_unitario), formatCurrency(item.quantidade * item.valor_unitario)]),
    columnStyles: { 0: { cellWidth: 15, halign: "center" }, 1: { cellWidth: 62 }, 2: { cellWidth: 14, halign: "right" }, 3: { cellWidth: 12 }, 4: { cellWidth: 30, halign: "right" }, 5: { cellWidth: 32, halign: "right" } },
    didDrawCell: (data) => { if (data.section === "body" && data.column.index === 0) { const item = orcamento.itens[data.row.index]; if (item?.foto_data_url) { try { doc.addImage(item.foto_data_url, item.foto_data_url.startsWith("data:image/png") ? "PNG" : "JPEG", data.cell.x + 1, data.cell.y + 1, 13, Math.min(13, data.cell.height - 2), undefined, "FAST"); } catch { /* Ignore unsupported image. */ } } } },
  });
  const tableDoc = doc as typeof doc & { lastAutoTable?: { finalY: number } }; let y = (tableDoc.lastAutoTable?.finalY ?? startY) + 7;
  const rows = [["Produtos", orcamento.total_produtos], ["Serviços", orcamento.total_servicos], ["Subtotal", orcamento.subtotal], ["Desconto", -(orcamento.subtotal - orcamento.total)], ["TOTAL", orcamento.total]] as const;
  rows.forEach(([label, value], index) => { doc.setFont("helvetica", index === rows.length - 1 ? "bold" : "normal"); doc.setFontSize(index === rows.length - 1 ? 11 : 9); doc.text(label, 140, y, { align: "right" }); doc.text(formatCurrency(value), 195, y, { align: "right" }); y += index === rows.length - 2 ? 7 : 5; });
  y += 4; doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("OBSERVAÇÕES", 14, y); y += 6; doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  const notes = [`Formas de pagamento: ${orcamento.formas_pagamento.join(", ") || "—"}`, `Condições: ${orcamento.condicoes_pagamento || "—"}`, `Validade: ${orcamento.validade_dias} dias`, orcamento.observacoes || ""].filter(Boolean);
  doc.text(notes, 14, y, { maxWidth: 180 });
  drawDocumentFooter(doc, empresa);
  await shareOrDownloadPdf(doc, `ORCAMENTO_${orcamento.numero}_${filePart(orcamento.cliente_snapshot.nome)}.pdf`, `Orçamento ${orcamento.numero} — ${orcamento.cliente_snapshot.nome}`);
}