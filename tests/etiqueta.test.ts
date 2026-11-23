import { describe, expect, it } from "vitest";
import {
  A4,
  TAMANHOS,
  formatTelefone,
  posicaoUnica,
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
  it("uma etiqueta única, centralizada e dentro da A4 para cada tamanho", () => {
    for (const t of ["grande", "media", "pequena"] as const) {
      const p = posicaoUnica(t);
      expect(p.w).toBe(TAMANHOS[t].w);
      expect(p.h).toBe(TAMANHOS[t].h);
      expect(p.x).toBeCloseTo((A4.w - p.w) / 2, 6);
      expect(p.y).toBeCloseTo((A4.h - p.h) / 2, 6);
      expect(p.x).toBeGreaterThan(0);
      expect(p.y).toBeGreaterThan(0);
      expect(p.x + p.w).toBeLessThan(A4.w);
      expect(p.y + p.h).toBeLessThan(A4.h);
    }
    expect(TAMANHOS.pequena.w).toBe(70);
  });
  it("tamanhos continuam os mesmos", () => {
    expect([TAMANHOS.grande.h, TAMANHOS.media.h, TAMANHOS.pequena.h]).toEqual([148, 74, 59]);
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

import { linhasDestinatario as ld } from "@/lib/etiqueta";
import { test as t2, expect as e2 } from "vitest";
t2("etiqueta mostra CNPJ do cliente", () => {
  e2(ld({ cnpj: "46.696.388/0001-08" })).toEqual([{ rotulo: "CNPJ:", valor: "46.696.388/0001-08" }]);
});
