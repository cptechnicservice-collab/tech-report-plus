import { calcularTotais, type Apontamento } from "@/lib/apontamentos";

export type ValorVigencia = {
  id: string;
  vigencia: string;
  valor_hora_trabalhada: number;
  valor_hora_viagem: number;
  valor_km: number;
  valor_diaria_inteira: number;
  valor_meia_diaria: number;
  created_at: string;
  updated_at: string;
  user_id: string | null;
};

export type TotaisFinanceiros = {
  horasTrabalhadas: number;
  horasViagem: number;
  km: number;
  diariasInteiras: number;
  meiasDiarias: number;
  valorTrabalho: number;
  valorViagem: number;
  valorKm: number;
  valorDiariasInteiras: number;
  valorMeiasDiarias: number;
  valorDiarias: number;
  pedagios: number;
  outrasDespesas: number;
  totalGeral: number;
};

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const formatDecimalHours = (minutes: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minutes / 60);

export function valorVigente(data: string, valores: ValorVigencia[]) {
  return [...valores]
    .filter((valor) => valor.vigencia <= data)
    .sort((a, b) => `${b.vigencia}${b.created_at}`.localeCompare(`${a.vigencia}${a.created_at}`))[0] ?? null;
}

export type LinhaRefeicao = {
  descricao: string;
  quantidade: number;
  unitario: number;
  total: number;
};

// A diária inteira cobre almoço + janta; a meia diária cobre só o almoço.
// As linhas derivam os valores unitários dos totais já calculados, preservando o total das diárias.
export function linhasRefeicoes(
  financeiro: Pick<TotaisFinanceiros, "diariasInteiras" | "meiasDiarias" | "valorDiariasInteiras" | "valorMeiasDiarias">,
  tarifa?: Pick<ValorVigencia, "valor_diaria_inteira" | "valor_meia_diaria"> | null,
): LinhaRefeicao[] {
  const inteiras = financeiro.diariasInteiras;
  const meias = financeiro.meiasDiarias;
  if (inteiras <= 0 && meias <= 0) return [];
  const unitInteira = inteiras > 0 ? financeiro.valorDiariasInteiras / inteiras : null;
  const almoco = (meias > 0 ? financeiro.valorMeiasDiarias / meias : null)
    ?? (tarifa ? tarifa.valor_meia_diaria : null)
    ?? (unitInteira !== null ? unitInteira / 2 : null);
  if (almoco === null || !Number.isFinite(almoco) || almoco < 0) return [];
  const linhas: LinhaRefeicao[] = [{
    descricao: "Almoço (alimentação)",
    quantidade: inteiras + meias,
    unitario: almoco,
    total: almoco * (inteiras + meias),
  }];
  if (inteiras > 0) {
    const janta = (unitInteira !== null ? unitInteira - almoco : null)
      ?? (tarifa ? tarifa.valor_diaria_inteira - tarifa.valor_meia_diaria : null);
    if (janta === null || !Number.isFinite(janta) || janta < 0) return [];
    linhas.push({ descricao: "Janta (alimentação)", quantidade: inteiras, unitario: janta, total: janta * inteiras });
  }
  return linhas;
}

export function calcularValoresPeriodo(
  apontamentos: Partial<Apontamento>[],
  valores: ValorVigencia[],
): TotaisFinanceiros {
  const total = apontamentos.reduce<TotaisFinanceiros>((acc, apontamento) => {
    const quantidades = calcularTotais(apontamento);
    const tarifa = valorVigente(apontamento.data ?? "", valores);
    const diariaTipo = apontamento.diaria_tipo ?? "nenhuma";
    const valorDiaria = diariaTipo === "inteira"
      ? (tarifa?.valor_diaria_inteira ?? 0)
      : diariaTipo === "meia"
        ? (tarifa?.valor_meia_diaria ?? 0)
        : 0;

    acc.horasTrabalhadas += quantidades.trabalho;
    acc.horasViagem += quantidades.viagem;
    acc.km += quantidades.km;
    acc.diariasInteiras += diariaTipo === "inteira" ? 1 : 0;
    acc.meiasDiarias += diariaTipo === "meia" ? 1 : 0;
    acc.valorTrabalho += (quantidades.trabalho / 60) * (tarifa?.valor_hora_trabalhada ?? 0);
    acc.valorViagem += (quantidades.viagem / 60) * (tarifa?.valor_hora_viagem ?? 0);
    acc.valorKm += quantidades.km * (tarifa?.valor_km ?? 0);
    acc.valorDiariasInteiras += diariaTipo === "inteira" ? valorDiaria : 0;
    acc.valorMeiasDiarias += diariaTipo === "meia" ? valorDiaria : 0;
    acc.valorDiarias += valorDiaria;
    acc.pedagios += Number.isFinite(apontamento.pedagio) ? (apontamento.pedagio ?? 0) : 0;
    acc.outrasDespesas += Number.isFinite(apontamento.outras_despesas) ? (apontamento.outras_despesas ?? 0) : 0;
    return acc;
  }, {
    horasTrabalhadas: 0,
    horasViagem: 0,
    km: 0,
    diariasInteiras: 0,
    meiasDiarias: 0,
    valorTrabalho: 0,
    valorViagem: 0,
    valorKm: 0,
    valorDiariasInteiras: 0,
    valorMeiasDiarias: 0,
    valorDiarias: 0,
    pedagios: 0,
    outrasDespesas: 0,
    totalGeral: 0,
  });

  total.totalGeral = total.valorTrabalho + total.valorViagem + total.valorKm +
    total.valorDiarias + total.pedagios + total.outrasDespesas;
  return total;
}