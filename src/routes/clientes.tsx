import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { PageShell, Section } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { fetchClientes, type Cliente } from "@/lib/apontamentos";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — CP TECHNIC Horas" },
      {
        name: "description",
        content: "Cadastre e edite clientes com cidade, CNPJ, contato, telefone e observações.",
      },
      { property: "og:title", content: "Clientes — CP TECHNIC Horas" },
      {
        property: "og:description",
        content: "Cadastro de clientes usado nos apontamentos de horas.",
      },
    ],
  }),
  component: Clientes,
});

type Draft = {
  nome: string;
  cidade: string;
  cnpj: string;
  contato: string;
  telefone: string;
  ativo: boolean;
  observacoes: string;
};

const emptyDraft: Draft = {
  nome: "",
  cidade: "",
  cnpj: "",
  contato: "",
  telefone: "",
  ativo: true,
  observacoes: "",
};

function toDraft(c: Cliente): Draft {
  return {
    nome: c.nome,
    cidade: c.cidade ?? "",
    cnpj: c.cnpj ?? "",
    contato: c.contato ?? "",
    telefone: c.telefone ?? "",
    ativo: c.ativo,
    observacoes: c.observacoes ?? "",
  };
}

function Clientes() {
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const queryClient = useQueryClient();

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: fetchClientes,
  });

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(termo) || (c.cidade ?? "").toLowerCase().includes(termo),
    );
  }, [clientes, busca]);

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: draft.nome.trim(),
        cidade: draft.cidade.trim() || null,
        cnpj: draft.cnpj.trim() || null,
        contato: draft.contato.trim() || null,
        telefone: draft.telefone.trim() || null,
        ativo: draft.ativo,
        observacoes: draft.observacoes.trim() || null,
      };
      if (editando && editando !== "novo") {
        const { error } = await supabase.from("clientes").update(payload).eq("id", editando);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("clientes").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente salvo");
      setEditando(null);
      setDraft(emptyDraft);
    },
    onError: () => toast.error("Não foi possível salvar o cliente"),
  });

  const abrirNovo = () => {
    setDraft(emptyDraft);
    setEditando("novo");
  };

  return (
    <PageShell
      title="Clientes"
      subtitle={`${clientes.length} cadastrado(s)`}
      action={
        <Button className="h-11 rounded-xl" onClick={abrirNovo}>
          <Plus className="mr-1 h-5 w-5" /> Novo
        </Button>
      }
    >
      {editando ? (
        <Section title={editando === "novo" ? "Novo cliente" : "Editar cliente"}>
          <div className="space-y-1.5">
            <Label htmlFor="c-nome">Nome</Label>
            <Input
              id="c-nome"
              value={draft.nome}
              onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-cidade">Cidade</Label>
            <Input
              id="c-cidade"
              value={draft.cidade}
              onChange={(e) => setDraft({ ...draft, cidade: e.target.value })}
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-cnpj">CNPJ (opcional)</Label>
            <Input
              id="c-cnpj"
              value={draft.cnpj}
              onChange={(e) => setDraft({ ...draft, cnpj: e.target.value })}
              className="h-12 rounded-xl"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-contato">Contato</Label>
            <Input
              id="c-contato"
              value={draft.contato}
              onChange={(e) => setDraft({ ...draft, contato: e.target.value })}
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-telefone">Telefone</Label>
            <Input
              id="c-telefone"
              value={draft.telefone}
              onChange={(e) => setDraft({ ...draft, telefone: e.target.value })}
              className="h-12 rounded-xl"
              inputMode="tel"
            />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-3">
            <Label htmlFor="c-ativo">Ativo</Label>
            <Switch
              id="c-ativo"
              checked={draft.ativo}
              onCheckedChange={(v) => setDraft({ ...draft, ativo: v })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-obs">Observações</Label>
            <Textarea
              id="c-obs"
              rows={3}
              value={draft.observacoes}
              onChange={(e) => setDraft({ ...draft, observacoes: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="h-12 flex-1 rounded-xl"
              disabled={!draft.nome.trim() || salvar.isPending}
              onClick={() => salvar.mutate()}
            >
              Salvar
            </Button>
            <Button
              variant="ghost"
              className="h-12 rounded-xl"
              onClick={() => {
                setEditando(null);
                setDraft(emptyDraft);
              }}
            >
              Cancelar
            </Button>
          </div>
        </Section>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar cliente"
          className="h-12 rounded-xl pl-9"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <ul className="space-y-2">
          {lista.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setDraft(toDraft(c));
                  setEditando(c.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="card-surface flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.nome}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[c.cidade, c.telefone].filter(Boolean).join(" · ") || "Sem dados adicionais"}
                  </span>
                </span>
                <span
                  className={
                    c.ativo
                      ? "shrink-0 rounded-full bg-success/12 px-2.5 py-1 text-xs font-medium text-success"
                      : "shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                  }
                >
                  {c.ativo ? "Ativo" : "Inativo"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
