import { describe, expect, it } from "vitest";
import { cidadeUf, enderecoIncompleto, linhasDestinatario, linhasRemetente, maskCep, mergeViaCep } from "@/lib/etiqueta";

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
    const linhas = linhasDestinatario({ logradouro: "Rua A", numero: "10", complemento: "", cidade: "Chapecó", uf: "SC", cep: "89801000", telefone: " " });
    expect(linhas.map((l) => l.rotulo)).toEqual(["Endereço:", "Cidade/UF:", "CEP:"]);
    expect(linhas[0]?.valor).toBe("Rua A, nº 10");
    expect(linhas[2]?.valor).toBe("89801-000");
  });
  it("mostra empresa só quando há razão social", () => {
    expect(linhasDestinatario({ razao_social: "ACME LTDA" }).map((l) => l.rotulo)).toEqual(["Empresa:"]);
  });
  it("monta remetente resumido", () => {
    expect(linhasRemetente({ logradouro: "Rua B", numero: "5", bairro: "Centro", cidade: "Xaxim", uf: "SC", cep: "89825000" }))
      .toEqual(["Rua B, nº 5 – Centro", "Xaxim – SC", "CEP 89825-000"]);
  });
  it("ViaCEP não sobrescreve o que foi digitado", () => {
    const r = mergeViaCep({ logradouro: "Minha rua", bairro: "", cidade: "", uf: "" }, { logradouro: "Outra", bairro: "Centro", localidade: "Xaxim", uf: "sc" });
    expect(r).toEqual({ logradouro: "Minha rua", bairro: "Centro", cidade: "Xaxim", uf: "SC" });
  });
  it("detecta endereço incompleto", () => {
    expect(enderecoIncompleto({ logradouro: "Rua", cidade: "X", uf: "SC", cep: "89801-000" })).toBe(false);
    expect(enderecoIncompleto({ logradouro: "Rua", cidade: "X", uf: "SC" })).toBe(true);
  });
});
