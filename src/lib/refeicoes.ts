export type DiariaTipo = "nenhuma" | "meia" | "inteira" | "janta";

export function selecionarRefeicao(tipo: DiariaTipo, refeicao: "almoco" | "janta", selecionada: boolean): DiariaTipo {
  const almoco = refeicao === "almoco" ? selecionada : tipo === "meia" || tipo === "inteira";
  const janta = refeicao === "janta" ? selecionada : tipo === "janta" || tipo === "inteira";
  return almoco ? (janta ? "inteira" : "meia") : (janta ? "janta" : "nenhuma");
}