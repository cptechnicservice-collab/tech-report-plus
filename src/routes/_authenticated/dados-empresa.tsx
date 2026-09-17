import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageShell, Section } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { empresaPadrao, fetchEmpresa } from "@/lib/empresa";
import { resizeImage } from "@/lib/image-resize";
import { saveEmpresaOffline } from "@/lib/offline";

export const Route = createFileRoute("/_authenticated/dados-empresa")({
  head: () => ({ meta: [
    { title: "Dados da empresa — CP TECHNIC Horas" },
    { name: "description", content: "Configure a identificação e a logo exibidas nos documentos." },
    { property: "og:title", content: "Dados da empresa — CP TECHNIC Horas" },
    { property: "og:description", content: "Identificação da empresa usada nos documentos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DadosEmpresaPage,
});

type Draft = typeof empresaPadrao & { telefone: string | null; logo_data_url: string | null };

function DadosEmpresaPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["dados-empresa"], queryFn: fetchEmpresa });
  const [draft, setDraft] = useState<Draft>(empresaPadrao);
  useEffect(() => { if (data) setDraft({ nome_fantasia: data.nome_fantasia, cnpj: data.cnpj, email: data.email, contato: data.contato, telefone: data.telefone, logo_data_url: data.logo_data_url }); }, [data]);
  const save = useMutation({
    mutationFn: () => saveEmpresaOffline({ id: data?.id ?? crypto.randomUUID(), ...draft }),
    onSuccess: (result) => { void queryClient.invalidateQueries({ queryKey: ["dados-empresa"] }); toast.success(result.queued ? "Dados salvos no aparelho" : "Dados da empresa salvos"); },
    onError: () => toast.error("Não foi possível salvar os dados da empresa"),
  });
  const selectLogo = async (file?: File) => {
    if (!file) return;
    try { setDraft((current) => ({ ...current, logo_data_url: await resizeImage(file) })); }
    catch { toast.error("Não foi possível usar essa imagem"); }
  };
  return (
    <PageShell title="Dados da empresa" subtitle="Identificação nos documentos">
      <Section title="Logo">
        <div className="flex items-center gap-4">
          <img src={draft.logo_data_url ?? "/app-icon.png"} alt="Logo da empresa" className="h-20 w-20 rounded-xl border object-contain" />
          <div className="flex flex-1 flex-col gap-2">
            <Button asChild variant="outline" className="h-11 rounded-xl"><label><ImagePlus className="mr-2 h-4 w-4" />Escolher logo<input type="file" accept="image/*" className="sr-only" onChange={(event) => void selectLogo(event.target.files?.[0])} /></label></Button>
            {draft.logo_data_url ? <Button type="button" variant="ghost" className="h-10 rounded-xl text-destructive" onClick={() => setDraft({ ...draft, logo_data_url: null })}><Trash2 className="mr-2 h-4 w-4" />Usar ícone do app</Button> : null}
          </div>
        </div>
      </Section>
      <Section title="Identificação">
        <Field id="empresa-nome" label="Nome fantasia" value={draft.nome_fantasia} onChange={(value) => setDraft({ ...draft, nome_fantasia: value })} />
        <Field id="empresa-cnpj" label="CNPJ" value={draft.cnpj} onChange={(value) => setDraft({ ...draft, cnpj: value })} inputMode="numeric" />
        <Field id="empresa-email" label="E-mail" value={draft.email} onChange={(value) => setDraft({ ...draft, email: value })} inputMode="email" />
        <Field id="empresa-contato" label="Nome do contato" value={draft.contato} onChange={(value) => setDraft({ ...draft, contato: value })} />
        <Field id="empresa-telefone" label="Telefone (opcional)" value={draft.telefone ?? ""} onChange={(value) => setDraft({ ...draft, telefone: value || null })} inputMode="tel" />
      </Section>
      <Button className="h-14 w-full rounded-xl text-base font-semibold" disabled={!draft.nome_fantasia.trim() || !draft.cnpj.trim() || !draft.email.trim() || !draft.contato.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Salvando..." : "Salvar dados"}</Button>
    </PageShell>
  );
}

function Field({ id, label, value, onChange, inputMode }: { id: string; label: string; value: string; onChange: (value: string) => void; inputMode?: "text" | "numeric" | "email" | "tel" }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} className="h-12 rounded-xl" /></div>;
}