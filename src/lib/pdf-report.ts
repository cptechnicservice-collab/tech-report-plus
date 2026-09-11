import {
  calcularTotais,
  formatDateBR,
  formatMinutes,
  normalizeTime,
  somarTotais,
  type ApontamentoComCliente,
  type Cliente,
} from "@/lib/apontamentos";

const range = (start?: string | null, end?: string | null) =>
  start && end ? `${normalizeTime(start)}–${normalizeTime(end)}` : "—";

const filePart = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");

const fileDate = (value: string) => value.split("-").reverse().join("-");

export async function generateClientReport(
  cliente: Cliente,
  apontamentos: ApontamentoComCliente[],
  inicio: string,
  fim: string,
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
  autoTable(doc, {
    startY: details ? 36 : 31,
    margin: { left: 8, right: 8, bottom: 34 },
    styles: { fontSize: 6.8, cellPadding: 1.5, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: [39, 54, 78], textColor: 255 },
    head: [["Data", "Máquina / serviço", "Ida", "Trabalho", "Intervalo", "Retorno", "H. trabalho", "H. viagem", "KM", "Observações"]],
    body: apontamentos.map((item) => {
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
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setDrawColor(140);
      doc.line(16, pageHeight - 20, 86, pageHeight - 20);
      doc.line(164, pageHeight - 20, 234, pageHeight - 20);
      doc.setFontSize(8);
      doc.text("Assinatura do técnico", 16, pageHeight - 15);
      doc.text("Responsável do cliente", 164, pageHeight - 15);
      doc.text(`Emissão: ${new Date().toLocaleDateString("pt-BR")}`, 248, pageHeight - 10, { align: "right" });
    },
  });

  const filename = `CPTECHNIC_${filePart(cliente.nome)}_${fileDate(inicio)}_a_${fileDate(fim)}.pdf`;
  const blob = doc.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Relatório CP TECHNIC — ${cliente.nome}` });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  doc.save(filename);
}