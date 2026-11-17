import type { Agendamento } from "@/lib/agenda";

/** Data sugerida ao iniciar um apontamento a partir de um agendamento. */
export function dataInicialDoAgendamento(ag: Pick<Agendamento, "data" | "data_fim">, hoje: string): string {
  const fim = ag.data_fim && ag.data_fim > ag.data ? ag.data_fim : null;
  if (!fim) return ag.data;
  return hoje >= ag.data && hoje <= fim ? hoje : ag.data;
}

/** Próximo agendamento não concluído de hoje em diante (períodos em andamento contam). */
export function proximoAgendamento<T extends Pick<Agendamento, "data" | "data_fim" | "horario" | "concluido">>(lista: T[], hoje: string): T | null {
  const candidatos = lista.filter((a) => !a.concluido && (a.data_fim && a.data_fim > a.data ? a.data_fim : a.data) >= hoje);
  candidatos.sort((a, b) => {
    const da = a.data < hoje ? hoje : a.data;
    const db = b.data < hoje ? hoje : b.data;
    if (da !== db) return da < db ? -1 : 1;
    return (a.horario ?? "99").localeCompare(b.horario ?? "99");
  });
  return candidatos[0] ?? null;
}
