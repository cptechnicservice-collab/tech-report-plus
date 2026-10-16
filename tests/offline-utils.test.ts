import { describe, expect, it } from "vitest";

import { isNetworkError } from "@/lib/offline.utils";

describe("isNetworkError", () => {
  it("reconhece o AbortError do Safari como erro de rede", () => {
    expect(isNetworkError(new Error("AbortError: Fetch is aborted"))).toBe(true);
  });

  it("reconhece falhas comuns de conexão", () => {
    expect(isNetworkError(new Error("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("Load failed"))).toBe(true);
    expect(isNetworkError(new DOMException("The operation was aborted", "AbortError"))).toBe(true);
  });

  it("não trata erros de validação como rede", () => {
    expect(isNetworkError(new Error("km_final deve ser maior ou igual a km_inicial"))).toBe(false);
  });
});
