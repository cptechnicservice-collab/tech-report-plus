import { describe, expect, test } from "vitest";
import { calcularTotais, diffMinutes, somarTotais, toMinutes, validarApontamento } from "../src/lib/apontamentos";
import { assertApontamentoValid } from "../src/lib/apontamento-validation";

describe("Durações compartilhadas", () => {
  test("viagens e trabalho atravessam a meia-noite", () => {
    expect(diffMinutes("23:00", "01:00")).toBe(120);
    expect(diffMinutes("23:00:00", "01:00:00")).toBe(120);
    expect(calcularTotais({ trabalho_inicio: "22:00", trabalho_fim: "02:00", intervalo_inicio: "23:45", intervalo_fim: "00:15", viagem_ida_saida: "23:00", viagem_ida_chegada: "01:00", viagem_volta_saida: "23:30", viagem_volta_chegada: "00:30" })).toEqual({ trabalho: 210, viagem: 180, km: 0 });
  });
  test("intervalo após a meia-noite e totais de histórico/painel", () => {
    const record = { trabalho_inicio: "22:00", trabalho_fim: "03:00", intervalo_inicio: "01:00", intervalo_fim: "01:30", km_ida: 12, km_volta: 8 };
    expect(calcularTotais(record).trabalho).toBe(270);
    expect(somarTotais([record, record])).toEqual({ trabalho: 540, viagem: 0, km: 40 });
    expect(diffMinutes("08:00", "17:00")).toBe(540);
    expect(diffMinutes(null, "01:00")).toBe(0);
    expect(toMinutes("25:00")).toBeNull();
  });
});

describe("Validações de salvamento", () => {
  test("trabalho igual bloqueia, vazio e noturno continuam permitidos", () => {
    expect(() => assertApontamentoValid({ trabalho_inicio: "08:00", trabalho_fim: "08:00:00" })).toThrow("diferente");
    expect(validarApontamento({ trabalho_inicio: "08:00", trabalho_fim: "08:00" }).trabalhoHorariosIguais).toBe(true);
    expect(() => assertApontamentoValid({ trabalho_inicio: null, trabalho_fim: null })).not.toThrow();
    expect(() => assertApontamentoValid({ trabalho_inicio: "23:00", trabalho_fim: "01:00" })).not.toThrow();
  });
  test("odômetro final nunca pode retroceder", () => {
    expect(() => assertApontamentoValid({ km_inicial: 200, km_final: 199 })).toThrow("KM final");
    expect(validarApontamento({ km_inicial: 200, km_final: 199 }).kmInvalido).toBe(true);
    expect(() => assertApontamentoValid({ km_inicial: 200, km_final: 200 })).not.toThrow();
    expect(() => assertApontamentoValid({ km_inicial: null, km_final: 10 })).not.toThrow();
    expect(() => assertApontamentoValid({ km_ida: NaN })).toThrow();
  });
});

describe("Quilometragem", () => {
  test("prioriza ida/volta, depois total legado, depois odômetro", () => {
    expect(calcularTotais({ km_ida: 12, km_volta: 8, km_total: 90, km_inicial: 0, km_final: 100 }).km).toBe(20);
    expect(calcularTotais({ km_ida: 0, km_total: 90 }).km).toBe(0);
    expect(calcularTotais({ km_total: 90, km_inicial: 0, km_final: 100 }).km).toBe(90);
    expect(calcularTotais({ km_inicial: 100, km_final: 123.5 }).km).toBe(23.5);
    expect(calcularTotais({ km_inicial: 100, km_final: 99 }).km).toBe(0);
    expect(calcularTotais({}).km).toBe(0);
  });
});