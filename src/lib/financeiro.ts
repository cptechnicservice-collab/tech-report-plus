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
    acc.pedagios += apontamento.pedagio ?? 0;
    acc.outrasDespesas += apontamento.outras_despesas ?? 0;
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