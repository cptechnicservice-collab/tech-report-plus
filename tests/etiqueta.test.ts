import { describe, expect, it } from "vitest";
import {
  A4,
  TAMANHOS,
  formatTelefone,
  porFolha,
  posicoesEtiquetas,
  cidadeUf,
  enderecoIncompleto,
  linhasDestinatario,
  linhasRemetente,
  maskCep,
  mergeViaCep,
} from "@/lib/etiqueta";

describe("etiqueta de envio", () => {
  it("formata CEP", () => {
    expect(maskCep("89801000")).toBe("89801-000");
    expect(maskCep("89.801-000xx9")).toBe("89801-000");
  });
  it("formata Cidade – UF", () => {
    expect(cidadeUf("Chapecó", "sc")).toBe("Chapecó – SC");
    expect(cidadeUf("Chapecó", "")).toBe("Chapecó");
  });
  it("omite linhas vazias do destinatário", () => {
    const linhas = linhasDestinatario({
      logradouro: "Rua A",
      numero: "10",
      complemento: "",
      cidade: "Chapecó",
      uf: "SC",
      cep: "89801000",
      telefone: " ",
    });
    expect(linhas.map((l) => l.rotulo)).toEqual(["Endereço:", "Cidade/UF:", "CEP:"]);
    expect(linhas[0]?.valor).toBe("Rua A, nº 10");
    expect(linhas[2]?.valor).toBe("89801-000");
  });
  it("mostra empresa só quando há razão social", () => {
    expect(linhasDestinatario({ razao_social: "ACME LTDA" }).map((l) => l.rotulo)).toEqual([
      "Empresa:",
    ]);
  });
  it("monta remetente com nome, contato e telefone formatado", () => {
    const l = linhasRemetente({
      nome: "CP-Technic HOMAG",
      contato: "Clarel Pavan",
      telefone: "54991291187",
      email: "a@b.com",
      cidade: "Xaxim",
      uf: "SC",
      cep: "89825000",
    });
    expect(l.map((x) => x.texto)).toEqual([
      "CP-TECHNIC HOMAG",
      "Clarel Pavan",
      "Xaxim – SC  ·  CEP 89825-000",
      "Tel.: (54) 99129-1187",
      "a@b.com",
    ]);
    expect(l[0]?.negrito).toBe(true);
    expect(linhasRemetente({ nome: "X", email: "a@b.com" }, false).map((x) => x.texto)).toEqual([
      "X",
    ]);
  });
  it("formata telefone fixo e celular", () => {
    expect(formatTelefone("5433221100")).toBe("(54) 3322-1100");
    expect(formatTelefone("54991291187")).toBe("(54) 99129-1187");
  });
  it("grade cabe na A4 para cada tamanho", () => {
    for (const t of ["grande", "media", "pequena"] as const) {
      const pos = posicoesEtiquetas(t, porFolha(t));
      expect(
        pos.every(
          (p) =>
            p.page === 0 &&
            p.x >= 0 &&
            p.y >= 0 &&
            p.x + p.w <= A4.w + 1e-9 &&
            p.y + p.h <= A4.h + 1e-9,
        ),
      ).toBe(true);
    }
    expect([porFolha("grande"), porFolha("media"), porFolha("pequena")]).toEqual([4, 8, 15]);
    expect(TAMANHOS.pequena.w).toBe(70);
  });
  it("respeita posição inicial e quebra página", () => {
    const pos = posicoesEtiquetas("media", 3, 7);
    expect(pos.map((p) => [p.page, p.slot])).toEqual([
      [0, 6],
      [0, 7],
      [1, 0],
    ]);
  });
  it("ViaCEP não sobrescreve o que foi digitado", () => {
    const r = mergeViaCep(
      { logradouro: "Minha rua", bairro: "", cidade: "", uf: "" },
      { logradouro: "Outra", bairro: "Centro", localidade: "Xaxim", uf: "sc" },
    );
    expect(r).toEqual({ logradouro: "Minha rua", bairro: "Centro", cidade: "Xaxim", uf: "SC" });
  });
  it("detecta endereço incompleto", () => {
    expect(enderecoIncompleto({ logradouro: "Rua", cidade: "X", uf: "SC", cep: "89801-000" })).toBe(
      false,
    );
    expect(enderecoIncompleto({ logradouro: "Rua", cidade: "X", uf: "SC" })).toBe(true);
  });
});
