import { linhasDestinatario, linhasRemetente, type EnderecoEtiqueta } from "@/lib/etiqueta";

/** A6 portrait (100 × 150 mm) shipping label; jspdf is loaded on demand. */
export async function buildEtiquetaPdf(dest: EnderecoEtiqueta, remetente: EnderecoEtiqueta, copias = 1) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: [100, 150], orientation: "portrait" });
  const W = 100, M = 6, inner = W - M * 2;
  const total = Math.min(4, Math.max(1, Math.round(copias)));
  for (let page = 0; page < total; page++) {
    if (page > 0) doc.addPage([100, 150], "portrait");
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(3, 3, W - 6, 144);
    let y = 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("DESTINATÁRIO", W / 2, y, { align: "center" });
    y += 8;
    const nome = (dest.nome ?? "").toUpperCase();
    let size = 18;
    let lines: string[] = [];
    for (; size >= 11; size -= 1) {
      doc.setFontSize(size);
      lines = doc.splitTextToSize(nome, inner) as string[];
      if (lines.length <= 2) break;
    }
    doc.text(lines, W / 2, y, { align: "center" });
    y += lines.length * size * 0.42 + 2;
    doc.line(M, y, W - M, y);
    y += 6;
    for (const linha of linhasDestinatario(dest)) {
      const fs = linha.destaque ? 15 : 10.5;
      doc.setFontSize(fs);
      doc.setFont("helvetica", "bold");
      const labelW = doc.getTextWidth(`${linha.rotulo} `);
      if (!linha.destaque) doc.setFont("helvetica", "normal");
      const wrapped = doc.splitTextToSize(linha.valor, inner - labelW) as string[];
      doc.setFont("helvetica", "bold");
      doc.text(linha.rotulo, M, y);
      if (!linha.destaque) doc.setFont("helvetica", "normal");
      doc.text(wrapped, M + labelW, y);
      y += wrapped.length * fs * 0.42 + 2.2;
    }
    y = Math.max(y + 2, 100);
    doc.line(M, y, W - M, y);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("REMETENTE", W / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(10.5);
    const rNome = doc.splitTextToSize((remetente.nome ?? "").toUpperCase(), inner) as string[];
    doc.text(rNome, M, y);
    y += rNome.length * 4.5 + 0.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    for (const linha of linhasRemetente(remetente)) {
      const wrapped = doc.splitTextToSize(linha, inner) as string[];
      doc.text(wrapped, M, y);
      y += wrapped.length * 4.1;
    }
  }
  return doc;
}
