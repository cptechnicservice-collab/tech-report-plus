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
  return value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
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

export function linhasDestinatario(e: EnderecoEtiqueta): LinhaEtiqueta[] {
  const cep = clean(e.cep) ? maskCep(clean(e.cep)) : "";
  return [
    { rotulo: "Endereço:", valor: enderecoLinha(e) },
    { rotulo: "Bairro:", valor: clean(e.bairro) },
    { rotulo: "Cidade/UF:", valor: cidadeUf(e.cidade, e.uf) },
    { rotulo: "CEP:", valor: cep, destaque: true },
    { rotulo: "Telefone:", valor: clean(e.telefone) },
    { rotulo: "Empresa:", valor: clean(e.razao_social) },
  ].filter((linha) => linha.valor);
}

export function linhasRemetente(e: EnderecoEtiqueta): string[] {
  const rua = [clean(e.logradouro), clean(e.numero) ? `nº ${clean(e.numero)}` : ""].filter(Boolean).join(", ");
  const enderecoResumo = [rua, clean(e.bairro)].filter(Boolean).join(" – ");
  const cep = clean(e.cep) ? `CEP ${maskCep(clean(e.cep))}` : "";
  const tel = clean(e.telefone) ? `Telefone: ${clean(e.telefone)}` : "";
  return [enderecoResumo, cidadeUf(e.cidade, e.uf), cep, tel].filter(Boolean);
}

export function enderecoIncompleto(e: EnderecoEtiqueta) {
  return !clean(e.logradouro) || !clean(e.cidade) || !clean(e.uf) || clean(e.cep).replace(/\D/g, "").length !== 8;
}

export type ViaCepResult = { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean | string };

/** Fills only empty fields, never overwriting what the user typed. */
export function mergeViaCep<T extends { logradouro: string; bairro: string; cidade: string; uf: string }>(current: T, data: ViaCepResult): T {
  if (data.erro) return current;
  return {
    ...current,
    logradouro: current.logradouro.trim() ? current.logradouro : data.logradouro ?? "",
    bairro: current.bairro.trim() ? current.bairro : data.bairro ?? "",
    cidade: current.cidade.trim() ? current.cidade : data.localidade ?? "",
    uf: current.uf.trim() ? current.uf : (data.uf ?? "").toUpperCase(),
  };
}

export async function buscarCep(cep: string): Promise<ViaCepResult | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8 || (typeof navigator !== "undefined" && !navigator.onLine)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as ViaCepResult;
  } catch {
    return null;
  }
}
