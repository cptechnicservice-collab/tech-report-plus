import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, "Horário inválido").nullable().optional();
const km = z.number().finite("Quilometragem inválida").nonnegative("Quilometragem não pode ser negativa").nullable().optional();

export const apontamentoValidationSchema = z.object({
  trabalho_inicio: time,
  trabalho_fim: time,
  intervalo_inicio: time,
  intervalo_fim: time,
  viagem_ida_saida: time,
  viagem_ida_chegada: time,
  viagem_volta_saida: time,
  viagem_volta_chegada: time,
  km_inicial: km,
  km_final: km,
  km_ida: km,
  km_volta: km,
  pedagio: z.number().finite("Pedágio inválido").nonnegative("Pedágio não pode ser negativo").nullable().optional(),
  outras_despesas: z.number().finite("Outras despesas inválidas").nonnegative("Outras despesas não podem ser negativas").nullable().optional(),
}).superRefine((value, context) => {
  if (value.km_inicial != null && value.km_final != null && value.km_final < value.km_inicial) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["km_final"], message: "KM final deve ser maior ou igual ao KM inicial." });
  }
  if (value.trabalho_inicio && value.trabalho_fim && value.trabalho_inicio.slice(0, 5) === value.trabalho_fim.slice(0, 5)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["trabalho_fim"], message: "O fim do trabalho deve ser diferente do início." });
  }
});

export function assertApontamentoValid(value: unknown): void {
  const result = apontamentoValidationSchema.safeParse(value);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Apontamento inválido.");
}