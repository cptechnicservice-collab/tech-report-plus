import { normalizeTime } from "./apontamentos";
export const range = (start?: string | null, end?: string | null) =>
  start && end ? `${normalizeTime(start)}–${normalizeTime(end)}` : "";

export const filePart = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");

export const fileDate = (value: string) => value.split("-").reverse().join("-");

export async function shareOrDownloadPdf(doc: { output: (type: "blob") => Blob; save: (filename: string) => void }, filename: string, title: string) {
  const blob = doc.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  doc.save(filename);
}

export async function shareOrDownloadBlob(blob: Blob, filename: string, title: string) {
  const file = new File([blob], filename, { type: "application/pdf" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function dataUrlBytes(dataUrl: string) {
  const encoded = dataUrl.split(",")[1];
  if (!encoded) throw new Error("Arquivo PDF inválido.");
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ate999(value: number) {
  if (value === 100) return "cem";
  const parts: string[] = [];
  const centena = Math.floor(value / 100);
  const resto = value % 100;
  if (centena) parts.push(centenas[centena] ?? "");
  if (resto) parts.push(resto < 20 ? unidades[resto] ?? "" : [dezenas[Math.floor(resto / 10)], unidades[resto % 10]].filter(Boolean).join(" e "));
  return parts.join(" e ");
}

function inteiroPorExtenso(value: number) {
  if (value === 0) return "zero";
  const parts: string[] = [];
  const milhoes = Math.floor(value / 1_000_000);
  const milhares = Math.floor((value % 1_000_000) / 1_000);
  const resto = value % 1_000;
  if (milhoes) parts.push(milhoes === 1 ? "um milhão" : `${ate999(milhoes)} milhões`);
  if (milhares) parts.push(milhares === 1 ? "mil" : `${ate999(milhares)} mil`);
  if (resto) parts.push(ate999(resto));
  const joinWithE = resto > 0 && (resto < 100 || resto % 100 === 0);
  return parts.join(joinWithE ? " e " : " ");
}

export function valorPorExtenso(value: number) {
  const rounded = Math.round(value * 100);
  const reais = Math.floor(rounded / 100);
  const centavos = rounded % 100;
  const de = reais >= 1_000_000 && reais % 1_000_000 === 0 ? " de" : "";
  const realText = `${inteiroPorExtenso(reais)}${de} ${reais === 1 ? "real" : "reais"}`;
  return centavos ? `${realText} e ${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}` : realText;
}
export async function fallbackLogo() {
  const response = await fetch("/app-icon.png");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
  });
}

export async function imageUrlToDataUrl(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
  });
}
