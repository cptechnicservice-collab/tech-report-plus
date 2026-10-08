import type jsPDF from "jspdf";
import type autoTableType from "jspdf-autotable";
import { calcularTotais, formatMinutes, type ApontamentoComCliente, type Totais } from "./apontamentos";
import { range } from "./pdf-report.utils";
import { reportColors } from "./pdf-report.layout";
export function drawEntriesTable(doc: jsPDF, autoTable: typeof autoTableType, sortedEntries: ApontamentoComCliente[], totals: Totais, marginX: number) {
const colors = reportColors;
  autoTable(doc, {
    startY: 70,
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
}
