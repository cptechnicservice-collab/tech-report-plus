import {
  calcularTotais,
  formatDateBR,
  formatMinutes,
  normalizeTime,
  somarTotais,
  type ApontamentoComCliente,
  type Cliente,
} from "@/lib/apontamentos";
import { calcularValoresPeriodo, formatCurrency, formatDecimalHours, type ValorVigencia } from "@/lib/financeiro";

const range = (start?: string | null, end?: string | null) =>
  start && end ? `${normalizeTime(start)}–${normalizeTime(end)}` : "—";

const filePart = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");

const fileDate = (value: string) => value.split("-").reverse().join("-");

export async function generateClientReport(
  cliente: Cliente,
  apontamentos: ApontamentoComCliente[],
  valores: ValorVigencia[],
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
  const financial = calcularValoresPeriodo(apontamentos, valores);
  autoTable(doc, {
    startY: details ? 36 : 31,
    margin: { left: 8, right: 8, bottom: 12 },
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
  });

  const reportTable = doc as typeof doc & { lastAutoTable?: { finalY: number } };
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
    startY: (reportTable.lastAutoTable?.finalY ?? 35) + 6,
    margin: { left: 110, right: 8, bottom: 32 },
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [39, 54, 78], textColor: 255 },
    footStyles: { fillColor: [39, 91, 158], textColor: 255, fontStyle: "bold" },
    head: [["Descrição", "Qtd.", "Valor unit.", "Total"]],
    body: financialRows,
    foot: [["TOTAL GERAL", "", "", formatCurrency(financial.totalGeral)]],
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