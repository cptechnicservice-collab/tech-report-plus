import { describe, expect, test } from "vitest";
import {
  caretAfterDigits,
  cnpjDigits,
  formatCNPJ,
  maskCNPJ,
} from "@/lib/cnpj-mask";

describe("Máscara de CNPJ", () => {
  test("insere os dois pontos, a barra e o traço no número completo", () => {
    expect(formatCNPJ("46696388000108")).toBe("46.696.388/0001-08");
  });

  test.each([
    ["", ""],
    ["4", "4"],
    ["46", "46"],
    ["466", "46.6"],
    ["46696", "46.696"],
    ["466963", "46.696.3"],
    ["46696388", "46.696.388"],
    ["466963880", "46.696.388/0"],
    ["466963880001", "46.696.388/0001"],
    ["4669638800010", "46.696.388/0001-0"],
    ["46696388000108", "46.696.388/0001-08"],
  ])("formata %s progressivamente", (value, expected) => {
    expect(formatCNPJ(value)).toBe(expected);
  });

  test("ignora letras, espaços e dígitos além do décimo quarto", () => {
    expect(cnpjDigits("46.696.388/0001-08 abc")).toBe("46696388000108");
    expect(formatCNPJ("4669638800010899")).toBe("46.696.388/0001-08");
  });

  test("reformatar um valor já mascarado não altera o conteúdo", () => {
    expect(formatCNPJ("46.696.388/0001-08")).toBe("46.696.388/0001-08");
  });

  test("manter 14 dígitos ao digitar não corta o número", () => {
    expect(maskCNPJ("46.696.388/0001-08", "46.696.388/0001-0")).toBe("46.696.388/0001-08");
  });

  test("apagar um separador remove o dígito anterior em vez de travar", () => {
    expect(maskCNPJ("46.696.388/000108", "46.696.388/0001-08")).toBe("46.696.388/0001-0");
    expect(maskCNPJ("46.696.3880001-08", "46.696.388/0001-08")).toBe("46.696.388/0001-0");
  });

  test("o cursor fica logo após o dígito digitado", () => {
    const masked = "46.696.388/0001-08";
    expect(caretAfterDigits(masked, 2)).toBe(2);
    expect(caretAfterDigits(masked, 3)).toBe(4);
    expect(caretAfterDigits(masked, 14)).toBe(18);
    expect(caretAfterDigits(masked, 0)).toBe(0);
  });
});
