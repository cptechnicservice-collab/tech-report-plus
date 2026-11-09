// Pure helpers describing WHICH time span a financial total covers.
// Kept free of data fetching so screens and tests can reuse the same wording.

export type RelatorioPeriodo = { inicio: string; fim: string };

export type CoberturaPeriodo = {
  /** First day covered, ISO `YYYY-MM-DD`. */
  inicio: string;
  /** Last day covered, ISO `YYYY-MM-DD`. */
  fim: string;
  /** How many records produced the total. */
  relatorios: number;
  /** Inclusive day count between the two dates. */
  dias: number;
  /** Human duration: `9 dias`, `8 meses`, `1 ano e 7 meses`. */
  duracao: string;
  /** `12/03/2025 a 08/11/2026`. */
  intervalo: string;
  /** Full sentence explaining the total, e.g. `Total de 18 relatórios de 12/03/2025 a 08/11/2026 — 1 ano e 7 meses`. */
  frase: string;
};

function parseISO(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y: y || 1970, m: m || 1, d: d || 1 };
}

function toUTC(iso: string) {
  const { y, m, d } = parseISO(iso);
  return Date.UTC(y, m - 1, d);
}

function formatDateBR(iso: string) {
  const { y, m, d } = parseISO(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** Whole-month and day span between two ISO dates, in readable Portuguese. */
export function duracaoEntre(inicio: string, fim: string): string {
  let a = inicio;
  let b = fim;
  if (toUTC(b) < toUTC(a)) [a, b] = [b, a];
  const inicioData = parseISO(a);
  const fimData = parseISO(b);

  let meses = (fimData.y - inicioData.y) * 12 + (fimData.m - inicioData.m);
  if (fimData.d < inicioData.d) meses -= 1;

  if (meses < 1) {
    const dias = Math.round((toUTC(b) - toUTC(a)) / 86_400_000) + 1;
    return `${dias} ${dias === 1 ? "dia" : "dias"}`;
  }
  if (meses < 12) return `${meses} ${meses === 1 ? "mês" : "meses"}`;

  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const textoAnos = `${anos} ${anos === 1 ? "ano" : "anos"}`;
  if (resto === 0) return textoAnos;
  return `${textoAnos} e ${resto} ${resto === 1 ? "mês" : "meses"}`;
}

/** Coverage of a set of records; `null` when there is nothing to describe. */
export function coberturaPeriodo(relatorios: RelatorioPeriodo[]): CoberturaPeriodo | null {
  const validos = relatorios.filter((item) => typeof item.inicio === "string" && typeof item.fim === "string" && item.inicio.length >= 10 && item.fim.length >= 10);
  if (validos.length === 0) return null;

  let inicio = validos[0]?.inicio.slice(0, 10) ?? "";
  let fim = validos[0]?.fim.slice(0, 10) ?? "";
  validos.forEach((item) => {
    const a = item.inicio.slice(0, 10);
    const b = item.fim.slice(0, 10);
    if (toUTC(a) < toUTC(inicio)) inicio = a;
    if (toUTC(b) > toUTC(fim)) fim = b;
  });
  if (!inicio || !fim) return null;

  const dias = Math.round((toUTC(fim) - toUTC(inicio)) / 86_400_000) + 1;
  const duracao = duracaoEntre(inicio, fim);
  const intervalo = `${formatDateBR(inicio)} a ${formatDateBR(fim)}`;
  const frase = `Total de ${validos.length} ${validos.length === 1 ? "relatório" : "relatórios"} de ${intervalo} — ${duracao}`;

  return { inicio, fim, relatorios: validos.length, dias, duracao, intervalo, frase };
}
