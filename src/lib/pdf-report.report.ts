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
  desconto = 0,
) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const empresa = await ensureEmpresa();
  const colors = reportColors;
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
  doc.rect(0, infoTop, pageWidth, 17, "F");
  const infoColumns = [
    { label: "CLIENTE", value: cliente.nome, detail: cliente.cnpj ? `CNPJ: ${cliente.cnpj}` : null, x: marginX, width: 78 },
    { label: "CIDADE", value: cliente.cidade || "Não informada", x: 94, width: 45 },
    { label: "PERÍODO", value: `${formatDateBR(inicio)} a ${formatDateBR(fim)}`, x: 143, width: 55 },
  ];
  doc.setDrawColor(...colors.divider);
  doc.setLineWidth(0.2);
  doc.line(90, infoTop + 2.5, 90, infoTop + 14.5);
  doc.line(139, infoTop + 2.5, 139, infoTop + 14.5);
  infoColumns.forEach(({ label, value, detail, x, width }) => {
    doc.setTextColor(...colors.gray);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(label, x, infoTop + 5);
    doc.setTextColor(...colors.petroleum);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const fitted = doc.splitTextToSize(value, width) as string[];
    doc.text(fitted[0] ?? "", x, infoTop + 10.5);
    if (detail) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...colors.text2);
      doc.text(detail, x, infoTop + 14.2);
    }
  });

  const totals = somarTotais(apontamentos);
  const financial = financeiroSalvo ?? calcularValoresPeriodo(apontamentos, valores);
  const totalPecas = pecas.reduce((total, peca) => total + peca.preco * peca.quantidade, 0);
  const totalDespesas = despesasRelatorio.reduce((total, despesa) => total + despesa.valor, 0);
  const subtotalComPecas = financial.totalGeral + totalPecas + totalDespesas;
  const descontoAplicado = Math.min(Math.max(0, desconto), subtotalComPecas);
  const totalComPecas = subtotalComPecas - descontoAplicado;
  const sortedEntries = [...apontamentos].sort((a, b) => a.data.localeCompare(b.data));
  drawEntriesTable(doc, autoTable, sortedEntries, totals, marginX);

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
  const summaryRowCount = 2 + (totalDespesas > 0 ? 1 : 0) + (descontoAplicado > 0 ? 1 : 0);
  const summaryHeight = 24 + summaryRowCount * 6;
  const servicesWidth = 100;
  const servicesEstimatedHeight = (financialRows.length + 2) * 6;
  const lowerBlocksY = pageHeight - 60 - Math.max(summaryHeight, servicesEstimatedHeight);
  const upperContentFinalY = reportTable.lastAutoTable?.finalY ?? 30;
  const valuesOnContinuationPage = upperContentFinalY + 6 > lowerBlocksY;
  if (valuesOnContinuationPage) doc.addPage();
  doc.setPage(doc.getNumberOfPages());
  const valuesStartY = valuesOnContinuationPage ? 12 : pageHeight - 60 - servicesEstimatedHeight;
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
  const cardY = valuesOnContinuationPage ? 12 : pageHeight - 60 - summaryHeight;
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
    ...(descontoAplicado > 0 ? [["Desconto", -descontoAplicado] as [string, number]] : []),
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
   doc.text(descontoAplicado > 0 ? "VALOR FINAL" : "TOTAL GERAL", cardX + 5, totalBandY + 7.5);
  const totalValue = currencyNumber(totalComPecas);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...colors.petroleum);
  const totalValueWidth = doc.getTextWidth(totalValue) * (15 / 8);
  doc.text("R$", cardX + summaryWidth - 6 - totalValueWidth, totalBandY + 7.5, { align: "right" });
  doc.setFontSize(15);
  doc.text(totalValue, cardX + summaryWidth - 5, totalBandY + 8, { align: "right" });

  drawReportSignatures(doc, pageHeight);

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

  const preparedPdfs = await Promise.all(pdfAttachments.map(async ({ anexo }) => {
    if (typeof anexo === "string") return null;
    const { PDFDocument } = await import("pdf-lib");
    return await PDFDocument.load(dataUrlBytes(anexo.conteudo));
  }));
  const generatedPages = doc.getNumberOfPages();
  const totalPages = generatedPages + preparedPdfs.reduce((total, pdf) => total + (pdf?.getPageCount() ?? 0), 0);
  for (let page = 1; page <= generatedPages; page += 1) {
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
  for (const source of preparedPdfs) {
    if (!source) continue;
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  const mergedBytes = await merged.save();
  await shareOrDownloadBlob(new Blob([mergedBytes as BlobPart], { type: "application/pdf" }), filename, `Relatório CP TECHNIC — ${cliente.nome}`);
}
