import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ChevronRight, CircleDollarSign, ClipboardList, FileArchive, Package, Users } from "lucide-react";

import { PageShell, Section } from "@/components/PageShell";

export const Route = createFileRoute("/_authenticated/mais")({
  head: () => ({ meta: [
    { title: "Mais opções — CP TECHNIC Horas" },
    { name: "description", content: "Acesse dados da empresa, clientes, peças, valores, orçamentos e relatórios." },
    { property: "og:title", content: "Mais opções — CP TECHNIC Horas" },
    { property: "og:description", content: "Cadastros e relatórios do CP TECHNIC Horas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Mais,
});

const options = [
  { to: "/dados-empresa", label: "Dados da empresa", detail: "Identificação e logo dos documentos", icon: Building2 },
  { to: "/clientes", label: "Clientes", detail: "Cadastro e contatos", icon: Users },
  { to: "/pecas", label: "Peças", detail: "Catálogo e preços", icon: Package },
  { to: "/valores", label: "Valores", detail: "Horas, viagem, KM e diárias", icon: CircleDollarSign },
  { to: "/orcamentos", label: "Orçamentos", detail: "Propostas, valores e aprovação", icon: ClipboardList },
  { to: "/relatorios-salvos", label: "Relatórios salvos", detail: "Documentos finais por cliente", icon: FileArchive },
] as const;

function Mais() {
  return (
    <PageShell title="Mais" subtitle="Cadastros e documentos">
      <Section title="Opções">
        <div className="-my-3 divide-y divide-border">
          {options.map(({ to, label, detail, icon: Icon }) => (
            <Link key={to} to={to} className="flex min-h-16 items-center gap-3 py-3 press">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">{label}</span><span className="block truncate text-sm text-muted-foreground">{detail}</span></span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}