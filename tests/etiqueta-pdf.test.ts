import { describe, expect, it } from "vitest";
import { ajustarEtiqueta, buildEtiquetaPdf } from "@/lib/pdf-etiqueta";
import {
  posicaoUnica,
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

/** Box real impresso pela folha: a etiqueta centralizada, menos a margem de 1 mm. */
function boxReal(t: TamanhoEtiqueta) {
  const c = posicaoUnica(t);
  return { x: c.x + 1, y: c.y + 1, w: c.w - 2, h: c.h - 2 };
}

describe("montagem do PDF de etiqueta", () => {
  for (const t of TAMANHOS_TESTE) {
    it(`o conteúdo cabe na etiqueta ${t}`, async () => {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const fit = ajustarEtiqueta(doc, boxReal(t), dest, rem, t);
      expect(fit.fits).toBe(true);
    });
  }

  it("sempre uma única folha, com uma só etiqueta, em qualquer tamanho", async () => {
    for (const t of TAMANHOS_TESTE) {
      const doc = await buildEtiquetaPdf(dest, rem, { tamanho: t });
      expect(doc.getNumberOfPages()).toBe(1);
      // O PDF não é comprimido: dá para contar quantas etiquetas foram desenhadas.
      const pdf = Buffer.from(doc.output("arraybuffer")).toString("latin1");
      expect((pdf.match(/DESTINAT/g) ?? []).length).toBe(1);
      expect((pdf.match(/REMETENTE/g) ?? []).length).toBe(1);
    }
  });
});
