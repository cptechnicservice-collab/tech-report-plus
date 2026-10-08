export type ReportPartItem = {
  id: string;
  descricao: string;
  codigo: string | null;
  unidade: string;
  preco: number;
  quantidade: number;
  foto_data_url?: string | null;
};
