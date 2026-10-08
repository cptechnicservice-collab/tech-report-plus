import type jsPDF from "jspdf";
import type { DadosEmpresa } from "./empresa";
import type { Cliente } from "./apontamentos";
import { fallbackLogo } from "./pdf-report.utils";
type PdfDoc = jsPDF;
export async function drawDocumentHeader(doc: PdfDoc, input: { empresa: DadosEmpresa; cliente: Cliente; date: string; title: string }) {
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

export function drawDocumentFooter(doc: PdfDoc, empresa: DadosEmpresa) {
  const width = doc.internal.pageSize.getWidth(); const height = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    doc.setPage(page); doc.setDrawColor(140); doc.line(width / 2 - 38, height - 20, width / 2 + 38, height - 20); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(65, 72, 82); doc.text(empresa.nome_fantasia, width / 2, height - 15, { align: "center" }); doc.text(`Contato: ${empresa.contato}`, width / 2, height - 11, { align: "center" }); doc.text(`${page}/${doc.getNumberOfPages()}`, width - 14, height - 10, { align: "right" });
  }
}
