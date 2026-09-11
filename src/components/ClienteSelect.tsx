import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { Cliente } from "@/lib/apontamentos";

export function ClienteSelect({
  clientes,
  value,
  onChange,
  recentIds = [],
}: {
  clientes: Cliente[];
  value: string | null;
  onChange: (id: string) => void;
  recentIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const queryClient = useQueryClient();

  const ativos = useMemo(() => clientes.filter((c) => c.ativo), [clientes]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = termo
      ? ativos.filter(
          (c) =>
            c.nome.toLowerCase().includes(termo) ||
            (c.cidade ?? "").toLowerCase().includes(termo),
        )
      : ativos;
    const rank = (id: string) => {
      const i = recentIds.indexOf(id);
      return i === -1 ? 999 : i;
    };
    return [...filtrados].sort((a, b) => rank(a.id) - rank(b.id) || a.nome.localeCompare(b.nome));
  }, [ativos, busca, recentIds]);

  const selecionado = clientes.find((c) => c.id === value) ?? null;

  const criar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .insert({ nome: nome.trim(), cidade: cidade.trim() || null })
        .select()
        .single();
      if (error) throw error;
      return data as Cliente;
    },
    onSuccess: (cliente) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      onChange(cliente.id);
      setNome("");
      setCidade("");
      setNovoAberto(false);
      setOpen(false);
      toast.success("Cliente cadastrado");
    },
    onError: () => toast.error("Não foi possível cadastrar o cliente"),
  });

  return (
    <div className="space-y-2">
      <Label>Cliente</Label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-input bg-background px-4 py-3.5 text-left text-base"
      >
        <span className={selecionado ? "min-w-0 truncate" : "text-muted-foreground"}>
          {selecionado ? selecionado.nome : "Selecionar cliente"}
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md gap-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle>Clientes ativos</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar cliente ou cidade"
              className="h-12 rounded-xl pl-9"
            />
          </div>

          <div className="max-h-64 space-y-1 overflow-y-auto">
            {lista.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum cliente encontrado.
              </p>
            ) : (
              lista.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-secondary"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.nome}</span>
                    {c.cidade ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.cidade}
                      </span>
                    ) : null}
                  </span>
                  {value === c.id ? <Check className="h-5 w-5 shrink-0 text-primary" /> : null}
                </button>
              ))
            )}
          </div>

          {novoAberto ? (
            <div className="space-y-3 rounded-xl bg-secondary/60 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="novo-nome">Nome do cliente</Label>
                <Input
                  id="novo-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="h-12 rounded-xl bg-card"
                  placeholder="Ex.: LEO MADEIRA BRASILIA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="novo-cidade">Cidade (opcional)</Label>
                <Input
                  id="novo-cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className="h-12 rounded-xl bg-card"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="h-12 flex-1 rounded-xl"
                  disabled={!nome.trim() || criar.isPending}
                  onClick={() => criar.mutate()}
                >
                  Salvar cliente
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 rounded-xl"
                  onClick={() => setNovoAberto(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full rounded-xl"
              onClick={() => setNovoAberto(true)}
            >
              <Plus className="mr-1 h-5 w-5" /> Novo cliente
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
