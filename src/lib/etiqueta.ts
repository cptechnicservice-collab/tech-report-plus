export type EnderecoEtiqueta = {
  nome?: string | null;
  razao_social?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  telefone?: string | null;
};

export type LinhaEtiqueta = { rotulo: string; valor: string; destaque?: boolean };

const clean = (value?: string | null) => (value ?? "").trim();

export function maskCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function normalizeUf(value: string) {
  return value
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

export function cidadeUf(cidade?: string | null, uf?: string | null) {
  return [clean(cidade), clean(uf).toUpperCase()].filter(Boolean).join(" – ");
}

function enderecoLinha(e: EnderecoEtiqueta) {
  const rua = clean(e.logradouro);
  const numero = clean(e.numero);
  const complemento = clean(e.complemento);
  let linha = rua;
  if (numero) linha = linha ? `${linha}, nº ${numero}` : `nº ${numero}`;
  if (complemento) linha = linha ? `${linha} – ${complemento}` : complemento;
  return linha;
}

export function formatTelefone(value?: string | null) {
  const raw = clean(value);
  let d = raw.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

export type TamanhoEtiqueta = "grande" | "media" | "pequena";

export const TAMANHOS: Record<
  TamanhoEtiqueta,
  { label: string; descricao: string; w: number; h: number }
> = {
  grande: { label: "Grande", descricao: "10 × 14,8 cm", w: 100, h: 148 },
  media: { label: "Média", descricao: "10 × 7,4 cm", w: 100, h: 74 },
  pequena: { label: "Pequena", descricao: "7 × 5,9 cm", w: 70, h: 59 },
};
export const TAMANHO_PADRAO: TamanhoEtiqueta = "media";
export const A4 = { w: 210, h: 297 };

export type PosicaoEtiqueta = { x: number; y: number; w: number; h: number };

/** The single label, centered on an A4 sheet: the user cuts it out by hand. */
export function posicaoUnica(t: TamanhoEtiqueta): PosicaoEtiqueta {
  const { w, h } = TAMANHOS[t];
  return { x: (A4.w - w) / 2, y: (A4.h - h) / 2, w, h };
}

export function linhasDestinatario(e: EnderecoEtiqueta, abreviar = false): LinhaEtiqueta[] {
  const cep = clean(e.cep) ? maskCep(clean(e.cep)) : "";
  return [
    { rotulo: abreviar ? "End.:" : "Endereço:", valor: enderecoLinha(e) },
    { rotulo: "Bairro:", valor: clean(e.bairro) },
    { rotulo: abreviar ? "Cid/UF:" : "Cidade/UF:", valor: cidadeUf(e.cidade, e.uf) },
    { rotulo: "CEP:", valor: cep, destaque: true },
    { rotulo: abreviar ? "Tel.:" : "Telefone:", valor: formatTelefone(e.telefone) },
    { rotulo: "Empresa:", valor: clean(e.razao_social) },
  ].filter((linha) => linha.valor);
}

export type RemetenteEtiqueta = EnderecoEtiqueta & {
  contato?: string | null;
  email?: string | null;
};
export type LinhaRemetente = { texto: string; negrito?: boolean };

export function linhasRemetente(e: RemetenteEtiqueta, incluirEmail = true): LinhaRemetente[] {
  const cep = clean(e.cep) ? `CEP ${maskCep(clean(e.cep))}` : "";
  const cidCep = [cidadeUf(e.cidade, e.uf), cep].filter(Boolean).join("  ·  ");
  const tel = formatTelefone(e.telefone);
  const nome = clean(e.nome).toUpperCase();
  const contato = clean(e.contato);
  return [
    { texto: nome, negrito: true },
    { texto: contato && contato.toUpperCase() !== nome ? contato : "" },
    { texto: enderecoLinha(e) },
    { texto: clean(e.bairro) },
    { texto: cidCep },
    { texto: tel ? `Tel.: ${tel}` : "" },
    { texto: incluirEmail ? clean(e.email) : "" },
  ].filter((l) => l.texto);
}

export function remetenteSemEndereco(e: EnderecoEtiqueta) {
  return !clean(e.logradouro) && !clean(e.cidade) && !clean(e.cep);
}

export function enderecoIncompleto(e: EnderecoEtiqueta) {
  return (
    !clean(e.logradouro) ||
    !clean(e.cidade) ||
    !clean(e.uf) ||
    clean(e.cep).replace(/\D/g, "").length !== 8
  );
}

export type ViaCepResult = {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
};

/** Fills only empty fields, never overwriting what the user typed. */
export function mergeViaCep<
  T extends { logradouro: string; bairro: string; cidade: string; uf: string },
>(current: T, data: ViaCepResult): T {
  if (data.erro) return current;
  return {
    ...current,
    logradouro: current.logradouro.trim() ? current.logradouro : (data.logradouro ?? ""),
    bairro: current.bairro.trim() ? current.bairro : (data.bairro ?? ""),
    cidade: current.cidade.trim() ? current.cidade : (data.localidade ?? ""),
    uf: current.uf.trim() ? current.uf : (data.uf ?? "").toUpperCase(),
  };
}

export async function buscarCep(cep: string): Promise<ViaCepResult | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8 || (typeof navigator !== "undefined" && !navigator.onLine)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as ViaCepResult;
  } catch {
    return null;
  }
}
