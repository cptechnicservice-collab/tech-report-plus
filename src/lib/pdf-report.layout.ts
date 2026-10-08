import type jsPDF from "jspdf";
export const reportColors = {
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

export function drawReportSignatures(doc: jsPDF, pageHeight: number) {
 const colors = reportColors;
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
}
