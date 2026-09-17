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
import type jsPDF from "jspdf";

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
) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("CP TECHNIC", 9, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Cliente: ${cliente.nome}`, 9, 16);
  const details = [cliente.cidade, cliente.cnpj ? `CNPJ: ${cliente.cnpj}` : null].filter(Boolean).join(" · ");
  if (details) doc.text(details, 9, 20);
  doc.text(`Período: ${formatDateBR(inicio)} a ${formatDateBR(fim)}`, 9, details ? 24 : 20);

  const totals = somarTotais(apontamentos);
  const financial = financeiroSalvo ?? calcularValoresPeriodo(apontamentos, valores);
  const totalPecas = pecas.reduce((total, peca) => total + peca.preco * peca.quantidade, 0);
  const totalComPecas = financial.totalGeral + totalPecas;
  autoTable(doc, {
    startY: details ? 28 : 24,
    margin: { left: 7, right: 7, bottom: 24 },
    styles: { fontSize: 6.2, cellPadding: 1.15, overflow: "linebreak", valign: "top", lineWidth: 0.05 },
    headStyles: { fillColor: [39, 54, 78], textColor: 255 },
    head: [["Data", "Máquina / serviço", "Horários", "H. trab.", "Viagem / KM", "Observações"]],
    body: [...apontamentos].sort((a, b) => a.data.localeCompare(b.data)).map((item) => {
      const itemTotals = calcularTotais(item);
      const horarios = [
        item.viagem_ida_saida && item.viagem_ida_chegada ? `Ida ${range(item.viagem_ida_saida, item.viagem_ida_chegada)}` : null,
        item.trabalho_inicio && item.trabalho_fim ? `Trab. ${range(item.trabalho_inicio, item.trabalho_fim)}` : null,
        item.intervalo_inicio && item.intervalo_fim ? `Int. ${range(item.intervalo_inicio, item.intervalo_fim)}` : null,
        item.viagem_volta_saida && item.viagem_volta_chegada ? `Ret. ${range(item.viagem_volta_saida, item.viagem_volta_chegada)}` : null,
      ].filter(Boolean).join("\n") || "—";
      return [
        formatDateBR(item.data),
        item.maquina_servico || "—",
        horarios,
        formatMinutes(itemTotals.trabalho),
        `${formatMinutes(itemTotals.viagem)}\n${itemTotals.km} km`,
        item.observacoes || "—",
      ];
    }),
    foot: [["TOTAIS", "", "", formatMinutes(totals.trabalho), `${formatMinutes(totals.viagem)}\n${totals.km} km`, ""]],
    columnStyles: { 0: { cellWidth: 17 }, 1: { cellWidth: 36 }, 2: { cellWidth: 43 }, 3: { cellWidth: 17 }, 4: { cellWidth: 22 }, 5: { cellWidth: 61 } },
  });

  const reportTable = doc as typeof doc & { lastAutoTable?: { finalY: number } };
  if (pecas.length > 0) {
    autoTable(doc, {
      startY: (reportTable.lastAutoTable?.finalY ?? 30) + 4,
      margin: { left: 7, right: 7, bottom: 24 },
      styles: { fontSize: 7, cellPadding: 1.25 },
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
        0: { cellWidth: 91 },
        1: { cellWidth: 31, halign: "right" },
        2: { cellWidth: 34, halign: "right" },
        3: { cellWidth: 40, halign: "right" },
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
  ];
  autoTable(doc, {
    startY: (reportTable.lastAutoTable?.finalY ?? 30) + 4,
    margin: { left: 37, right: 7, bottom: 24 },
    styles: { fontSize: 7, cellPadding: 1.25 },
    headStyles: { fillColor: [39, 54, 78], textColor: 255 },
    footStyles: { fillColor: [225, 232, 242], textColor: [39, 54, 78], fontStyle: "bold" },
    head: [["Valores dos serviços", "Qtd.", "Valor unit.", "Total"]],
    body: financialRows,
    foot: [["TOTAL DOS SERVIÇOS", "", "", formatCurrency(financial.totalGeral)]],
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 30, halign: "right" },
      2: { cellWidth: 43, halign: "right" },
      3: { cellWidth: 41, halign: "right" },
    },
  });

  autoTable(doc, {
    startY: (reportTable.lastAutoTable?.finalY ?? 30) + 4,
    margin: { left: 74, right: 7, bottom: 24 },
    theme: "plain",
    styles: { fontSize: 7.5, cellPadding: 1.2 },
    headStyles: { fillColor: [74, 82, 94], textColor: 255, fontStyle: "bold" },
    head: [["RESUMO DOS VALORES", ""]],
    body: [
      ["Serviços", formatCurrency(financial.totalGeral)],
      ["Peças", formatCurrency(totalPecas)],
    ],
    foot: [["TOTAL GERAL", formatCurrency(totalComPecas)]],
    footStyles: { fillColor: [39, 91, 158], textColor: 255, fontStyle: "bold", fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 66 },
      1: { cellWidth: 63, halign: "right", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        data.cell.styles.fillColor = data.row.index % 2 === 0 ? [245, 247, 250] : [255, 255, 255];
      }
    },
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  const finalY = reportTable.lastAutoTable?.finalY ?? 0;
  if (finalY > pageHeight - 27) doc.addPage();
  doc.setPage(doc.getNumberOfPages());
  doc.setDrawColor(140);
  doc.line(10, pageHeight - 18, 82, pageHeight - 18);
  doc.line(128, pageHeight - 18, 200, pageHeight - 18);
  doc.setFontSize(7);
  doc.text("Assinatura do técnico", 10, pageHeight - 13);
  doc.text("Responsável do cliente", 128, pageHeight - 13);
  doc.text(`Emissão: ${new Date().toLocaleDateString("pt-BR")}`, 200, pageHeight - 7, { align: "right" });

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