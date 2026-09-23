import { PackagePlus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Peca } from "@/lib/pecas";
import { formatCurrency } from "@/lib/financeiro";

export type SelectedPart = {
  id: string;
  peca_id: string | null;
  descricao: string;
  codigo: string | null;
  unidade: string;
  preco: number;
  foto_data_url: string | null;
  quantidade: number | "";
};

export function PartPicker({ catalog, selectedId, onSelectedIdChange, items, onItemsChange, emptyText = "Nenhuma peça adicionada." }: {
  catalog: Peca[];
  selectedId: string;
  onSelectedIdChange: (value: string) => void;
  items: SelectedPart[];
  onItemsChange: (items: SelectedPart[]) => void;
  emptyText?: string;
}) {
  const add = () => {
    const part = catalog.find((item) => item.id === selectedId);
    if (!part) return;
    const existing = items.find((item) => item.peca_id === part.id);
    onItemsChange(existing
      ? items.map((item) => item.id === existing.id ? { ...item, quantidade: (Number(item.quantidade) || 0) + 1 } : item)
      : [...items, { id: crypto.randomUUID(), peca_id: part.id, descricao: part.descricao, codigo: part.codigo, unidade: part.unidade, preco: part.preco, foto_data_url: part.foto_data_url, quantidade: 1 }]);
    onSelectedIdChange("");
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
        <select value={selectedId} onChange={(event) => onSelectedIdChange(event.target.value)} className="ios-field h-12 min-w-0 border px-3" aria-label="Selecionar peça">
          <option value="">Selecione uma peça</option>
          {catalog.map((part) => <option key={part.id} value={part.id}>{part.descricao} · {formatCurrency(part.preco)}</option>)}
        </select>
        {selectedId ? <Button type="button" size="icon" variant="outline" className="h-12 w-12" aria-label="Limpar peça selecionada" onClick={() => onSelectedIdChange("")}><X className="h-5 w-5" /></Button> : null}
        <Button type="button" size="icon" className="h-12 w-12" aria-label="Adicionar peça" disabled={!selectedId} onClick={add}><PackagePlus className="h-5 w-5" /></Button>
      </div>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">{emptyText}</p> : (
        <ul className="divide-y divide-border">
          {items.map((part) => (
            <li key={part.id} className="grid grid-cols-[minmax(0,1fr)_5rem_2.5rem] items-center gap-2 py-3">
              <div className="flex min-w-0 items-center gap-2">
                {part.foto_data_url ? <img src={part.foto_data_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : null}
                <div className="min-w-0"><p className="truncate text-sm font-medium">{part.descricao}</p><p className="truncate text-xs text-muted-foreground">{formatCurrency(part.preco)} por {part.unidade}</p></div>
              </div>
              <Input type="text" inputMode="decimal" value={part.quantidade} onFocus={(event) => event.currentTarget.select()} onChange={(event) => {
                const value = event.target.value.replace(",", ".");
                if (value === "") onItemsChange(items.map((item) => item.id === part.id ? { ...item, quantidade: "" } : item));
                else if (/^\d*\.?\d*$/.test(value)) onItemsChange(items.map((item) => item.id === part.id ? { ...item, quantidade: Number(value) } : item));
              }} className="h-10 text-right tabular-nums" aria-label={`Quantidade de ${part.descricao}`} />
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-destructive" aria-label={`Remover ${part.descricao}`} onClick={() => onItemsChange(items.filter((item) => item.id !== part.id))}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}