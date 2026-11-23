import { describe, expect, it } from "vitest";
import { ajustarEtiqueta, buildEtiquetaPdf } from "@/lib/pdf-etiqueta";
import {
  porFolha,
  type EnderecoEtiqueta,
  type RemetenteEtiqueta,
  type TamanhoEtiqueta,
} from "@/lib/etiqueta";

// Conteúdo propositalmente longo: é o pior caso de espaço na etiqueta.
const dest: EnderecoEtiqueta = {
  nome: "Incolar Indústria de Colchões Ltda",
  razao_social: "Incolar Indústria e Comércio de Colchões Ltda ME",
  logradouro: "Avenida das Indústrias das Américas",
  numero: "1875",
  complemento: "Galpão 12 - Bloco B - Pavimento superior",
  bairro: "Distrito Industrial Ministro Salgado Filho",
  cidade: "Chapecó",
  uf: "SC",
  cep: "89801000",
  telefone: "54991291187",
};

const rem: RemetenteEtiqueta = {
  nome: "CP-Technic HOMAG",
  contato: "Clarel Pavan",
  email: "cptechnicservice@gmail.com",
  logradouro: "Rua das Palmeiras Imperiais",
  numero: "245",
  complemento: "Sala 3",
  bairro: "Centro",
  cidade: "Xaxim",
  uf: "SC",
  cep: "89825000",
  telefone: "54991291187",
};

const TAMANHOS_TESTE: TamanhoEtiqueta[] = ["grande", "media", "pequena"];

describe("montagem do PDF de etiqueta", () => {
  for (const t of TAMANHOS_TESTE) {
    it(`o conteúdo cabe na etiqueta ${t}`, async () => {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const fit = ajustarEtiqueta(doc, { x: 6, y: 6, w: 100, h: 74 }, dest, rem, t);
      expect(fit.fits).toBe(true);
    });
  }

  it("gera uma folha A4 por tamanho, com a quantidade pedida", async () => {
    for (const t of TAMANHOS_TESTE) {
      const doc = await buildEtiquetaPdf(dest, rem, { tamanho: t, quantidade: porFolha(t) });
      expect(doc.getNumberOfPages()).toBe(1);
    }
  });

  it("passa para a segunda folha quando passa de uma folha", async () => {
    for (const t of TAMANHOS_TESTE) {
      const doc = await buildEtiquetaPdf(dest, rem, { tamanho: t, quantidade: porFolha(t) + 2 });
      expect(doc.getNumberOfPages()).toBe(2);
    }
  });

  it("começa na posição escolhida sem perder etiquetas", async () => {
    const doc = await buildEtiquetaPdf(dest, rem, { tamanho: "media", quantidade: 3, inicio: 7 });
    expect(doc.getNumberOfPages()).toBe(2);
  });
});
