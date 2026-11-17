import { describe, expect, it } from "vitest";
import { dataInicialDoAgendamento, proximoAgendamento } from "@/lib/agenda-apontamento";

describe("dataInicialDoAgendamento", () => {
  it("usa a data do agendamento de um único dia", () => {
    expect(dataInicialDoAgendamento({ data: "2026-11-20", data_fim: null }, "2026-11-17")).toBe("2026-11-20");
  });
  it("usa hoje quando está dentro do período", () => {
    expect(dataInicialDoAgendamento({ data: "2026-11-15", data_fim: "2026-11-19" }, "2026-11-17")).toBe("2026-11-17");
  });
  it("usa a data inicial quando hoje está fora do período", () => {
    expect(dataInicialDoAgendamento({ data: "2026-11-20", data_fim: "2026-11-22" }, "2026-11-17")).toBe("2026-11-20");
  });
});

describe("proximoAgendamento", () => {
  it("ignora passados e concluídos e escolhe o mais próximo", () => {
    const lista = [
      { id: "a", data: "2026-11-10", data_fim: null, horario: null, concluido: false },
      { id: "b", data: "2026-11-18", data_fim: null, horario: null, concluido: true },
      { id: "c", data: "2026-11-25", data_fim: null, horario: null, concluido: false },
      { id: "d", data: "2026-11-19", data_fim: null, horario: "08:00", concluido: false },
    ];
    expect(proximoAgendamento(lista, "2026-11-17")?.id).toBe("d");
  });
});
