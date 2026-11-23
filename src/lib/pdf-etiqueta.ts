import type { jsPDF as JsPDF } from "jspdf";
import {
  A4,
  TAMANHOS,
  celula,
  linhasDestinatario,
  linhasRemetente,
  posicoesEtiquetas,
  type EnderecoEtiqueta,
  type RemetenteEtiqueta,
  type TamanhoEtiqueta,
} from "@/lib/etiqueta";

const PT = 0.3528; // mm per point
const MIN_PT = 6;

type Box = { x: number; y: number; w: number; h: number };

/** Lays out one label; returns used height (mm). Draws only when `draw` is true. */
function layout(
  doc: JsPDF,
  box: Box,
  dest: EnderecoEtiqueta,
  rem: RemetenteEtiqueta,
  t: TamanhoEtiqueta,
  s: number,
  semEmpresa: boolean,
  draw: boolean,
) {
  const M = 3;
  const inner = box.w - M * 2;
  const x = box.x + M;
  const cx = box.x + box.w / 2;
  const fs = (v: number) => Math.max(MIN_PT, v * s);
  const lh = (size: number) => size * PT * 1.18;
  let y = box.y + M;
  const text = (t2: string | string[], tx: number, size: number, opts?: { align?: "center" }) => {
    if (draw) doc.text(t2, tx, y + size * PT * 0.8, opts);
  };
  // Title
  const tSize = fs(11);
  doc.setFont("helvetica", "bold").setFontSize(tSize);
  text("DESTINATÁRIO", cx, tSize, { align: "center" });
  y += lh(tSize) + 0.6;
  // Name: shrink until 2 lines
  const nome = (dest.nome ?? "").toUpperCase();
  let nSize = fs(17);
  let lines: string[] = [];
  for (;;) {
    doc.setFontSize(nSize);
    lines = doc.splitTextToSize(nome, inner) as string[];
    if (lines.length <= 2 || nSize <= MIN_PT) break;
    nSize = Math.max(MIN_PT, nSize - 0.5);
  }
  lines = lines.slice(0, 2);
  if (draw) doc.text(lines, cx, y + nSize * PT * 0.8, { align: "center", lineHeightFactor: 1.18 });
  y += lines.length * lh(nSize) + 0.8;
  if (draw) doc.line(x, y, x + inner, y);
  y += 1.2;
  const abreviar = t === "pequena";
  for (const linha of linhasDestinatario(dest, abreviar)) {
    if (semEmpresa && linha.rotulo === "Empresa:") continue;
    const size = linha.destaque ? fs(14) : fs(10);
    doc.setFont("helvetica", "bold").setFontSize(size);
    const labelW = doc.getTextWidth(`${linha.rotulo} `);
    if (!linha.destaque) doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(linha.valor, inner - labelW) as string[];
    if (draw) {
      doc.setFont("helvetica", "bold");
      doc.text(linha.rotulo, x, y + size * PT * 0.8);
      if (!linha.destaque) doc.setFont("helvetica", "normal");
      doc.text(wrapped, x + labelW, y + size * PT * 0.8, { lineHeightFactor: 1.18 });
    }
    y += wrapped.length * lh(size) + 0.5;
  }
  y += 0.6;
  if (draw) doc.line(x, y, x + inner, y);
  y += 1.2;
  const rtSize = fs(9);
  doc.setFont("helvetica", "bold").setFontSize(rtSize);
  text("REMETENTE", cx, rtSize, { align: "center" });
  y += lh(rtSize) + 0.3;
  for (const l of linhasRemetente(rem, t !== "pequena")) {
    const size = fs(l.negrito ? 9.5 : 8.5);
    doc.setFont("helvetica", l.negrito ? "bold" : "normal").setFontSize(size);
    const wrapped = doc.splitTextToSize(l.texto, inner) as string[];
    if (draw) doc.text(wrapped, x, y + size * PT * 0.8, { lineHeightFactor: 1.18 });
    y += wrapped.length * lh(size);
  }
  return y + M - box.y;
}

/** Finds the largest scale that fits; returns {scale, semEmpresa, fits}. */
export function ajustarEtiqueta(
  doc: JsPDF,
  box: Box,
  dest: EnderecoEtiqueta,
  rem: RemetenteEtiqueta,
  t: TamanhoEtiqueta,
) {
  const base = Math.pow(box.h / 148, 0.6);
  const variants = t === "pequena" ? [false, true] : [false];
  let last = {
    scale: MIN_PT / 17,
    semEmpresa: variants[variants.length - 1] ?? false,
    fits: false,
  };
  for (const semEmpresa of variants) {
    for (let s = base; s >= 0.2; s -= 0.02) {
      if (layout(doc, box, dest, rem, t, s, semEmpresa, false) <= box.h)
        return { scale: s, semEmpresa, fits: true };
      last = { scale: s, semEmpresa, fits: false };
    }
  }
  return last;
}

function cortes(doc: JsPDF, t: TamanhoEtiqueta) {
  const { cols, rows } = TAMANHOS[t];
  const first = celula(t, 0);
  doc.setDrawColor(170, 170, 170).setLineWidth(0.15);
  doc.setLineDashPattern([1.5, 1.5], 0);
  for (let c = 0; c <= cols; c++) doc.line(first.x + c * first.w, 0, first.x + c * first.w, A4.h);
  for (let r = 0; r <= rows; r++) doc.line(0, first.y + r * first.h, A4.w, first.y + r * first.h);
  doc.setLineDashPattern([], 0);
}

/** A4 portrait sheet(s) with several labels and dashed cut lines; jspdf loaded on demand. */
export async function buildEtiquetaPdf(
  dest: EnderecoEtiqueta,
  remetente: RemetenteEtiqueta,
  opts: { tamanho: TamanhoEtiqueta; quantidade: number; inicio?: number },
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const t = opts.tamanho;
  const pos = posicoesEtiquetas(t, opts.quantidade, opts.inicio ?? 1);
  const c0 = celula(t, 0);
  const fit = ajustarEtiqueta(
    doc,
    { x: c0.x + 1, y: c0.y + 1, w: c0.w - 2, h: c0.h - 2 },
    dest,
    remetente,
    t,
  );
  let page = 0;
  cortes(doc, t);
  for (const p of pos) {
    while (p.page > page) {
      doc.addPage("a4", "portrait");
      page++;
      cortes(doc, t);
    }
    const box = { x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 2 };
    doc.setDrawColor(0, 0, 0).setLineWidth(0.2).setTextColor(0, 0, 0);
    doc.rect(box.x, box.y, box.w, box.h);
    layout(doc, box, dest, remetente, t, fit.scale, fit.semEmpresa, true);
  }
  return doc;
}
