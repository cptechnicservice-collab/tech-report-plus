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
import reportLogoAsset from "@/assets/cp-technic-homag-logo.png.asset.json";
import type { ReportPartItem } from "./pdf-report.types";
import { range, filePart, fileDate, shareOrDownloadPdf, shareOrDownloadBlob, dataUrlBytes, valorPorExtenso, imageUrlToDataUrl } from "./pdf-report.utils";
import { drawDocumentHeader, drawDocumentFooter } from "./pdf-report.header";
import { reportColors, drawReportSignatures } from "./pdf-report.layout";
import { drawEntriesTable } from "./pdf-report.tables";
export async function generatePaymentReceipt(input: {
  cliente: Cliente;
  inicio: string;
  fim: string;
  valorRecebido: number;
  formaPagamento: string;
  dataRecebimento: string;
  parcela?: string;
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
  if (input.parcela) doc.text(input.parcela, 18, startY + 68);

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
    body: orcamento.itens.map((item) => [item.foto_data_url ? "" : "—", `${item.nome}${item.codigo ? `\nCódigo: ${item.codigo}` : ""}`, String(item.quantidade), item.unidade, formatCurrency(item.valor_unitario), formatCurrency(item.quantidade * item.valor_unitario)]),
    columnStyles: { 0: { cellWidth: 15, halign: "center" }, 1: { cellWidth: 62 }, 2: { cellWidth: 14, halign: "right" }, 3: { cellWidth: 12 }, 4: { cellWidth: 30, halign: "right" }, 5: { cellWidth: 32, halign: "right" } },
    didParseCell: (data) => { if (data.section === "body" && data.column.index === 0 && orcamento.itens[data.row.index]?.foto_data_url) data.cell.styles.minCellHeight = 16; },
    didDrawCell: (data) => { if (data.section === "body" && data.column.index === 0) { const item = orcamento.itens[data.row.index]; if (item?.foto_data_url) { try { doc.addImage(item.foto_data_url, item.foto_data_url.startsWith("data:image/png") ? "PNG" : "JPEG", data.cell.x + 1, data.cell.y + 1, 13, 13, undefined, "FAST"); } catch { /* Ignore unsupported image. */ } } } },
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

export async function generateHourQuotePdf(input: {
  cliente: Cliente;
  data: string;
  numero: string;
  maquinaLocal: string;
  validadeDias: number;
  valor: ValorVigencia;
  observacoes: string;
  formasPagamento: string;
  condicoesPagamento: string;
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const empresa = await ensureEmpresa();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const logo = empresa.logo_data_url ?? await imageUrlToDataUrl(reportLogoAsset.url);

  doc.setFillColor(11, 18, 24);
  doc.rect(0, 0, width, 42, "F");
  try { doc.addImage(logo, logo.startsWith("data:image/png") ? "PNG" : "JPEG", 14, 8, 43, 27, undefined, "FAST"); } catch { /* Keep the document usable if an image is invalid. */ }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(empresa.nome_fantasia, width - 14, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`CNPJ: ${empresa.cnpj}`, width - 14, 21, { align: "right" });
  doc.text(empresa.email, width - 14, 27, { align: "right" });
  doc.text(`Contato: ${empresa.contato}${empresa.telefone ? ` · ${empresa.telefone}` : ""}`, width - 14, 33, { align: "right" });
  doc.setFillColor(0, 185, 254);
  doc.rect(0, 42, width, 1.2, "F");

  doc.setTextColor(20, 31, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("ORÇAMENTO DE SERVIÇOS TÉCNICOS", width / 2, 58, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(92, 101, 108);
  doc.text("Assistência técnica em máquinas HOMAG", width / 2, 64, { align: "center" });

  doc.setFontSize(9);
  doc.text("Dados do Cliente", 14, 76);
  doc.setDrawColor(190, 196, 201);
  doc.line(14, 78, width - 14, 78);
  doc.setTextColor(27, 35, 41);
  doc.setFontSize(8);
  doc.text(`Cliente: ${input.cliente.nome}`, 14, 86);
  doc.text(`Data: ${formatDateBR(input.data)}`, 135, 86);
  doc.text(`CPF/CNPJ: ${input.cliente.cnpj || "—"}`, 14, 94);
  doc.text(`Nº: ${input.numero}`, 135, 94);
  doc.text(`Máquina / Local: ${input.maquinaLocal || "—"}`, 14, 102);

  doc.setTextColor(92, 101, 108);
  doc.setFontSize(9);
  doc.text("Tabela de Valores", 14, 116);
  doc.line(14, 118, width - 14, 118);
  autoTable(doc, {
    startY: 121,
    margin: { left: 14, right: 14 },
    theme: "striped",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 3, textColor: [30, 38, 44] },
    headStyles: { fillColor: [121, 126, 130], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [241, 243, 244] },
    head: [["Descrição", "Unidade", "Valor unitário"]],
    body: [
      ["Hora trabalhada", "hora", formatCurrency(input.valor.valor_hora_trabalhada)],
      ["Hora viajada (deslocamento)", "hora", formatCurrency(input.valor.valor_hora_viagem)],
      ["Quilometragem rodada", "km", formatCurrency(input.valor.valor_km)],
      ["Diária inteira (alimentação)", "dia", formatCurrency(input.valor.valor_diaria_inteira)],
      ["Meia diária (alimentação)", "dia", formatCurrency(input.valor.valor_meia_diaria)],
    ],
    columnStyles: { 0: { cellWidth: 105 }, 1: { cellWidth: 30, halign: "center" }, 2: { cellWidth: 47, halign: "right", fontStyle: "bold" } },
  });
  const tableDoc = doc as typeof doc & { lastAutoTable?: { finalY: number } };
  const tableBottom = tableDoc.lastAutoTable?.finalY ?? 174;
  doc.setDrawColor(0, 185, 254);
  doc.setLineWidth(0.7);
  doc.line(14, tableBottom, width - 14, tableBottom);
  let y = tableBottom + 12;
  doc.setTextColor(92, 101, 108);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Observações", 14, y);
  doc.setDrawColor(190, 196, 201);
  doc.line(14, y + 2, width - 14, y + 2);
  y += 9;
  doc.setTextColor(27, 35, 41);
  doc.setFontSize(8);
  const standardNotes = [
    "Hospedagem (hotel) por conta do cliente.",
    "Passagens aéreas, quando necessárias, por conta do cliente.",
    "Horas trabalhadas e viajadas apuradas em relatório de atendimento assinado pelo cliente.",
    "Peças e materiais não inclusos; quando necessários, orçados à parte.",
    `Validade deste orçamento: ${input.validadeDias} dias.`,
  ];
  [...standardNotes, ...input.observacoes.split("\n").map((item) => item.trim()).filter(Boolean)].forEach((note) => {
    doc.setFillColor(0, 185, 254);
    doc.circle(16, y - 1, 0.65, "F");
    doc.setTextColor(27, 35, 41);
    const lines = doc.splitTextToSize(note, 172) as string[];
    doc.text(lines, 20, y);
    y += Math.max(6, lines.length * 4);
  });
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.text("Formas de Pagamento:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(input.formasPagamento || "A combinar", 50, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Condições de Pagamento:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(input.condicoesPagamento || "A combinar", 54, y);

  const signatureY = Math.min(height - 39, y + 22);
  doc.setDrawColor(70, 76, 80);
  doc.line(25, signatureY, 86, signatureY);
  doc.line(124, signatureY, 185, signatureY);
  doc.setFont("helvetica", "bold");
  doc.text(empresa.nome_fantasia, 55.5, signatureY + 6, { align: "center" });
  doc.text("Cliente", 154.5, signatureY + 6, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(empresa.contato, 55.5, signatureY + 11, { align: "center" });
  doc.text("Aceite / Data", 154.5, signatureY + 11, { align: "center" });

  doc.setFillColor(0, 185, 254);
  doc.rect(0, height - 14, width, 1, "F");
  doc.setFillColor(11, 18, 24);
  doc.rect(0, height - 13, width, 13, "F");
  doc.setTextColor(225, 230, 233);
  doc.setFontSize(7);
  doc.text(`${empresa.nome_fantasia}  ·  CNPJ ${empresa.cnpj}  ·  ${empresa.email}`, width / 2, height - 6, { align: "center" });

  await shareOrDownloadPdf(doc, `ORCAMENTO_HORAS_${input.numero}_${filePart(input.cliente.nome)}.pdf`, `Orçamento de horas ${input.numero} — ${input.cliente.nome}`);
}