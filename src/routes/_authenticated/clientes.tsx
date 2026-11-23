import { useMemo, useState } from "react";
import type React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { CnpjInput } from "@/components/CnpjInput";
import { PageShell, Section } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fetchClientes, normalizeSearchText, type Cliente } from "@/lib/apontamentos";
import { saveClienteOffline } from "@/lib/offline";
import { EtiquetaSheet } from "@/components/EtiquetaSheet";
import { buscarCep, maskCep, mergeViaCep, normalizeUf } from "@/lib/etiqueta";

export const Route = createFileRoute("/_authenticated/clientes")({
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  razao_social: string;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  uf: string;
};

const emptyDraft: Draft = {
  nome: "",
  cidade: "",
  cnpj: "",
  contato: "",
  telefone: "",
  ativo: true,
  observacoes: "",
  razao_social: "",
  email: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  uf: "",
};

function toDraft(c: Cliente): Draft {
  return {
    nome: c.nome.toUpperCase(),
    cidade: c.cidade ?? "",
    cnpj: c.cnpj ?? "",
    contato: c.contato ?? "",
    telefone: c.telefone ?? "",
    ativo: c.ativo,
    observacoes: c.observacoes ?? "",
    razao_social: c.razao_social ?? "",
    email: c.email ?? "",
    cep: c.cep ?? "",
    logradouro: c.logradouro ?? "",
    numero: c.numero ?? "",
    complemento: c.complemento ?? "",
    bairro: c.bairro ?? "",
    uf: c.uf ?? "",
  };
}

function Clientes() {
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const queryClient = useQueryClient();
  const [etiquetaId, setEtiquetaId] = useState<string | null>(null);
  const onCep = (value: string) => {
    const cep = maskCep(value);
    setDraft((d) => ({ ...d, cep }));
    if (cep.replace(/\D/g, "").length === 8) {
      void buscarCep(cep).then((res) => { if (res) setDraft((d) => (d.cep === cep ? mergeViaCep(d, res) : d)); });
    }
  };
  const field = (id: string, label: string, key: keyof Draft, extra: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={draft[key] as string} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} className="h-12 rounded-xl" {...extra} />
    </div>
  );

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: fetchClientes,
  });

  const lista = useMemo(() => {
    const termo = normalizeSearchText(busca);
    if (!termo) return clientes;
    return clientes.filter(
      (c) =>
        normalizeSearchText(c.nome).includes(termo) ||
        normalizeSearchText(c.cidade ?? "").includes(termo),
    );
  }, [clientes, busca]);

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: draft.nome.trim().toUpperCase(),
        cidade: draft.cidade.trim() || null,
        cnpj: draft.cnpj.trim() || null,
        contato: draft.contato.trim() || null,
        telefone: draft.telefone.trim() || null,
        ativo: draft.ativo,
        observacoes: draft.observacoes.trim() || null,
        razao_social: draft.razao_social.trim() || null,
        email: draft.email.trim() || null,
        cep: draft.cep.trim() || null,
        logradouro: draft.logradouro.trim() || null,
        numero: draft.numero.trim() || null,
        complemento: draft.complemento.trim() || null,
        bairro: draft.bairro.trim() || null,
        uf: draft.uf.trim().toUpperCase() || null,
      };
      return saveClienteOffline({ ...payload, id: editando && editando !== "novo" ? editando : crypto.randomUUID() });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      toast.success(result.queued ? "Salvo no aparelho — será enviado quando houver conexão" : "Cliente salvo");
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
      backTo="/mais"
      action={
        <Button className="rounded-full px-4" onClick={abrirNovo}>
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
              onChange={(e) => setDraft({ ...draft, nome: e.target.value.toUpperCase() })}
              autoCapitalize="characters"
              className="h-12 rounded-xl"
            />
          </div>
          {field("c-razao", "Razão social / Empresa", "razao_social")}
          <div className="space-y-1.5">
            <Label htmlFor="c-cnpj">CNPJ (opcional)</Label>
            <CnpjInput
              id="c-cnpj"
              value={draft.cnpj}
              onChange={(value) => setDraft({ ...draft, cnpj: value })}
              className="h-12 rounded-xl"
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
          {field("c-email", "E-mail", "email", { inputMode: "email", type: "email", autoCapitalize: "none" })}
          <div className="space-y-3 rounded-2xl border p-3">
            <p className="text-sm font-semibold">Endereço</p>
            <div className="space-y-1.5">
              <Label htmlFor="c-cep">CEP</Label>
              <Input id="c-cep" value={draft.cep} onChange={(e) => onCep(e.target.value)} inputMode="numeric" placeholder="00000-000" className="h-12 rounded-xl" />
            </div>
            {field("c-logradouro", "Logradouro", "logradouro")}
            <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
              {field("c-numero", "Número", "numero", { inputMode: "numeric" })}
              {field("c-complemento", "Complemento", "complemento")}
            </div>
            {field("c-bairro", "Bairro", "bairro")}
            <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2">
              {field("c-cidade", "Cidade", "cidade")}
              <div className="space-y-1.5">
                <Label htmlFor="c-uf">UF</Label>
                <Input id="c-uf" value={draft.uf} onChange={(e) => setDraft((d) => ({ ...d, uf: normalizeUf(e.target.value) }))} autoCapitalize="characters" maxLength={2} className="h-12 rounded-xl" />
              </div>
            </div>
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

      <div className="relative px-0.5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar cliente"
          className="rounded-full bg-secondary pl-9"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <ul className="ios-group divide-y divide-border">
          {lista.map((c) => (
            <li key={c.id} className="flex items-center">
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setDraft(toDraft(c));
                  setEditando(c.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="h-auto min-h-16 min-w-0 flex-1 justify-between rounded-none px-4 py-3 text-left font-normal"
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
              </Button>
              <Button type="button" variant="ghost" size="icon" className="mr-2 h-11 w-11 shrink-0 rounded-xl text-primary" aria-label={`Etiqueta de envio de ${c.nome}`} onClick={() => setEtiquetaId(c.id)}>
                <Package className="h-5 w-5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <EtiquetaSheet
        cliente={clientes.find((c) => c.id === etiquetaId)}
        open={Boolean(etiquetaId)}
        onOpenChange={(open) => { if (!open) setEtiquetaId(null); }}
        onEditCliente={() => {
          const c = clientes.find((entry) => entry.id === etiquetaId);
          setEtiquetaId(null);
          if (c) { setDraft(toDraft(c)); setEditando(c.id); window.scrollTo({ top: 0, behavior: "smooth" }); }
        }}
      />
    </PageShell>
  );
}
