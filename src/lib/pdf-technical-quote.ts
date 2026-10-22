import type { jsPDF } from "jspdf";
import type { Cliente } from "@/lib/apontamentos";
import { formatDateBR, todayISO } from "@/lib/apontamentos";
import { formatCurrency, valorVigente, type ValorVigencia } from "@/lib/financeiro";
import logoAsset from "@/assets/cp-technic-homag-logo.png.asset.json";
import { imageUrlToDataUrl, shareOrDownloadPdf } from "./pdf-report.utils";

export const technicalQuoteFilename = "Orcamento-CP-Technic-HOMAG.pdf";

export function technicalQuoteRates(valores: ValorVigencia[], date: string) {
  const vigente = valorVigente(date, valores);
  const rate = (value: number | undefined, fallback: number) =>
    value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;
  return [
    ["Hora trabalhada", "hora", rate(vigente?.valor_hora_trabalhada, 170)],
    ["Hora viajada (deslocamento)", "hora", rate(vigente?.valor_hora_viagem, 120)],
    ["Quilometragem rodada", "km", rate(vigente?.valor_km, 2)],
    ["Almoço (alimentação)", "refeição", 55],
    ["Janta (alimentação)", "refeição", 65],
    ["Hospedagem / hotel (opcional)", "diária", 300],
  ] as const;
}

// Prepare before the click so iPhone file sharing retains user activation.
export async function createTechnicalQuotePdf(input: {
  valores?: ValorVigencia[];
  cliente?: Pick<Cliente, "nome" | "cnpj">;
  logo?: string | null;
  date?: string;
} = {}): Promise<jsPDF> {
  const [{ default: JsPDF }, { default: autoTable }, logo] = await Promise.all([
    import("jspdf"), import("jspdf-autotable"),
    input.logo ? Promise.resolve(input.logo) : imageUrlToDataUrl(logoAsset.url),
  ]);
  const date = input.date ?? todayISO();
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const blue = [0, 174, 239] as const;
  doc.setFont("helvetica", "normal");
  doc.setFillColor(0, 0, 0); doc.rect(0, 0, 210, 40, "F");
  const image = doc.getImageProperties(logo);
  const scale = Math.min(48 / image.width, 29 / image.height);
  doc.addImage(logo, image.fileType, 14, 5.5, image.width * scale, image.height * scale);
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("CP-Technic HOMAG", 196, 13, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  ["CNPJ: 46.696.388/0001-08", "clarelcapavan@gmail.com", "Contato: Clarel Pavan"].forEach((text, i) => doc.text(text, 196, 21 + i * 6, { align: "right" }));
  doc.setFillColor(...blue); doc.rect(0, 40, 210, 0.8, "F");
  doc.setTextColor(25, 25, 25); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text("ORÇAMENTO DE SERVIÇOS TÉCNICOS", 105, 53, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
  doc.text("Assistência técnica em máquinas HOMAG", 105, 60, { align: "center" });
  const section = (text: string, y: number) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110, 110, 110);
    doc.text(text, 14, y); doc.setDrawColor(190, 190, 190); doc.setLineWidth(0.2); doc.line(14, y + 2, 196, y + 2);
  };
  section("Dados do Cliente", 71);
  const field = (label: string, value: string, x: number, y: number, end: number) => {
    doc.setTextColor(35, 35, 35); doc.setFontSize(8); doc.text(label, x, y);
    const start = x + doc.getTextWidth(label) + 2;
    doc.setDrawColor(180, 180, 180); doc.line(start, y + 1, end, y + 1);
    if (value) doc.text(doc.splitTextToSize(value, end - start)[0] ?? "", start, y);
  };
  field("Cliente:", input.cliente?.nome ?? "", 14, 81, 130);
  field("Data:", input.cliente ? formatDateBR(date) : "", 137, 81, 196);
  field("CPF/CNPJ:", input.cliente?.cnpj ?? "", 14, 91, 130); field("Nº:", "", 137, 91, 196);
  field("Máquina / Modelo:", "", 14, 101, 130); field("Nº de série:", "", 137, 101, 196);
  field("Local:", "", 14, 111, 196);
  section("Tabela de Valores", 124);
  autoTable(doc, {
    startY: 129, margin: { left: 14, right: 14 }, theme: "striped",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.4, textColor: [30, 30, 30] },
    headStyles: { fillColor: [138, 138, 138], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [242, 242, 242] },
    head: [["Descrição", "Unidade", "Valor Unitário"]],
    body: technicalQuoteRates(input.valores ?? [], date).map(([label, unit, value]) => [label, unit, formatCurrency(value)]),
    columnStyles: { 0: { cellWidth: 107 }, 1: { cellWidth: 30, halign: "center" }, 2: { cellWidth: 45, halign: "right" } },
  });
  const tableEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 186;
  doc.setDrawColor(...blue); doc.setLineWidth(0.8); doc.line(14, tableEnd, 196, tableEnd);
  let y = tableEnd + 10; section("Observações", y); y += 8;
  doc.setFontSize(8);
  [
    "Hospedagem por conta do cliente. Opcional: a CP-Technic reserva o hotel (R$ 300,00/diária).",
    "Passagens aéreas, quando necessárias, por conta do cliente.",
    "Horas trabalhadas e viajadas apuradas em relatório de atendimento assinado pelo cliente.",
    "Peças e materiais não inclusos; quando necessários, orçados à parte.",
    "Validade deste orçamento: 30 dias a partir da data de emissão.",
  ].forEach((note) => {
    doc.setFillColor(...blue); doc.circle(16, y - 1, 0.6, "F");
    doc.setTextColor(35, 35, 35); const lines = doc.splitTextToSize(note, 175) as string[];
    doc.text(lines, 20, y); y += Math.max(5.5, lines.length * 3.6);
  });
  y += 2;
  const payment = (label: string, value: string) => {
    doc.setFont("helvetica", "bold"); doc.text(label, 14, y);
    const x = 16 + doc.getTextWidth(label); doc.setFont("helvetica", "normal"); doc.text(value, x, y); y += 6;
  };
  payment("Formas de Pagamento:", "Boleto / PIX"); payment("Condições de Pagamento:", "A combinar");
  doc.setDrawColor(70, 70, 70); doc.setLineWidth(0.2);
  doc.line(25, 260, 86, 260); doc.line(124, 260, 185, 260);
  doc.setFont("helvetica", "bold"); doc.text("CP-Technic HOMAG", 55.5, 266, { align: "center" }); doc.text("Cliente", 154.5, 266, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.text("Clarel Pavan", 55.5, 271, { align: "center" }); doc.text("Aceite / Data", 154.5, 271, { align: "center" });
  doc.setFillColor(...blue); doc.rect(0, 283, 210, 0.8, "F");
  doc.setFillColor(0, 0, 0); doc.rect(0, 283.8, 210, 13.2, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(7);
  doc.text("CP-Technic HOMAG • CNPJ 46.696.388/0001-08 • clarelcapavan@gmail.com", 105, 291, { align: "center" });
  return doc;
}

export function shareTechnicalQuotePdf(doc: jsPDF) {
  return shareOrDownloadPdf(doc, technicalQuoteFilename, "Orçamento de Serviços Técnicos");
}